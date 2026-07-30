import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Download, Plus, X, Trash2 } from 'lucide-react'
import TabBar from '../components/TabBar'
import { notify } from '../lib/notify'
import { useToast } from '../components/ui/Toast'

export default function AccountingPage({ embedded }: { embedded?: boolean }) {
  const { profile, post } = useAuth()
  const { toast } = useToast()
  const [tab, setTab] = useState<'approved' | 'receipts' | 'purchase_orders' | 'interentity' | 'completed'>('approved')
  const [awaitingFunding, setAwaitingFunding] = useState<any[]>([])
  const [pendingReceipts, setPendingReceipts] = useState<any[]>([])
  const [remindingId, setRemindingId] = useState<string | null>(null)
  const [interEntityTx, setInterEntityTx] = useState<any[]>([])
  const [completedData, setCompletedData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showIETModal, setShowIETModal] = useState(false)
  const [entities, setEntities] = useState<any[]>([])
  const [ietForm, setIetForm] = useState({ title: '', description: '', amount: '', category: 'Joint Purchase' })
  const [submitting, setSubmitting] = useState(false)
  const [actionNote, setActionNote] = useState('')
  const [actionModal, setActionModal] = useState<any>(null)

  const level = post?.hierarchy_levels
  const canAccess = level?.can_see_budgets || level?.is_accounting || (level && level.rank <= 1)
  const isExec = level && level.rank <= 1

  useEffect(() => { if (profile && canAccess) { loadAll(); loadEntities() } }, [profile, tab])

  async function loadAll() {
    setLoading(true)
    const tid = profile!.tenant_id
    if (tab === 'approved') {
      // Approved by the approval workflow, not yet funded — this is what
      // accounting works through to decide what gets money first when
      // there isn't enough budget for everything.
      const { data } = await supabase.from('funding_requests')
        .select('*, user_profiles!requester_id(full_name), entities!entity_id(name)')
        .eq('tenant_id', tid).eq('status', 'approved')
        .order('deadline', { ascending: true, nullsFirst: false })
      const priorityWeight: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
      const sorted = (data || []).sort((a, b) => {
        const pw = (priorityWeight[a.priority] ?? 2) - (priorityWeight[b.priority] ?? 2)
        if (pw !== 0) return pw
        if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
        if (a.deadline) return -1
        if (b.deadline) return 1
        return 0
      })
      setAwaitingFunding(sorted)
    } else if (tab === 'receipts') {
      // Funded, waiting on the requester to attach a receipt or on
      // accounting to review one that's already been uploaded.
      const { data } = await supabase.from('funding_requests')
        .select('*, user_profiles!requester_id(full_name), entities!entity_id(name)')
        .eq('tenant_id', tid).eq('status', 'funded').in('receipt_status', ['pending', 'uploaded'])
        .order('funded_at', { ascending: true })
      setPendingReceipts(data || [])
    } else if (tab === 'interentity') {
      const { data } = await supabase.from('inter_entity_transactions')
        .select('*, entities!initiating_entity(name), user_profiles!submitted_by(full_name)')
        .eq('tenant_id', tid).order('created_at', { ascending: false })
      setInterEntityTx(data || [])
    } else if (tab === 'completed') {
      // Fully closed out: funded, and either the receipt was confirmed by
      // accounting, waived, or was never required in the first place.
      const { data } = await supabase.from('funding_requests')
        .select('*, user_profiles!requester_id(full_name), entities!entity_id(name), confirmer:user_profiles!receipt_confirmed_by(full_name)')
        .eq('tenant_id', tid).eq('status', 'funded').in('receipt_status', ['confirmed', 'waived', 'not_required'])
        .order('receipt_confirmed_at', { ascending: false, nullsFirst: false })
      setCompletedData(data || [])
    }
    setLoading(false)
  }

  async function loadEntities() {
    const { data } = await supabase.from('entities').select('id,name').eq('tenant_id', profile!.tenant_id).eq('is_active', true)
    setEntities(data || [])
  }

  async function submitIET(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const ref = `IET-${Date.now().toString(36).toUpperCase()}`
    await supabase.from('inter_entity_transactions').insert({
      tenant_id: profile!.tenant_id,
      ref,
      title: ietForm.title,
      description: ietForm.description,
      amount: parseFloat(ietForm.amount),
      category: ietForm.category,
      initiating_entity: profile!.entity_id,
      participating_entities: [],
      submitted_by: profile!.id,
      status: 'pending'
    })
    setShowIETModal(false)
    setIetForm({ title: '', description: '', amount: '', category: 'Joint Purchase' })
    loadAll()
    setSubmitting(false)
  }

  async function handleIETAction(id: string, action: string) {
    await supabase.from('inter_entity_transactions').update({
      status: action,
      approved_by: profile!.id,
      approved_at: new Date().toISOString(),
      rejection_reason: action === 'rejected' ? actionNote : null
    }).eq('id', id)
    setActionModal(null)
    setActionNote('')
    loadAll()
  }

  async function markFunded(id: string) {
    await supabase.from('funding_requests').update({ status: 'funded', funded_by: profile!.id, funded_at: new Date().toISOString() }).eq('id', id)
    loadAll()
  }

  async function remindReceipt(r: any) {
    setRemindingId(r.id)
    await notify({
      tenant_id: profile!.tenant_id, user_id: r.requester_id,
      title: `Receipt needed for ${r.ref}`,
      body: `Accounting is waiting on your receipt/proof of purchase for ${r.ref} (USD ${parseFloat(r.amount).toFixed(2)}). Please upload it from your Requests page.`,
      category: 'requests', action_url: '/requests', priority: 'high',
    })
    setRemindingId(null)
    toast('success', 'Reminder sent', `Reminder sent to ${r.user_profiles?.full_name || 'requester'}.`)
  }

  async function resolveReceipt(id: string, status: 'uploaded' | 'waived') {
    await supabase.from('funding_requests').update({
      receipt_status: status,
      ...(status === 'uploaded' ? { receipt_uploaded_at: new Date().toISOString() } : {})
    }).eq('id', id)
    loadAll()
  }

  // The "close" action — accounting has reviewed the uploaded receipt and
  // is satisfied it matches the transaction. This is what moves a
  // requisition from Receipts into Completed.
  async function confirmReceipt(id: string) {
    await supabase.from('funding_requests').update({
      receipt_status: 'confirmed',
      receipt_confirmed_by: profile!.id,
      receipt_confirmed_at: new Date().toISOString(),
    }).eq('id', id)
    loadAll()
  }

  function exportCompletedCSV() {
    const rows = [['Ref', 'Date', 'Requester', 'Entity', 'Category', 'Amount', 'Status']]
    completedData.forEach(r => rows.push([r.ref, r.funded_at, r.user_profiles?.full_name, r.entities?.name, r.category, r.amount, r.status]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `completed-requisitions-${new Date().toISOString().slice(0, 7)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // Opens a print-friendly window with the requisition's full detail and
  // its receipt, so accounting can keep a physical copy on file if they want.
  function printRequisition(r: any) {
    const w = window.open('', '_blank')
    if (!w) return
    // Every attachment on the requisition, plus the receipt if there's one
    // that isn't already in that list — all of it goes out together so a
    // physical copy has everything, not just whichever file happened to be
    // first.
    const docs: { name: string; url: string; type?: string }[] = []
    if (Array.isArray(r.attachments)) {
      for (const att of r.attachments) if (att?.url) docs.push({ name: att.name || 'Attachment', url: att.url, type: att.type })
    }
    if (r.receipt_url && !docs.some(d => d.url === r.receipt_url)) {
      docs.push({ name: 'Receipt', url: r.receipt_url })
    }
    const docsHtml = docs.length === 0
      ? '<p><em>No documents attached.</em></p>'
      : docs.map(d => {
          const isImage = d.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(d.url)
          return isImage
            ? `<p><strong>${d.name}</strong></p><img src="${d.url}" />`
            : `<p><strong>${d.name}:</strong> <a href="${d.url}">${d.url}</a></p>`
        }).join('')
    w.document.write(`
      <html>
        <head>
          <title>${r.ref}</title>
          <style>
            body { font-family: 'DM Sans', Arial, sans-serif; padding: 2rem; color: #1a1814; }
            h1 { font-size: 1.25rem; margin: 0 0 0.25rem; }
            .meta { color: #555; font-size: 0.85rem; margin-bottom: 1.5rem; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
            td { padding: 0.4rem 0.6rem; border-bottom: 1px solid #ddd; font-size: 0.9rem; }
            td:first-child { color: #555; width: 160px; }
            img { max-width: 100%; border: 1px solid #ccc; margin-top: 1rem; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Requisition ${r.ref}</h1>
          <p class="meta">Printed ${new Date().toLocaleString()}</p>
          <table>
            <tr><td>Requester</td><td>${r.user_profiles?.full_name || ''}</td></tr>
            <tr><td>Entity</td><td>${r.entities?.name || ''}</td></tr>
            <tr><td>Category</td><td>${r.category || ''}</td></tr>
            <tr><td>Description</td><td>${r.description || ''}</td></tr>
            <tr><td>Amount</td><td>USD ${parseFloat(r.amount).toFixed(2)}</td></tr>
            <tr><td>Priority</td><td>${r.priority || 'normal'}</td></tr>
            <tr><td>Deadline</td><td>${r.deadline ? new Date(r.deadline).toLocaleDateString() : '—'}</td></tr>
            <tr><td>Funded</td><td>${r.funded_at ? new Date(r.funded_at).toLocaleString() : '—'}</td></tr>
            <tr><td>Receipt confirmed by</td><td>${r.confirmer?.full_name || '—'}</td></tr>
            <tr><td>Receipt confirmed</td><td>${r.receipt_confirmed_at ? new Date(r.receipt_confirmed_at).toLocaleString() : '—'}</td></tr>
          </table>
          ${docsHtml}
          <script>window.onload = () => window.print()</script>
        </body>
      </html>
    `)
    w.document.close()
  }

  function statusBadge(s: string) {
    const map: Record<string, string> = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected', funded: 'badge-funded', endorsed: 'badge-active' }
    return <span className={`badge ${map[s] || 'badge-draft'}`}>{s}</span>
  }

  if (!post) {
    const spinner = <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
    return embedded ? spinner : <Layout title="Accounting">{spinner}</Layout>
  }

  if (!canAccess) {
    if (embedded) return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Access restricted.</div>
    return <Layout title="Accounting"><div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Access restricted.</div></Layout>
  }

  const inner = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <TabBar>
          {(['approved', 'receipts', 'purchase_orders', 'interentity', 'completed'] as const).map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>
              {t === 'interentity' ? 'Inter-Entity' : t === 'purchase_orders' ? 'Purchase Orders' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </TabBar>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {tab === 'interentity' && isExec && (
            <button className="btn-gold" onClick={() => setShowIETModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={16} /> New Transaction
            </button>
          )}
          {tab === 'completed' && (
            <button className="btn-ghost" onClick={exportCompletedCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Download size={15} /> Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
        ) : tab === 'approved' ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Ref</th><th>Requester</th><th>Entity</th><th>Amount</th><th>Category</th><th>Priority</th><th>Deadline</th><th>Actions</th></tr></thead>
              <tbody>
                {awaitingFunding.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Nothing approved and awaiting funds right now</td></tr>
                  : awaitingFunding.map(r => {
                    const priorityColor: Record<string, string> = { urgent: 'var(--danger)', high: 'var(--warning)', normal: 'var(--text-muted)', low: 'var(--text-muted)' }
                    const overdue = r.deadline && new Date(r.deadline) < new Date()
                    return (
                      <tr key={r.id}>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-small)', color: 'var(--gold)' }}>{r.ref}</td>
                        <td>{r.user_profiles?.full_name}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{r.entities?.name}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>USD {parseFloat(r.amount).toFixed(2)}</td>
                        <td>{r.category}</td>
                        <td style={{ color: priorityColor[r.priority] || 'var(--text-muted)', fontWeight: r.priority === 'urgent' || r.priority === 'high' ? 700 : 400, textTransform: 'capitalize', fontSize: 'var(--text-small)' }}>{r.priority || 'normal'}</td>
                        <td style={{ color: overdue ? 'var(--danger)' : 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{r.deadline ? new Date(r.deadline).toLocaleDateString() : '—'} {overdue ? '⚠️' : ''}</td>
                        <td>
                          <button className="btn-gold" style={{ padding: '0.3rem 0.7rem', fontSize: 'var(--text-micro)' }} onClick={() => markFunded(r.id)}>Mark Funded</button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        ) : tab === 'receipts' ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Ref</th><th>Requester</th><th>Entity</th><th>Amount</th><th>Category</th><th>Status</th><th>Awaiting since</th><th>Actions</th></tr></thead>
              <tbody>
                {pendingReceipts.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No outstanding receipts — all clear 🎉</td></tr>
                  : pendingReceipts.map(r => {
                    const since = r.funded_at || r.approved_at || r.created_at
                    const daysOld = Math.floor((Date.now() - new Date(since).getTime()) / 86400000)
                    const receiptSrc = r.receipt_url || r.attachments?.[0]?.url
                    return (
                      <tr key={r.id}>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-small)', color: 'var(--gold)' }}>{r.ref}</td>
                        <td>{r.user_profiles?.full_name}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{r.entities?.name}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>USD {parseFloat(r.amount).toFixed(2)}</td>
                        <td>{r.category}</td>
                        <td>{r.receipt_status === 'uploaded' ? <span style={{ color: 'var(--success)', fontSize: 'var(--text-small)' }}>🧾 Uploaded</span> : <span style={{ color: 'var(--warning)', fontSize: 'var(--text-small)' }}>Awaiting</span>}</td>
                        <td style={{ color: daysOld >= 7 ? 'var(--warning)' : 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{daysOld}d {daysOld >= 7 ? '⚠️' : ''}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            {r.receipt_status === 'uploaded' ? (
                              <>
                                {receiptSrc && <a href={receiptSrc} target="_blank" rel="noreferrer" style={{ fontSize: 'var(--text-micro)', color: 'var(--info)' }}>View receipt</a>}
                                <button className="btn-gold" style={{ padding: '0.3rem 0.6rem', fontSize: 'var(--text-micro)' }}
                                  onClick={() => confirmReceipt(r.id)}>Confirm &amp; Close</button>
                                <button className="btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}
                                  onClick={() => resolveReceipt(r.id, 'waived')}>Waive</button>
                              </>
                            ) : (
                              <>
                                <button className="btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: 'var(--text-micro)' }}
                                  onClick={() => remindReceipt(r)} disabled={remindingId === r.id}>
                                  {remindingId === r.id ? 'Sending…' : '🔔 Remind'}
                                </button>
                                <button className="btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: 'var(--text-micro)', color: 'var(--success)' }}
                                  onClick={() => resolveReceipt(r.id, 'uploaded')}>Mark Received</button>
                                <button className="btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}
                                  onClick={() => resolveReceipt(r.id, 'waived')}>Waive</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        ) : tab === 'purchase_orders' ? (
          <PurchaseOrdersSection profile={profile} />
        ) : tab === 'interentity' ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Ref</th><th>Title</th><th>Initiating Entity</th><th>Amount</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {interEntityTx.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No inter-entity transactions</td></tr>
                  : interEntityTx.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-small)', color: 'var(--gold)' }}>{t.ref}</td>
                      <td style={{ fontWeight: 500 }}>{t.title}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{t.entities?.name}</td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>USD {parseFloat(t.amount).toFixed(2)}</td>
                      <td>{t.category}</td>
                      <td>{statusBadge(t.status)}</td>
                      <td>
                        {isExec && t.status === 'pending' && (
                          <button className="btn-ghost" style={{ padding: '0.3rem 0.7rem', fontSize: 'var(--text-micro)' }} onClick={() => setActionModal(t)}>Review</button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Ref</th><th>Requester</th><th>Entity</th><th>Category</th><th>Amount</th><th>Funded</th><th>Closed by</th><th></th></tr></thead>
              <tbody>
                {completedData.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No completed requisitions yet</td></tr>
                  : completedData.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-small)', color: 'var(--gold)' }}>{r.ref}</td>
                      <td>{r.user_profiles?.full_name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{r.entities?.name}</td>
                      <td>{r.category}</td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>USD {parseFloat(r.amount).toFixed(2)}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{r.funded_at ? new Date(r.funded_at).toLocaleDateString() : '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{r.confirmer?.full_name || (r.receipt_status === 'waived' ? 'Waived' : '—')}</td>
                      <td>
                        <button className="btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: 'var(--text-micro)' }} onClick={() => printRequisition(r)}>🖨 Print</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* IET modal */}
      {showIETModal && (
        <div className="modal-backdrop" onClick={() => setShowIETModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-lead)', margin: 0 }}>Inter-Entity Transaction</h3>
              <button onClick={() => setShowIETModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={submitIET}>
              {[
                { label: 'Title', el: <input className="input" required value={ietForm.title} onChange={e => setIetForm({ ...ietForm, title: e.target.value })} placeholder="Transaction title" /> },
                { label: 'Description', el: <textarea className="input" required value={ietForm.description} onChange={e => setIetForm({ ...ietForm, description: e.target.value })} rows={2} /> },
                { label: 'Amount (USD)', el: <input className="input" type="number" required min="0.01" step="0.01" value={ietForm.amount} onChange={e => setIetForm({ ...ietForm, amount: e.target.value })} placeholder="0.00" /> },
                { label: 'Category', el: <select className="input" value={ietForm.category} onChange={e => setIetForm({ ...ietForm, category: e.target.value })}><option>Joint Purchase</option><option>Cost Allocation</option><option>Loan</option><option>Service Charge</option><option>Other</option></select> },
              ].map(({ label, el }) => <div key={label} style={{ marginBottom: '1rem' }}><label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>{el}</div>)}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowIETModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IET action modal */}
      {actionModal && (
        <div className="modal-backdrop" onClick={() => setActionModal(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-lead)', margin: 0 }}>Review Transaction</h3>
              <button onClick={() => setActionModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '0.875rem', marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.25rem', fontWeight: 600 }}>{actionModal.title}</p>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>USD {parseFloat(actionModal.amount).toFixed(2)} · {actionModal.category}</p>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Note (required for rejection)</label>
              <textarea className="input" rows={2} value={actionNote} onChange={e => setActionNote(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setActionModal(null)}>Cancel</button>
              <button style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.625rem 1rem', cursor: 'pointer', fontSize: 'var(--text-small)' }} onClick={() => handleIETAction(actionModal.id, 'rejected')}>Reject</button>
              <button className="btn-gold" onClick={() => handleIETAction(actionModal.id, 'approved')}>Approve</button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  if (embedded) return inner
  return <Layout title="Accounting">{inner}</Layout>
}

/* ── PURCHASE ORDERS ─────────────────────────────────────────────────── */
function PurchaseOrdersSection({ profile }: any) {
  const [orders, setOrders] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editOrder, setEditOrder] = useState<any>(null)
  const [items, setItems] = useState([{ item_name:'', quantity:1, unit_price:0 }])
  const [form, setForm] = useState({ vendor_id:'', notes:'', expected_date:'' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (profile) { load(); loadVendors() } }, [profile])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('purchase_orders').select('*, vendors!vendor_id(name), user_profiles!created_by(full_name)').eq('tenant_id', profile.tenant_id).is('deleted_at', null).order('created_at', { ascending:false })
    setOrders(data||[]); setLoading(false)
  }
  async function loadVendors() {
    const { data } = await supabase.from('vendors').select('id,name').eq('tenant_id', profile.tenant_id)
    setVendors(data||[])
  }

  function openAdd() { setEditOrder(null); setForm({ vendor_id:'', notes:'', expected_date:'' }); setItems([{ item_name:'', quantity:1, unit_price:0 }]); setShowModal(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true)
    const total = items.reduce((s,i) => s + i.quantity * i.unit_price, 0)
    const ref = `PO-${Date.now().toString(36).toUpperCase()}`
    const { data:po } = await supabase.from('purchase_orders').insert({ tenant_id:profile.tenant_id, entity_id:profile.entity_id, vendor_id:form.vendor_id||null, ref, status:'draft', total_amount:total, notes:form.notes||null, created_by:profile.id, expected_date:form.expected_date||null }).select().single()
    if (po) await supabase.from('purchase_order_items').insert(items.map(i => ({ po_id:po.id, item_name:i.item_name, quantity:i.quantity, unit_price:i.unit_price })))
    setShowModal(false); await load(); setSubmitting(false)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('purchase_orders').update({ status, ...(status==='approved'?{ approved_by:profile.id, approved_at:new Date().toISOString() }:{}) }).eq('id', id); await load()
  }

  const statusColor: Record<string,string> = { draft:'badge-draft', submitted:'badge-pending', approved:'badge-approved', received:'badge-paid', cancelled:'badge-rejected' }
  return (
    <>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'1rem' }}>
        <button className="btn-gold" style={{ gap:5 }} onClick={openAdd}><Plus size={14}/>New PO</button>
      </div>
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {loading ? <div style={{ display:'flex', justifyContent:'center', padding:'2rem' }}><div className="spinner"/></div>
        : orders.length===0 ? <div className="empty-state"><p className="empty-state-title">No purchase orders yet</p></div>
        : <div style={{ overflowX:'auto' }}><table className="data-table">
            <thead><tr><th>Ref</th><th>Vendor</th><th>Total</th><th>Status</th><th>Expected</th><th>Created By</th><th></th></tr></thead>
            <tbody>{orders.map(o => (
              <tr key={o.id}>
                <td style={{ fontFamily:"'JetBrains Mono',monospace", color:'var(--gold)', fontWeight:600 }}>{o.ref}</td>
                <td>{o.vendors?.name||'—'}</td>
                <td style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>USD {parseFloat(o.total_amount||0).toFixed(2)}</td>
                <td><span className={`badge ${statusColor[o.status]||'badge-draft'}`}>{o.status}</span></td>
                <td style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>{o.expected_date?new Date(o.expected_date).toLocaleDateString():'—'}</td>
                <td style={{ color:'var(--text-muted)' }}>{o.user_profiles?.full_name}</td>
                <td><div style={{ display:'flex', gap:4 }}>
                  {o.status==='draft' && <button className="btn-ghost" style={{ padding:'0.25rem 0.5rem', fontSize:'0.72rem' }} onClick={() => updateStatus(o.id,'submitted')}>Submit</button>}
                  {o.status==='submitted' && <button className="btn-ghost" style={{ padding:'0.25rem 0.5rem', fontSize:'0.72rem', color:'var(--success)' }} onClick={() => updateStatus(o.id,'approved')}>Approve</button>}
                  {o.status==='approved' && <button className="btn-ghost" style={{ padding:'0.25rem 0.5rem', fontSize:'0.72rem' }} onClick={() => updateStatus(o.id,'received')}>Received</button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>}
      </div>
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="card" style={{ width:'100%', maxWidth:500 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
              <h3 style={{ fontFamily:"'Playfair Display',serif", margin:0, fontSize:'1rem' }}>New Purchase Order</h3>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <form onSubmit={save}>
              <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1rem' }}>
                <div style={{ flex:1 }}><label className="form-label">Vendor</label>
                  <select className="input" value={form.vendor_id} onChange={e => setForm({...form,vendor_id:e.target.value})}><option value="">None</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select>
                </div>
                <div style={{ flex:1 }}><label className="form-label">Expected Date</label><input className="input" type="date" value={form.expected_date} onChange={e => setForm({...form,expected_date:e.target.value})} /></div>
              </div>
              <div style={{ marginBottom:'1rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
                  <label className="form-label" style={{ margin:0 }}>Line Items</label>
                  <button type="button" className="btn-ghost" style={{ fontSize:'0.72rem', padding:'0.2rem 0.5rem' }} onClick={() => setItems([...items, { item_name:'', quantity:1, unit_price:0 }])}>+ Add Line</button>
                </div>
                {items.map((item,i) => (
                  <div key={i} style={{ display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center' }}>
                    <input className="input" style={{ flex:2 }} placeholder="Item name" required value={item.item_name} onChange={e => { const n=[...items]; n[i]={...n[i],item_name:e.target.value}; setItems(n) }} />
                    <input className="input" style={{ width:70 }} type="number" min="0.01" step="0.01" placeholder="Qty" value={item.quantity} onChange={e => { const n=[...items]; n[i]={...n[i],quantity:parseFloat(e.target.value)||1}; setItems(n) }} />
                    <input className="input" style={{ width:90 }} type="number" min="0" step="0.01" placeholder="Unit $" value={item.unit_price} onChange={e => { const n=[...items]; n[i]={...n[i],unit_price:parseFloat(e.target.value)||0}; setItems(n) }} />
                    {items.length>1 && <button type="button" onClick={() => setItems(items.filter((_,j)=>j!==i))} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--danger)', flexShrink:0 }}><Trash2 size={13}/></button>}
                  </div>
                ))}
                <p style={{ margin:'0.375rem 0 0', fontSize:'0.8rem', color:'var(--gold)', textAlign:'right', fontFamily:"'JetBrains Mono',monospace" }}>Total: USD {items.reduce((s,i)=>s+i.quantity*i.unit_price,0).toFixed(2)}</p>
              </div>
              <div style={{ marginBottom:'1.25rem' }}><label className="form-label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} /></div>
              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting?'Creating...':'Create PO'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
