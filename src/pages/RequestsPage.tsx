import React, { useEffect, useState, useRef, useMemo } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { dbWrite } from '../lib/offlineWrite'
import { audit } from '../lib/audit'
import { notify } from '../lib/notify'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/ui/Toast'
import { useEscapeKey } from '../hooks/useEscapeKey'
import FocusTrap from '../components/FocusTrap'
import SearchInput from '../components/ui/SearchInput'
import { SkeletonTable } from '../components/ui/Skeleton'
import { Plus, X, AlertCircle, Clock, Search, Filter, Download } from 'lucide-react'
import TabBar from '../components/TabBar'
import { computeRouting, canUserAct, ApprovalRule } from '../lib/approvalRouting'

const CATEGORIES = [
  'Petty Cash',
  'Operations', 'Marketing', 'Equipment', 'Travel',
  'Utilities', 'Repairs', 'Supplies', 'Training',
  'Materials', 'Subcontract', 'Maintenance', 'Renovation',
  'Inter-Entity', 'Other',
]

export default function RequestsPage() {
  const { profile, post, activeEntityId, tenant } = useAuth()
  const [requests, setRequests] = useState<any[]>([])
  const [rules, setRules] = useState<ApprovalRule[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [delegatedLevels, setDelegatedLevels] = useState<{ rank: number; can_approve: boolean; can_endorse: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ amount: '', category: '', description: '', justification: '', recurring: 'one-time' })
  const [attachFile, setAttachFile] = useState<File | null>(null)
  const [attachProgress, setAttachProgress] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [actionModal, setActionModal] = useState<any>(null)
  const [actionNote, setActionNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  // Search & filter
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const navigate = useNavigate()

  const level = post?.hierarchy_levels
  const canApprove = level?.can_approve
  const canEndorse = level?.can_endorse
  const userRank: number | null = level?.rank ?? null
  // Effective permissions include any active acting_authority delegations —
  // e.g. a Staff member covering for a Department Manager on leave gains
  // that manager's approval rank/authority for the duration.
  const effectiveRank = delegatedLevels.length > 0
    ? Math.min(userRank ?? Infinity, ...delegatedLevels.map(d => d.rank))
    : userRank
  const effectiveCanApprove = canApprove || delegatedLevels.some(d => d.can_approve)
  const effectiveCanEndorse = canEndorse || delegatedLevels.some(d => d.can_endorse)
  const pettyCashLimit = tenant?.petty_cash_limit ?? 15
  const dualApprovalThreshold = tenant?.dual_approval_threshold ?? 999
  const { toast } = useToast()
  useEscapeKey(() => { setShowModal(false); setActionModal(null); setReceiptModal(null) })
  const entityId = activeEntityId || profile?.entity_id

  useEffect(() => { if (profile) load() }, [profile, activeEntityId])

  async function load() {
    setLoading(true)
    const cacheKey = `requests:${profile!.tenant_id}:${profile!.id}`
    if (!navigator.onLine) {
      const { offlineQueue } = await import('../lib/offlineQueue')
      const cached = await offlineQueue.cacheGet<any[]>(cacheKey)
      setRequests(cached || [])
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('funding_requests')
      .select('*, user_profiles!requester_id(full_name), entities!entity_id(name), request_approvals(id,approver_id,action), attachments')
      .eq('tenant_id', profile!.tenant_id)
      .order('created_at', { ascending: false })
    const rows = data || []
    setRequests(rows)
    // Cache for offline
    const { offlineQueue } = await import('../lib/offlineQueue')
    offlineQueue.cacheSet(cacheKey, rows).catch(() => {})

    // Approval routing inputs — rules configured in Admin, and rank levels
    // for gating who can act on a given request.
    const today = new Date().toISOString().split('T')[0]
    const [{ data: ruleData }, { data: levelData }, { data: delegationData }] = await Promise.all([
      supabase.from('approval_rules').select('*').eq('tenant_id', profile!.tenant_id).eq('is_active', true),
      supabase.from('hierarchy_levels').select('rank,name').eq('tenant_id', profile!.tenant_id),
      supabase.from('acting_authority')
        .select('*, absent:user_profiles!absent_user_id(posts!post_id(hierarchy_levels!level_id(rank,can_approve,can_endorse)))')
        .eq('tenant_id', profile!.tenant_id).eq('acting_user_id', profile!.id).eq('is_active', true)
        .lte('start_date', today).gte('end_date', today),
    ])
    setRules(ruleData || [])
    setLevels(levelData || [])
    setDelegatedLevels(
      (delegationData || [])
        .map((d: any) => d.absent?.posts?.hierarchy_levels)
        .filter(Boolean)
    )

    setLoading(false)
  }

  // Compress images before upload — critical for 2G/3G
  async function compressImage(file: File, maxKB = 500): Promise<Blob> {
    if (!file.type.startsWith('image/')) return file
    return new Promise(resolve => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const canvas = document.createElement('canvas')
        const MAX = 1200
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
        canvas.width  = img.width  * ratio
        canvas.height = img.height * ratio
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', maxKB >= 200 ? 0.8 : 0.6)
      }
      img.src = url
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!entityId) { alert('No entity assigned to your profile. Contact your administrator.'); return }
    setSubmitting(true)
    const amt = parseFloat(form.amount)
    const routing = computeRouting({
      amount: amt, category: form.category, recurring: form.recurring, entityId,
      pettyCashLimit, dualApprovalThreshold, rules,
    })
    const ref = `FR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`

    // Upload attachment if provided
    let attachments: any[] = []
    if (attachFile) {
      try {
        setAttachProgress('Uploading attachment…')
        const toUpload = await compressImage(attachFile)
        const ext = attachFile.name.split('.').pop()
        const path = `${profile!.tenant_id}/requests/${ref}/${attachFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { data: storageData, error: storageErr } = await supabase.storage
          .from('vela-documents')
          .upload(path, toUpload, { contentType: attachFile.type, upsert: true })
        if (storageErr) throw storageErr
        const { data: urlData } = supabase.storage.from('vela-documents').getPublicUrl(path)
        // vela-documents is private — get a signed URL
        const { data: signedData } = await supabase.storage.from('vela-documents').createSignedUrl(path, 60 * 60 * 24 * 365)
        attachments = [{ name: attachFile.name, url: signedData?.signedUrl || '', path, size: attachFile.size, type: attachFile.type, uploaded_at: new Date().toISOString() }]
        setAttachProgress('')
      } catch (err: any) {
        console.error('Attachment upload failed:', err)
        setAttachProgress('Upload failed — submitting without attachment')
        attachments = []
      }
    }

    const payload = {
      tenant_id: profile!.tenant_id,
      ref, requester_id: profile!.id,
      entity_id: entityId,
      amount: amt, category: form.category,
      description: form.description, justification: form.justification,
      recurring: form.recurring,
      is_petty_cash: routing.isPettyCash, is_dual_approval: routing.isDualApproval,
      is_inter_entity: routing.isInterEntity,
      status: 'pending',
      ...(attachments.length > 0 ? { attachments } : {})
    }

    const { queued } = await dbWrite('funding_requests', 'insert', payload)

    await audit.submitted({
      tenant_id: profile!.tenant_id, actor_id: profile!.id,
      entity_type: 'funding_request', entity_id: profile!.id,
      entity_name: ref, after_snapshot: { ref, amount: amt, category: form.category }
    })

    setShowModal(false)
    setForm({ amount: '', category: '', description: '', justification: '', recurring: 'one-time' })
    setAttachFile(null)
    setAttachProgress('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!queued) load()
    setSubmitting(false)
  }

  async function handleAction(action: string) {
    if (action === 'rejected' && actionNote.length < 20) {
      toast('error', 'Reason too short', 'Rejection reason must be at least 20 characters.')
      return
    }
    setActionLoading(true)
    const r = actionModal

    const existingApprovals = r.request_approvals || []
    const routing = computeRouting({
      amount: parseFloat(r.amount), category: r.category, recurring: r.recurring, entityId: r.entity_id,
      pettyCashLimit, dualApprovalThreshold, rules,
    })
    const { canApprove: mayApprove, reason } = canUserAct({
      routing, userId: profile!.id, userRank: effectiveRank, userCanApprove: !!effectiveCanApprove, userCanEndorse: !!effectiveCanEndorse,
      existingApprovals,
    })

    if (action === 'approved' && !mayApprove) {
      toast('error', 'Cannot approve', reason || 'You are not authorized to approve this request.')
      setActionLoading(false)
      return
    }

    const approvedCount = existingApprovals.filter((a: any) => a.action === 'approved').length
    const newApprovalCount = approvedCount + (action === 'approved' ? 1 : 0)
    const fullyApproved = action === 'approved' && newApprovalCount >= routing.requiredApproversCount

    const before = { status: r.status }
    const newStatus = action === 'endorsed' ? 'endorsed'
      : action === 'rejected' ? 'rejected'
      : fullyApproved ? 'approved'
      : 'pending'

    await dbWrite('funding_requests', 'update', {
      status: newStatus,
      [`${action === 'endorsed' ? 'endorsed' : action === 'approved' ? 'approved' : 'rejection'}_by`]: profile!.id,
      rejection_reason: action === 'rejected' ? actionNote : null
    }, ['id', r.id])

    await supabase.from('request_approvals').insert({
      tenant_id: profile!.tenant_id, request_id: r.id,
      approver_id: profile!.id, action, note: actionNote || null
    })

    await audit[action === 'approved' ? 'approved' : action === 'rejected' ? 'rejected' : 'updated']({
      tenant_id: profile!.tenant_id, actor_id: profile!.id,
      entity_type: 'funding_request', entity_id: r.id, entity_name: r.ref,
      before_snapshot: before, after_snapshot: { status: newStatus }
    })

    await notify({
      tenant_id: profile!.tenant_id, user_id: r.requester_id,
      title: `Request ${r.ref} ${newStatus}`,
      body: actionNote || `Your request has been ${newStatus}.`,
      category: 'requests', action_url: '/requests',
      priority: action === 'rejected' ? 'high' : 'normal'
    })

    setActionModal(null)
    setActionNote('')
    load()
    setActionLoading(false)

    const toastMsg: Record<string, [string, string]> = {
      approved: ['Request approved', routing.isDualApproval && !fullyApproved ? `Waiting for approver ${newApprovalCount}/${routing.requiredApproversCount}.` : `${r.ref} has been approved.`],
      rejected: ['Request rejected', `${r.ref} has been rejected.`],
      endorsed: ['Request endorsed', `${r.ref} has been endorsed.`],
    }
    const [title, body] = toastMsg[action] || ['Done', '']
    toast(action === 'rejected' ? 'error' : 'success', title, body)
  }

  const staleCount = requests.filter(r => r.is_stale && ['pending','endorsed'].includes(r.status)).length
  const pendingReceipts = requests.filter(r => r.receipt_status === 'pending' && r.requester_id === profile?.id)

  // Receipt upload state
  const [receiptModal, setReceiptModal] = useState<any>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptUploading, setReceiptUploading] = useState(false)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  async function uploadReceipt() {
    if (!receiptFile || !receiptModal) return
    setReceiptUploading(true)
    try {
      const path = `${profile!.tenant_id}/receipts/${receiptModal.ref}/${receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('vela-documents').upload(path, receiptFile, { contentType: receiptFile.type, upsert: true })
      if (upErr) throw upErr
      const { data: signed } = await supabase.storage.from('vela-documents').createSignedUrl(path, 60 * 60 * 24 * 365)
      await supabase.from('funding_requests').update({
        receipt_url: signed?.signedUrl || path,
        receipt_status: 'uploaded',
        receipt_uploaded_at: new Date().toISOString(),
      }).eq('id', receiptModal.id)
      setReceiptModal(null)
      setReceiptFile(null)
      await load()
    } catch (e: any) {
      alert('Upload failed: ' + e.message)
    }
    setReceiptUploading(false)
  }

  function statusBadge(r: any) {
    const map: Record<string, string> = {
      pending: 'badge-pending', approved: 'badge-approved',
      rejected: 'badge-rejected', funded: 'badge-funded',
      endorsed: 'badge-active', expired: 'badge-draft'
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span className={`badge ${map[r.status] || 'badge-draft'}`}>{r.status}</span>
        {r.is_stale && <span title="Stale — 14+ days"><AlertCircle size={12} style={{ color: '#f97316' }} /></span>}
        {r.is_dual_approval && r.status === 'pending' && (() => {
          const routing = computeRouting({
            amount: parseFloat(r.amount), category: r.category, recurring: r.recurring, entityId: r.entity_id,
            pettyCashLimit, dualApprovalThreshold, rules,
          })
          return (
            <span style={{ fontSize: 'var(--text-micro)', color: 'var(--info)' }} title="Dual approval required">
              {r.request_approvals?.filter((a: any) => a.action === 'approved').length || 0}/{routing.requiredApproversCount}
            </span>
          )
        })()}
      </div>
    )
  }

  // Computed filtered + searched list
  const filtered = useMemo(() => {
    let r = requests
    if (filterStatus !== 'all') r = r.filter(x => x.status === filterStatus)
    if (search.trim()) {
      const s = search.toLowerCase()
      r = r.filter(x =>
        x.ref?.toLowerCase().includes(s) ||
        x.category?.toLowerCase().includes(s) ||
        x.description?.toLowerCase().includes(s) ||
        x.user_profiles?.full_name?.toLowerCase().includes(s)
      )
    }
    return r
  }, [requests, filterStatus, search])

  function exportCSV() {
    const rows = [
      ['Ref','Requester','Entity','Category','Amount','Status','Date'],
      ...filtered.map(r => [r.ref, r.user_profiles?.full_name||'', r.entities?.name||'', r.category, r.amount, r.status, new Date(r.created_at).toLocaleDateString()])
    ]
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `requests-${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  return (
    <Layout title="Funding Requests" action={
      <button className="btn-gold" onClick={() => setShowModal(true)} style={{ gap: '0.5rem' }}>
        <Plus size={16} /> Submit Request
      </button>
    }>
      {staleCount > 0 && (
        <div style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-small)', color: '#f97316' }}>
          <AlertCircle size={14} /> {staleCount} request{staleCount > 1 ? 's' : ''} have been pending for 14+ days and may need attention
        </div>
      )}

      {pendingReceipts.length > 0 && (
        <div style={{ background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', borderRadius: 10, padding: '0.875rem 1rem', marginBottom: '0.75rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontWeight: 600, fontSize: 'var(--text-small)', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 6 }}>
            🧾 {pendingReceipts.length} request{pendingReceipts.length > 1 ? 's' : ''} waiting for your receipt
          </p>
          <p style={{ margin: '0 0 0.625rem', fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
            Your approved request{pendingReceipts.length > 1 ? 's have' : ' has'} been funded. Please upload your receipt or proof of purchase to close {pendingReceipts.length > 1 ? 'them' : 'it'}.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {pendingReceipts.map(r => (
              <button key={r.id} className="btn-ghost"
                style={{ fontSize: 'var(--text-small)', gap: 5, borderColor: 'var(--gold-strong)', color: 'var(--gold)' }}
                onClick={() => { setReceiptModal(r); setReceiptFile(null) }}>
                🧾 {r.ref} — Upload Receipt
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by ref, category, description, requester…"
          style={{ flex: 1, minWidth: 200 }}
        />
        <TabBar>
          {(['all','pending','approved','rejected','endorsed','funded'] as const).map(s => (
            <button key={s} className={`tab ${filterStatus === s ? 'active' : ''}`}
              style={{ fontSize: 'var(--text-micro)', textTransform: 'capitalize', padding: '0.3rem 0.625rem' }}
              onClick={() => setFilterStatus(s)}>{s}
            </button>
          ))}
        </TabBar>
        <button className="btn-ghost" onClick={exportCSV}
          aria-label="Export as CSV"
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-small)', flexShrink: 0 }}>
          <Download size={13} /> CSV
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <table className="data-table"><tbody><SkeletonTable rows={6} cols={5} /></tbody></table>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Clock size={48} strokeWidth={1} /></div>
            <p className="empty-state-title">No requests yet</p>
            <p className="empty-state-body">Submit a funding request to get started</p>
            <button className="btn-gold" onClick={() => setShowModal(true)}>Submit First Request</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            {requests.length === 0
              ? <><div className="empty-state-icon"><Clock size={48} strokeWidth={1} /></div><p className="empty-state-title">No requests yet</p><p className="empty-state-body">Submit a funding request to get started</p><button className="btn-gold" onClick={() => setShowModal(true)}>Submit First Request</button></>
              : <><p className="empty-state-title">No requests match your filter</p><button className="btn-ghost" onClick={() => { setSearch(''); setFilterStatus('all') }}>Clear filters</button></>
            }
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Ref</th><th>Requested By</th><th>Entity</th><th>Category</th><th>Amount</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-small)', color: 'var(--gold)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {r.ref}
                        {Array.isArray(r.attachments) && r.attachments.length > 0 && (
                          <span title="Has attachment" style={{ fontSize: 'var(--text-micro)' }}>📎</span>
                        )}
                      </span>
                    </td>
                    <td>{r.user_profiles?.full_name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.entities?.name}</td>
                    <td>{r.category}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>USD {parseFloat(r.amount).toFixed(2)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {statusBadge(r)}
                        {r.receipt_status === 'uploaded' && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--success)' }}>🧾 Receipt</span>}
                        {r.receipt_status === 'pending' && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--warning)' }}>🧾 Receipt due</span>}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {['pending','endorsed'].includes(r.status) && r.requester_id !== profile?.id && (() => {
                          const routing = computeRouting({
                            amount: parseFloat(r.amount), category: r.category, recurring: r.recurring, entityId: r.entity_id,
                            pettyCashLimit, dualApprovalThreshold, rules,
                          })
                          const { canApprove: mayApprove, canEndorse: mayEndorse } = canUserAct({
                            routing, userId: profile!.id, userRank: effectiveRank, userCanApprove: !!effectiveCanApprove, userCanEndorse: !!effectiveCanEndorse,
                            existingApprovals: r.request_approvals || [],
                          })
                          return (mayApprove || mayEndorse) && (
                            <button className="btn-ghost" style={{ padding: '0.3rem 0.7rem', fontSize: 'var(--text-micro)' }} onClick={() => setActionModal(r)}>Review</button>
                          )
                        })()}
                        {r.receipt_status === 'pending' && r.requester_id === profile?.id && (
                          <button className="btn-ghost" style={{ padding: '0.3rem 0.7rem', fontSize: 'var(--text-micro)', color: 'var(--gold)', borderColor: 'var(--gold-strong)' }}
                            onClick={() => { setReceiptModal(r); setReceiptFile(null) }}>
                            🧾 Receipt
                          </button>
                        )}
                        {r.receipt_status === 'uploaded' && r.receipt_url && (
                          <a href={r.receipt_url} target="_blank" rel="noopener noreferrer"
                            className="btn-ghost" style={{ padding: '0.3rem 0.7rem', fontSize: 'var(--text-micro)', textDecoration: 'none' }}>View 🧾</a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submit Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => { setShowModal(false); setAttachFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }} role="dialog" aria-modal="true" aria-label="Submit funding request">
          <FocusTrap>
          <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-lead)', margin: '0 0 1.25rem' }}>Submit Funding Request</h3>
            <form onSubmit={submit}>
              {[
                { label: 'Amount (USD)', el: <input className="input" type="number" min="0.01" step="0.01" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" /> },
                { label: 'Category', el: <select className="input" required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option value="">Select...</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select> },
                { label: 'Description', el: <textarea className="input" required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="What is this for?" /> },
                { label: 'Justification', el: <textarea className="input" required value={form.justification} onChange={e => setForm({ ...form, justification: e.target.value })} rows={2} placeholder="Why is this needed?" /> },
                { label: 'Frequency', el: <select className="input" value={form.recurring} onChange={e => setForm({ ...form, recurring: e.target.value })}><option value="one-time">One-time</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select> },
              ].map(({ label, el }) => (
                <div key={label} style={{ marginBottom: '1rem' }}>
                  <label className="form-label">{label}</label>
                  {el}
                </div>
              ))}

              {/* Attachment */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Supporting Document (optional)</label>
                <div
                  style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '0.875rem', cursor: 'pointer', textAlign: 'center', background: attachFile ? 'var(--gold-wash)' : 'transparent', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {attachFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontSize: 'var(--text-small)', color: 'var(--gold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📎 {attachFile.name} ({(attachFile.size / 1024).toFixed(0)} KB)
                      </span>
                      <button type="button" onClick={ev => { ev.stopPropagation(); setAttachFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', flexShrink: 0, padding: '0.125rem' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p style={{ margin: 0, fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>📎 Tap to attach a photo, PDF or document</p>
                      <p style={{ margin: '3px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)', opacity: 0.7 }}>Images are compressed automatically. Max 10 MB.</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf,.doc,.docx,.xlsx,.csv"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    if (f.size > 10 * 1024 * 1024) { alert('File is too large. Maximum size is 10 MB.'); return }
                    setAttachFile(f)
                  }}
                />
                {attachProgress && (
                  <p style={{ margin: '0.375rem 0 0', fontSize: 'var(--text-micro)', color: 'var(--gold)' }}>{attachProgress}</p>
                )}
              </div>

              {form.amount && form.category && (() => {
                const preview = computeRouting({
                  amount: parseFloat(form.amount) || 0, category: form.category, recurring: form.recurring, entityId,
                  pettyCashLimit, dualApprovalThreshold, rules,
                })
                const requiredLevelName = preview.requiredRank != null
                  ? levels.find(l => l.rank === preview.requiredRank)?.name || `Rank ${preview.requiredRank}`
                  : null
                return (
                  <div style={{ background: 'var(--gold-dim)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
                    {preview.isInterEntity
                      ? `🏛️ Inter-entity transfer — requires ${requiredLevelName || 'Executive'} approval only`
                      : preview.isPettyCash
                        ? `⚡ Petty cash — direct dept. manager approval (below $${pettyCashLimit.toFixed(2)})`
                        : preview.isDualApproval
                          ? `🔒 Dual approval required (${preview.requiredApproversCount} approvers${requiredLevelName ? `, ${requiredLevelName}+` : ''})`
                          : requiredLevelName
                            ? `🔒 Requires ${requiredLevelName} approval or higher`
                            : '✓ Standard approval flow'}
                    {preview.matchedRules.length > 0 && (
                      <span style={{ display: 'block', marginTop: '0.3rem', fontSize: 'var(--text-micro)' }}>
                        Matched rule: {preview.matchedRules[0].rule_name}
                      </span>
                    )}
                  </div>
                )
              })()}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => { setShowModal(false); setAttachFile(null) }}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit'}</button>
              </div>
            </form>
          </div>
          </FocusTrap>
        </div>
      )}

      {/* Action Modal */}
      {actionModal && (
        <div className="modal-backdrop" onClick={() => setActionModal(null)} role="dialog" aria-modal="true" aria-label="Review request">
          <FocusTrap>
          <div className="card" style={{ width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-lead)', margin: '0 0 1.25rem' }}>Review Request</h3>
            <div style={{ background: 'var(--bg-800)', borderRadius: 8, padding: '0.875rem', marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.25rem', fontWeight: 600 }}>{actionModal.ref}</p>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>USD {parseFloat(actionModal.amount).toFixed(2)} · {actionModal.category}</p>
              <p style={{ margin: '0.5rem 0 0', fontSize: 'var(--text-small)' }}>{actionModal.description}</p>
              {(() => {
                const routing = computeRouting({
                  amount: parseFloat(actionModal.amount), category: actionModal.category, recurring: actionModal.recurring, entityId: actionModal.entity_id,
                  pettyCashLimit, dualApprovalThreshold, rules,
                })
                const requiredLevelName = routing.requiredRank != null
                  ? levels.find(l => l.rank === routing.requiredRank)?.name || `Rank ${routing.requiredRank}`
                  : null
                return (
                  <>
                    {routing.isDualApproval && (
                      <p style={{ margin: '0.5rem 0 0', fontSize: 'var(--text-micro)', color: 'var(--info)' }}>
                        Dual approval: {actionModal.request_approvals?.filter((a: any) => a.action === 'approved').length || 0}/{routing.requiredApproversCount} approvals received
                      </p>
                    )}
                    {requiredLevelName && (
                      <p style={{ margin: '0.5rem 0 0', fontSize: 'var(--text-micro)', color: 'var(--gold)' }}>
                        Requires {requiredLevelName} approval or higher
                      </p>
                    )}
                  </>
                )
              })()}
              {/* Attachments */}
              {Array.isArray(actionModal.attachments) && actionModal.attachments.length > 0 && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                  <p style={{ margin: '0 0 0.4rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Attachments</p>
                  {actionModal.attachments.map((att: any, i: number) => (
                    <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-small)', color: 'var(--gold)', textDecoration: 'none', padding: '0.25rem 0' }}
                      onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                      onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                      📎 {att.name}
                      {att.size && <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-micro)' }}>({(att.size / 1024).toFixed(0)} KB)</span>}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Note (required for rejection — min 20 chars)</label>
              <textarea className="input" rows={3} value={actionNote} onChange={e => setActionNote(e.target.value)} placeholder="Add a note..." />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn-ghost" onClick={() => setActionModal(null)}>Cancel</button>
              {(() => {
                const routing = computeRouting({
                  amount: parseFloat(actionModal.amount), category: actionModal.category, recurring: actionModal.recurring, entityId: actionModal.entity_id,
                  pettyCashLimit, dualApprovalThreshold, rules,
                })
                const { canApprove: mayApprove, canEndorse: mayEndorse, reason } = canUserAct({
                  routing, userId: profile!.id, userRank: effectiveRank, userCanApprove: !!effectiveCanApprove, userCanEndorse: !!effectiveCanEndorse,
                  existingApprovals: actionModal.request_approvals || [],
                })
                return (
                  <>
                    {mayEndorse && actionModal.status === 'pending' && (
                      <button className="btn-ghost" style={{ borderColor: 'var(--info)', color: 'var(--info)' }} onClick={() => handleAction('endorsed')} disabled={actionLoading}>Endorse</button>
                    )}
                    {mayApprove ? (
                      <>
                        <button style={{ background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid var(--danger-dim)', borderRadius: 8, padding: '0.625rem 1rem', cursor: 'pointer', fontSize: 'var(--text-small)' }} onClick={() => handleAction('rejected')} disabled={actionLoading}>Reject</button>
                        <button className="btn-gold" onClick={() => handleAction('approved')} disabled={actionLoading}>Approve</button>
                      </>
                    ) : reason ? (
                      <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)', alignSelf: 'center' }}>{reason}</p>
                    ) : null}
                  </>
                )
              })()}
            </div>
          </div>
          </FocusTrap>
        </div>
      )}

      {/* Receipt Upload Modal */}
      {receiptModal && (
        <div className="modal-backdrop" onClick={() => { setReceiptModal(null); setReceiptFile(null) }} role="dialog" aria-modal="true" aria-label="Upload receipt">
          <FocusTrap>
          <div className="card" style={{ width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-lead)', margin: '0 0 1.25rem' }}>Upload Receipt</h3>
            <div style={{ background: 'var(--bg-900)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem' }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-small)' }}>{receiptModal.ref}</p>
              <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>USD {parseFloat(receiptModal.amount).toFixed(2)} · {receiptModal.category}</p>
            </div>
            <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Please upload a receipt, invoice or proof of purchase for this approved request. Supported: photos, PDF, images.
            </p>

            <div
              style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '1.25rem', textAlign: 'center', cursor: 'pointer', marginBottom: '1rem', background: receiptFile ? 'var(--gold-wash)' : 'transparent', transition: 'border-color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              onClick={() => receiptInputRef.current?.click()}
            >
              {receiptFile ? (
                <div>
                  <p style={{ margin: 0, fontSize: 'var(--text-small)', color: 'var(--gold)', fontWeight: 600 }}>📎 {receiptFile.name}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{(receiptFile.size / 1024).toFixed(0)} KB · tap to change</p>
                </div>
              ) : (
                <div>
                  <p style={{ margin: 0, fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>📷 Tap to upload receipt photo or PDF</p>
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)', opacity: 0.7 }}>Max 10MB · Images compressed automatically</p>
                </div>
              )}
            </div>
            <input ref={receiptInputRef} type="file" accept="image/*,application/pdf"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f && f.size <= 10*1024*1024) setReceiptFile(f) }} />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn-ghost" style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}
                onClick={async () => { await supabase.from('funding_requests').update({ receipt_status: 'waived' }).eq('id', receiptModal.id); setReceiptModal(null); await load() }}>
                No receipt available
              </button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-ghost" onClick={() => { setReceiptModal(null); setReceiptFile(null) }}>Cancel</button>
                <button className="btn-gold" disabled={!receiptFile || receiptUploading} onClick={uploadReceipt}>
                  {receiptUploading ? 'Uploading…' : 'Upload Receipt'}
                </button>
              </div>
            </div>
          </div>
          </FocusTrap>
        </div>
      )}
    </Layout>
  )
}
