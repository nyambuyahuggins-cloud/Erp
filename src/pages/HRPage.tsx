import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { dbWrite } from '../lib/offlineWrite'
import { notify } from '../lib/notify'
import {
  Plus, X, Heart,
  Download, Users, CheckSquare, Trash2, Receipt
} from 'lucide-react'
import TabBar from '../components/TabBar'

type HRTab = 'leave' | 'expenses' | 'complaints'

export default function HRPage() {
  const { profile, post, activeEntityId } = useAuth()
  const [tab, setTab] = useState<HRTab>('leave')

  const level = post?.hierarchy_levels
  const isManager = level && level.rank <= 2
  const entityId = activeEntityId || profile?.entity_id

  const tabs: { key: HRTab; label: string; icon: React.ReactNode }[] = [
    { key: 'leave', label: 'Leave', icon: <Heart size={13} /> },
    { key: 'expenses', label: 'Expenses', icon: <Receipt size={13} /> },
    { key: 'complaints', label: 'Complaints', icon: <CheckSquare size={13} /> },
  ]

  return (
    <Layout title="People" action={
      ['leave','complaints','expenses'].includes(tab) ? (
        <NewActionButton tab={tab} />
      ) : null
    }>
      <TabBar style={{ marginBottom: '1.25rem' }}>
        {tabs.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {t.icon}{t.label}
          </button>
        ))}
      </TabBar>

      {tab === 'leave'       && <LeaveTab       profile={profile} post={post} isManager={isManager} entityId={entityId} />}
      {tab === 'expenses'    && <ExpenseClaimsTab profile={profile} post={post} entityId={entityId} />}
      {tab === 'complaints'  && <ComplaintsTab  profile={profile} entityId={entityId} />}
    </Layout>
  )
}

// Small dummy component so the Layout action slot can trigger the modal in each tab
// (each tab manages its own modal internally with a ref/callback)
function NewActionButton({ tab }: { tab: HRTab }) {
  return null // each tab handles its own add button internally
}

/* ─── LEAVE TAB ───────────────────────────────────────────────────── */
function LeaveTab({ profile, post, isManager, entityId }: any) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ leave_type: 'Annual', start_date: '', end_date: '', reason: '', handover_notes: '' })
  const [dateError, setDateError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (profile) load() }, [profile])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('leave_requests')
      .select('*, user_profiles!requester_id(full_name), leave_approvals(id,approver_id,action)')
      .eq('tenant_id', profile.tenant_id).order('created_at', { ascending: false }).limit(200)
    setItems(data || [])
    setLoading(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setDateError('')
    if (form.end_date < form.start_date) { setDateError('End date must be on or after start date'); return }
    setSubmitting(true)
    const ref = `LV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,4).toUpperCase()}`
    await dbWrite('leave_requests', 'insert', { tenant_id: profile.tenant_id, ref, requester_id: profile.id, entity_id: entityId, ...form, status: 'pending', approvals_needed: 2, approvals_count: 0 })
    setShowModal(false); setForm({ leave_type: 'Annual', start_date: '', end_date: '', reason: '', handover_notes: '' }); load()
    setSubmitting(false)
  }

  async function approve(id: string) {
    const leave = items.find(l => l.id === id)
    if (!leave) return
    if (leave.leave_approvals?.some((a: any) => a.approver_id === profile.id && a.action === 'approved')) { alert('You have already approved this.'); return }
    const newCount = (leave.approvals_count || 0) + 1
    const newStatus = newCount >= (leave.approvals_needed || 2) ? 'approved' : 'pending'
    await dbWrite('leave_requests', 'update', { approvals_count: newCount, status: newStatus, ...(newCount === 1 ? { endorsed_by: profile.id } : { approved_by: profile.id, approved_at: new Date().toISOString() }) }, ['id', id])
    await supabase.from('leave_approvals').insert({ tenant_id: profile.tenant_id, leave_id: id, approver_id: profile.id, action: 'approved' })
    if (newStatus === 'approved') await notify({ tenant_id: profile.tenant_id, user_id: leave.requester_id, title: 'Leave Approved', body: `Your ${leave.leave_type} leave has been approved.`, category: 'hr', action_url: '/hr', priority: 'normal' })
    load()
  }

  async function reject(id: string) {
    const leave = items.find(l => l.id === id)
    await dbWrite('leave_requests', 'update', { status: 'rejected', rejected_by: profile.id }, ['id', id])
    await supabase.from('leave_approvals').insert({ tenant_id: profile.tenant_id, leave_id: id, approver_id: profile.id, action: 'rejected' })
    if (leave) await notify({ tenant_id: profile.tenant_id, user_id: leave.requester_id, title: 'Leave Rejected', body: `Your ${leave.leave_type} leave request was rejected.`, category: 'hr', action_url: '/hr', priority: 'high' })
    load()
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn-gold" style={{ fontSize: 'var(--text-small)', gap: 5 }} onClick={() => setShowModal(true)}><Plus size={14} />Apply Leave</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
          : items.length === 0 ? <div className="empty-state"><div className="empty-state-icon"><Heart size={40} strokeWidth={1} /></div><p className="empty-state-title">No leave requests</p><button className="btn-gold" onClick={() => setShowModal(true)}>Apply for Leave</button></div>
          : <div style={{ overflowX: 'auto' }}><table className="data-table">
              <thead><tr><th>Ref</th><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Status</th><th>Approvals</th><th>Actions</th></tr></thead>
              <tbody>{items.map(l => (
                <tr key={l.id}>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-small)', color: 'var(--gold)' }}>{l.ref}</td>
                  <td>{l.user_profiles?.full_name}</td><td>{l.leave_type}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{l.start_date}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{l.end_date}</td>
                  <td><span className={`badge badge-${l.status === 'approved' ? 'approved' : l.status === 'rejected' ? 'rejected' : 'pending'}`}>{l.status}</span></td>
                  <td style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>{l.approvals_count || 0}/{l.approvals_needed || 2}</td>
                  <td>{isManager && l.status === 'pending' && l.requester_id !== profile?.id && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-gold" style={{ padding: '0.25rem 0.6rem', fontSize: 'var(--text-micro)' }} onClick={() => approve(l.id)}>Approve</button>
                      <button onClick={() => reject(l.id)} style={{ padding: '0.25rem 0.6rem', fontSize: 'var(--text-micro)', background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid var(--danger-dim)', borderRadius: 6, cursor: 'pointer' }}>Reject</button>
                    </div>
                  )}</td>
                </tr>
              ))}</tbody>
            </table></div>}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 420, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", margin: 0, fontSize: 'var(--text-body)' }}>Leave Application</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={submit}>
              <div style={{ marginBottom: '1rem' }}><label className="form-label">Type</label>
                <select className="input" value={form.leave_type} onChange={e => setForm({ ...form, leave_type: e.target.value })}>
                  {['Annual','Sick','Maternity','Paternity','Study','Unpaid'].map(t => <option key={t}>{t}</option>)}
                </select></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div><label className="form-label">Start</label><input className="input" type="date" required value={form.start_date} onChange={e => { setForm({ ...form, start_date: e.target.value }); setDateError('') }} /></div>
                <div><label className="form-label">End</label><input className="input" type="date" required min={form.start_date} value={form.end_date} onChange={e => { setForm({ ...form, end_date: e.target.value }); setDateError('') }} /></div>
              </div>
              {dateError && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)', marginBottom: '0.75rem' }}>{dateError}</p>}
              <div style={{ marginBottom: '1rem' }}><label className="form-label">Reason</label><textarea className="input" rows={2} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
              <div style={{ marginBottom: '1.25rem' }}><label className="form-label">Handover Notes</label><textarea className="input" rows={2} placeholder="Who covers your duties?" value={form.handover_notes} onChange={e => setForm({ ...form, handover_notes: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting ? 'Applying...' : 'Apply'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── COMPLAINTS TAB ──────────────────────────────────────────────── */
function ComplaintsTab({ profile, entityId }: any) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ category: 'Workplace', description: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (profile) load() }, [profile])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('complaints').select('*').eq('tenant_id', profile.tenant_id).order('created_at', { ascending: false }).limit(200)
    setItems(data || []); setLoading(false)
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true)
    await dbWrite('complaints', 'insert', { tenant_id: profile.tenant_id, ref: `CP-${Date.now().toString(36).toUpperCase()}`, ...form, status: 'received' })
    setShowModal(false); load(); setSubmitting(false)
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn-gold" style={{ fontSize: 'var(--text-small)', gap: 5 }} onClick={() => setShowModal(true)}><Plus size={14} />Submit Complaint</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
          : items.length === 0 ? <div className="empty-state"><p className="empty-state-title">No complaints on record</p></div>
          : <div style={{ overflowX: 'auto' }}><table className="data-table">
              <thead><tr><th>Ref</th><th>Category</th><th>Description</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>{items.map(c => (<tr key={c.id}><td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-small)', color: 'var(--gold)' }}>{c.ref}</td><td>{c.category}</td><td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description}</td><td><span className={`badge badge-${c.status === 'resolved' ? 'approved' : c.status === 'dismissed' ? 'draft' : 'pending'}`}>{c.status}</span></td><td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{new Date(c.created_at).toLocaleDateString()}</td></tr>))}</tbody>
            </table></div>}
      </div>
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", margin: 0, fontSize: 'var(--text-body)' }}>Submit Complaint</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={submit}>
              <div style={{ marginBottom: '1rem' }}><label className="form-label">Category</label><select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{['Workplace','Management','Customer','Safety','Other'].map(c => <option key={c}>{c}</option>)}</select></div>
              <div style={{ marginBottom: '1.25rem' }}><label className="form-label">Description</label><textarea className="input" required rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the issue..." /></div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

/* ── EXPENSE CLAIMS TAB ─────────────────────────────────────────────── */
function ExpenseClaimsTab({ profile, post, entityId }: any) {
  const [claims, setClaims] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editClaim, setEditClaim] = useState<any>(null)
  const [form, setForm] = useState({ category: 'Fuel', amount: '', description: '', currency: 'USD' })
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState<'all'|'pending'|'approved'|'rejected'>('all')

  const level = post?.hierarchy_levels
  const isManager = level && level.rank <= 2

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    setLoading(true)
    const q = supabase
      .from('expense_claims')
      .select('*, user_profiles!claimant_id(full_name), approver:user_profiles!approver_id(full_name)')
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200)
    const { data } = isManager ? await q : await q.eq('claimant_id', profile.id)
    setClaims(data || [])
    setLoading(false)
  }

  function openAdd() {
    setEditClaim(null)
    setForm({ category: 'Fuel', amount: '', description: '', currency: 'USD' })
    setShowModal(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true)
    if (editClaim) {
      await supabase.from('expense_claims').update({ category: form.category, amount: parseFloat(form.amount), description: form.description, currency: form.currency }).eq('id', editClaim.id)
    } else {
      await supabase.from('expense_claims').insert({ tenant_id: profile.tenant_id, entity_id: entityId, claimant_id: profile.id, category: form.category, amount: parseFloat(form.amount), description: form.description, currency: form.currency })
    }
    setShowModal(false); setEditClaim(null); await load(); setSubmitting(false)
  }

  async function action(id: string, status: 'approved' | 'rejected') {
    await supabase.from('expense_claims').update({ status, approver_id: profile.id, approved_at: new Date().toISOString() }).eq('id', id)
    await load()
  }

  const filtered = filter === 'all' ? claims : claims.filter(c => c.status === filter)
  const statusColor: Record<string,string> = { pending:'badge-pending', approved:'badge-approved', rejected:'badge-rejected', paid:'badge-paid' }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <TabBar>
          {(['all','pending','approved','rejected'] as const).map(f => (
            <button key={f} className={`tab ${filter===f?'active':''}`} style={{ fontSize:'0.78rem', textTransform:'capitalize' }} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </TabBar>
        <button className="btn-gold" style={{ fontSize:'0.8rem', gap:5 }} onClick={openAdd}><Plus size={13} />New Claim</button>
      </div>

      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {loading ? <div style={{ display:'flex', justifyContent:'center', padding:'2rem' }}><div className="spinner" /></div>
        : filtered.length === 0 ? <div className="empty-state"><p className="empty-state-title">No expense claims</p><button className="btn-gold" onClick={openAdd}>Submit First Claim</button></div>
        : <div style={{ overflowX:'auto' }}><table className="data-table">
            <thead><tr><th>Employee</th><th>Category</th><th>Amount</th><th>Description</th><th>Status</th><th>Date</th><th></th></tr></thead>
            <tbody>{filtered.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight:500 }}>{c.user_profiles?.full_name}</td>
                <td style={{ color:'var(--text-muted)' }}>{c.category}</td>
                <td style={{ fontFamily:"'JetBrains Mono',monospace", color:'var(--gold)', fontWeight:600 }}>{c.currency} {parseFloat(c.amount).toFixed(2)}</td>
                <td style={{ color:'var(--text-muted)', maxWidth:200 }}>{c.description}</td>
                <td><span className={`badge ${statusColor[c.status]||'badge-draft'}`}>{c.status}</span></td>
                <td style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                <td>
                  <div style={{ display:'flex', gap:4 }}>
                    {c.status === 'pending' && isManager && <>
                      <button className="btn-ghost" style={{ padding:'0.25rem 0.5rem', fontSize:'0.72rem', color:'var(--success)' }} onClick={() => action(c.id,'approved')}>Approve</button>
                      <button className="btn-ghost" style={{ padding:'0.25rem 0.5rem', fontSize:'0.72rem', color:'var(--danger)' }} onClick={() => action(c.id,'rejected')}>Reject</button>
                    </>}
                    {c.status === 'pending' && c.claimant_id === profile.id && (
                      <button className="btn-ghost" style={{ padding:'0.25rem 0.5rem', fontSize:'0.72rem' }} onClick={() => { setEditClaim(c); setForm({ category:c.category, amount:String(c.amount), description:c.description, currency:c.currency }); setShowModal(true) }}>Edit</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table></div>}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="card" style={{ width:'100%', maxWidth:400 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
              <h3 style={{ fontFamily:"'Playfair Display',serif", margin:0, fontSize:'1rem' }}>{editClaim?'Edit Claim':'New Expense Claim'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={submit}>
              <div style={{ marginBottom:'1rem' }}><label className="form-label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm({...form, category:e.target.value})}>
                  {['Fuel','Accommodation','Meals','Transport','Stationery','Equipment','Other'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1rem' }}>
                <div style={{ flex:1 }}><label className="form-label">Amount</label><input className="input" type="number" required min="0.01" step="0.01" value={form.amount} onChange={e => setForm({...form, amount:e.target.value})} /></div>
                <div style={{ width:90 }}><label className="form-label">Currency</label>
                  <select className="input" value={form.currency} onChange={e => setForm({...form, currency:e.target.value})}><option>USD</option><option>ZWG</option></select>
                </div>
              </div>
              <div style={{ marginBottom:'1.5rem' }}><label className="form-label">Description *</label>
                <textarea className="input" required rows={3} value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder="Describe the expense..." />
              </div>
              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting?'Saving...':editClaim?'Save':'Submit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
