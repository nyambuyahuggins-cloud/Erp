import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { dbWrite } from '../lib/offlineWrite'
import { notify } from '../lib/notify'
import {
  Plus, X, Heart, Wallet, Clock, LogIn, LogOut,
  Download, Users, CheckSquare, Trash2, Receipt
} from 'lucide-react'
import TabBar from '../components/TabBar'

type HRTab = 'leave' | 'timesheets' | 'payroll' | 'expenses' | 'complaints'

export default function HRPage() {
  const { profile, post, activeEntityId } = useAuth()
  const [tab, setTab] = useState<HRTab>('leave')

  const level = post?.hierarchy_levels
  const isManager = level && level.rank <= 2
  const isAccounting = level?.is_accounting
  const canSeePayroll = isAccounting || (level && level.rank <= 1)
  const entityId = activeEntityId || profile?.entity_id

  const tabs: { key: HRTab; label: string; icon: React.ReactNode }[] = [
    { key: 'leave', label: 'Leave', icon: <Heart size={13} /> },
    { key: 'timesheets', label: 'Timesheets', icon: <Clock size={13} /> },
    ...(canSeePayroll ? [{ key: 'payroll' as HRTab, label: 'Payroll', icon: <Wallet size={13} /> }] : []),
    { key: 'expenses' as HRTab, label: 'Expenses', icon: <Receipt size={13} /> },
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
      {tab === 'timesheets'  && <TimesheetsTab  profile={profile} post={post} isManager={isManager} entityId={entityId} />}
      {tab === 'payroll'     && <PayrollTab     profile={profile} post={post} activeEntityId={activeEntityId} />}
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

/* ─── TIMESHEETS TAB ──────────────────────────────────────────────── */
function TimesheetsTab({ profile, post, isManager, entityId }: any) {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeEntry, setActiveEntry] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [teamView, setTeamView] = useState(false)
  const [weekSummary, setWeekSummary] = useState({ total: 0, days: 0 })

  useEffect(() => { if (profile) { load(); checkActive() } }, [profile, teamView])

  async function load() {
    setLoading(true)
    let q = supabase.from('timesheet_entries')
      .select('*, user_profiles!user_id(full_name), entities!entity_id(name)')
      .eq('tenant_id', profile.tenant_id).order('clock_in', { ascending: false }).limit(100)
    if (!teamView) q = q.eq('user_id', profile.id)
    const { data } = await q
    setEntries(data || [])
    const now = new Date()
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0,0,0,0)
    const myWeek = (data || []).filter((e: any) => e.user_id === profile.id && e.clock_out && new Date(e.clock_in) >= startOfWeek)
    const totalHours = myWeek.reduce((s: number, e: any) => s + (parseFloat(e.hours_worked) || 0), 0)
    setWeekSummary({ total: totalHours, days: new Set(myWeek.map((e: any) => new Date(e.clock_in).toDateString())).size })
    setLoading(false)
  }

  async function checkActive() {
    const { data } = await supabase.from('timesheet_entries').select('*').eq('user_id', profile.id).is('clock_out', null).limit(1)
    setActiveEntry(data?.[0] || null)
  }

  async function clockIn() {
    if (activeEntry) return
    setSubmitting(true)
    await dbWrite('timesheet_entries', 'insert', { tenant_id: profile.tenant_id, user_id: profile.id, entity_id: entityId, clock_in: new Date().toISOString(), status: 'pending' })
    await checkActive(); load(); setSubmitting(false)
  }

  async function clockOut() {
    if (!activeEntry) return
    setSubmitting(true)
    await supabase.from('timesheet_entries').update({ clock_out: new Date().toISOString() }).eq('id', activeEntry.id)
    setActiveEntry(null); load(); setSubmitting(false)
  }

  async function approve(id: string) {
    await supabase.from('timesheet_entries').update({ status: 'approved', approved_by: profile.id, approved_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  function fmt(h: number | null) { if (!h) return '—'; const hrs = Math.floor(h); const m = Math.round((h-hrs)*60); return `${hrs}h ${m}m` }
  function fmtTime(ts: string) { return new Date(ts).toLocaleTimeString('en-ZW', { hour: '2-digit', minute: '2-digit' }) }
  function fmtDate(ts: string) { return new Date(ts).toLocaleDateString('en-ZW', { day: 'numeric', month: 'short' }) }

  return (
    <>
      {/* Clock in/out widget */}
      <div className="card" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{activeEntry ? 'Clocked In' : 'Not Clocked In'}</p>
          {activeEntry && <p style={{ margin: '2px 0 0', fontSize: 'var(--text-small)', color: 'var(--gold)' }}>Since {fmtTime(activeEntry.clock_in)} · {fmtDate(activeEntry.clock_in)}</p>}
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>This week</p>
            <p style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{fmt(weekSummary.total)} · {weekSummary.days}d</p>
          </div>
          {activeEntry
            ? <button className="btn-ghost" onClick={clockOut} disabled={submitting} style={{ gap: 5, borderColor: 'var(--danger)', color: 'var(--danger)' }}><LogOut size={14} />Clock Out</button>
            : <button className="btn-gold" onClick={clockIn} disabled={submitting} style={{ gap: 5 }}><LogIn size={14} />Clock In</button>}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        {isManager && (
          <TabBar>
            <button className={`tab ${!teamView ? 'active' : ''}`} style={{ fontSize: 'var(--text-small)' }} onClick={() => setTeamView(false)}>My Entries</button>
            <button className={`tab ${teamView ? 'active' : ''}`} style={{ fontSize: 'var(--text-small)' }} onClick={() => setTeamView(true)}>Team</button>
          </TabBar>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
          : entries.length === 0 ? <div className="empty-state"><div className="empty-state-icon"><Clock size={40} strokeWidth={1} /></div><p className="empty-state-title">No timesheet entries</p></div>
          : <div style={{ overflowX: 'auto' }}><table className="data-table">
              <thead><tr>{teamView && <th>Employee</th>}<th>Date</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th>{isManager && teamView && <th></th>}</tr></thead>
              <tbody>{entries.map(e => (
                <tr key={e.id}>
                  {teamView && <td style={{ fontWeight: 500 }}>{e.user_profiles?.full_name}</td>}
                  <td style={{ color: 'var(--text-muted)' }}>{fmtDate(e.clock_in)}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-small)' }}>{fmtTime(e.clock_in)}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-small)', color: e.clock_out ? 'inherit' : 'var(--gold)' }}>{e.clock_out ? fmtTime(e.clock_out) : '⏳'}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: 'var(--gold)' }}>{fmt(e.hours_worked ? parseFloat(e.hours_worked) : null)}</td>
                  <td><span className={`badge badge-${e.status === 'approved' ? 'approved' : e.status === 'rejected' ? 'rejected' : 'pending'}`}>{e.status}</span></td>
                  {isManager && teamView && <td>{e.status === 'pending' && e.clock_out && <button className="btn-gold" style={{ padding: '0.25rem 0.6rem', fontSize: 'var(--text-micro)' }} onClick={() => approve(e.id)}>Approve</button>}</td>}
                </tr>
              ))}</tbody>
            </table></div>}
      </div>
    </>
  )
}

/* ─── PAYROLL TAB ─────────────────────────────────────────────────── */
function PayrollTab({ profile, post, activeEntityId }: any) {
  const [employees, setEmployees] = useState<any[]>([])
  const [runs, setRuns] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState<'employees' | 'runs'>('employees')
  const [showEmpModal, setShowEmpModal] = useState(false)
  const [showRunModal, setShowRunModal] = useState(false)
  const [editEmp, setEditEmp] = useState<any>(null)
  const [empForm, setEmpForm] = useState({ user_id: '', base_salary: '', housing_allowance: '', transport_allowance: '' })
  const [runPeriod, setRunPeriod] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const level = post?.hierarchy_levels
  const canAccess = level?.is_accounting || (level && level.rank <= 1)

  useEffect(() => { if (profile && canAccess) { load(); loadUsers() } }, [profile, canAccess])

  async function load() {
    setLoading(true)
    const [empRes, runRes] = await Promise.all([
      supabase.from('payroll_employees').select('*, user_profiles!user_id(full_name), entities!entity_id(name)').eq('tenant_id', profile.tenant_id).eq('is_active', true).limit(500),
      supabase.from('payroll_runs').select('*, entities!entity_id(name), run_by_profile:user_profiles!run_by(full_name)').eq('tenant_id', profile.tenant_id).order('created_at', { ascending: false }).limit(50)
    ])
    setEmployees(empRes.data || []); setRuns(runRes.data || []); setLoading(false)
  }

  async function loadUsers() {
    const { data } = await supabase.from('user_profiles').select('id,full_name').eq('tenant_id', profile.tenant_id).eq('is_active', true).is('deleted_at', null)
    setUsers(data || [])
  }

  function openAdd() { setEditEmp(null); setEmpForm({ user_id: '', base_salary: '', housing_allowance: '', transport_allowance: '' }); setShowEmpModal(true) }
  function openEdit(emp: any) {
    setEditEmp(emp)
    setEmpForm({ user_id: emp.user_id, base_salary: String(emp.base_salary), housing_allowance: String(emp.housing_allowance || 0), transport_allowance: String(emp.transport_allowance || 0) })
    setShowEmpModal(true)
  }

  async function saveEmployee(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true)
    if (editEmp) {
      await supabase.from('payroll_employees').update({ base_salary: parseFloat(empForm.base_salary), housing_allowance: parseFloat(empForm.housing_allowance || '0'), transport_allowance: parseFloat(empForm.transport_allowance || '0') }).eq('id', editEmp.id)
    } else {
      const { data: up } = await supabase.from('user_profiles').select('entity_id').eq('id', empForm.user_id).single()
      await supabase.from('payroll_employees').insert({ tenant_id: profile.tenant_id, user_id: empForm.user_id, entity_id: up?.entity_id || profile.entity_id, base_salary: parseFloat(empForm.base_salary), housing_allowance: parseFloat(empForm.housing_allowance || '0'), transport_allowance: parseFloat(empForm.transport_allowance || '0') })
    }
    setShowEmpModal(false); setEditEmp(null); await load(); setSubmitting(false)
  }

  async function removeEmployee(id: string) {
    if (!confirm('Remove this employee from payroll?')) return
    await supabase.from('payroll_employees').update({ is_active: false }).eq('id', id)
    await load()
  }

  async function runPayroll(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true)
    const entityEmps = employees.filter(emp => !activeEntityId || emp.entity_id === activeEntityId)
    const totalGross = entityEmps.reduce((s, e) => s + parseFloat(e.base_salary) + parseFloat(e.housing_allowance || 0) + parseFloat(e.transport_allowance || 0), 0)
    const { data: run } = await supabase.from('payroll_runs').insert({ tenant_id: profile.tenant_id, entity_id: activeEntityId || profile.entity_id, period: runPeriod, status: 'draft', total_gross: totalGross, run_by: profile.id }).select().single()
    if (run) await supabase.from('payroll_entries').insert(entityEmps.map(emp => ({ tenant_id: profile.tenant_id, run_id: run.id, employee_id: emp.id, base_salary: parseFloat(emp.base_salary), housing_allowance: parseFloat(emp.housing_allowance || 0), transport_allowance: parseFloat(emp.transport_allowance || 0), gross_pay: parseFloat(emp.base_salary) + parseFloat(emp.housing_allowance || 0) + parseFloat(emp.transport_allowance || 0) })))
    setShowRunModal(false); await load(); setSubmitting(false)
  }

  async function exportCSV(run: any) {
    const { data: entries } = await supabase.from('payroll_entries').select('*, payroll_employees!employee_id(user_profiles!user_id(full_name))').eq('run_id', run.id)
    if (!entries) return
    const rows = [['Employee','Base Salary','Housing','Transport','Gross Pay'], ...entries.map(e => [e.payroll_employees?.user_profiles?.full_name || '', e.base_salary, e.housing_allowance, e.transport_allowance, e.gross_pay])]
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `payroll-${run.period}.csv`; a.click()
  }

  if (!canAccess) return <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Payroll access is restricted to Accounting and Executives.</div>

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <TabBar>
          <button className={`tab ${subTab === 'employees' ? 'active' : ''}`} style={{ fontSize: 'var(--text-small)' }} onClick={() => setSubTab('employees')}>Employees ({employees.length})</button>
          <button className={`tab ${subTab === 'runs' ? 'active' : ''}`} style={{ fontSize: 'var(--text-small)' }} onClick={() => setSubTab('runs')}>Pay Runs</button>
        </TabBar>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-ghost" style={{ fontSize: 'var(--text-small)', gap: 5 }} onClick={openAdd}><Plus size={13} />Add Employee</button>
          {employees.length > 0 && <button className="btn-gold" style={{ fontSize: 'var(--text-small)', gap: 5 }} onClick={() => setShowRunModal(true)}>Run Payroll</button>}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
          : subTab === 'employees' ? (
            employees.length === 0 ? <div className="empty-state"><div className="empty-state-icon"><Wallet size={40} strokeWidth={1} /></div><p className="empty-state-title">No employees on payroll</p><button className="btn-gold" onClick={openAdd}>Add First Employee</button></div>
            : <div style={{ overflowX: 'auto' }}><table className="data-table">
                <thead><tr><th>Employee</th><th>Entity</th><th>Base</th><th>Housing</th><th>Transport</th><th>Gross</th><th></th></tr></thead>
                <tbody>{employees.map(e => {
                  const gross = parseFloat(e.base_salary) + parseFloat(e.housing_allowance || 0) + parseFloat(e.transport_allowance || 0)
                  return (<tr key={e.id}>
                    <td style={{ fontWeight: 500 }}>{e.user_profiles?.full_name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{e.entities?.name}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>USD {parseFloat(e.base_salary).toFixed(2)}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>USD {parseFloat(e.housing_allowance || 0).toFixed(2)}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>USD {parseFloat(e.transport_allowance || 0).toFixed(2)}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--gold)', fontWeight: 600 }}>USD {gross.toFixed(2)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--text-micro)' }} onClick={() => openEdit(e)}>Edit</button>
                        <button onClick={() => removeEmployee(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.25rem' }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>)
                })}</tbody>
              </table></div>
          ) : (
            runs.length === 0 ? <div className="empty-state"><p className="empty-state-title">No payroll runs yet</p></div>
            : <div style={{ overflowX: 'auto' }}><table className="data-table">
                <thead><tr><th>Period</th><th>Entity</th><th>Total Gross</th><th>Status</th><th>Run By</th><th>Date</th><th></th></tr></thead>
                <tbody>{runs.map(r => (<tr key={r.id}><td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--gold)' }}>{r.period}</td><td>{r.entities?.name}</td><td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>USD {parseFloat(r.total_gross).toFixed(2)}</td><td><span className={`badge badge-${r.status === 'paid' ? 'paid' : r.status === 'approved' ? 'approved' : 'draft'}`}>{r.status}</span></td><td style={{ color: 'var(--text-muted)' }}>{r.run_by_profile?.full_name}</td><td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{new Date(r.created_at).toLocaleDateString()}</td><td><button className="btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: 'var(--text-micro)', gap: 4 }} onClick={() => exportCSV(r)}><Download size={12} />CSV</button></td></tr>))}</tbody>
              </table></div>
          )}
      </div>

      {showEmpModal && (
        <div className="modal-backdrop" onClick={() => setShowEmpModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", margin: 0, fontSize: 'var(--text-body)' }}>{editEmp ? 'Edit Payroll Record' : 'Add to Payroll'}</h3>
              <button onClick={() => setShowEmpModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={saveEmployee}>
              {!editEmp && (
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Employee</label>
                  <select className="input" required value={empForm.user_id} onChange={e => setEmpForm({ ...empForm, user_id: e.target.value })}>
                    <option value="">Select...</option>{users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
              )}
              {editEmp && <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', marginBottom: '1rem' }}>Editing: <strong>{editEmp.user_profiles?.full_name}</strong></p>}
              {[
                { label: 'Base Salary (USD)', field: 'base_salary' },
                { label: 'Housing Allowance (USD)', field: 'housing_allowance' },
                { label: 'Transport Allowance (USD)', field: 'transport_allowance' },
              ].map(({ label, field }) => (
                <div key={field} style={{ marginBottom: '1rem' }}>
                  <label className="form-label">{label}</label>
                  <input className="input" type="number" min="0" step="0.01" value={empForm[field as keyof typeof empForm]} onChange={e => setEmpForm({ ...empForm, [field]: e.target.value })} placeholder="0.00" />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowEmpModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting ? 'Saving...' : editEmp ? 'Save Changes' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRunModal && (
        <div className="modal-backdrop" onClick={() => setShowRunModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", margin: 0, fontSize: 'var(--text-body)' }}>Run Payroll</h3>
              <button onClick={() => setShowRunModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)', marginBottom: '1rem' }}>
              {employees.length} employee(s) · Total gross: <strong style={{ color: 'var(--gold)' }}>USD {employees.reduce((s, e) => s + parseFloat(e.base_salary) + parseFloat(e.housing_allowance || 0) + parseFloat(e.transport_allowance || 0), 0).toFixed(2)}</strong>
            </p>
            <form onSubmit={runPayroll}>
              <div style={{ marginBottom: '1.25rem' }}><label className="form-label">Pay Period</label><input className="input" type="month" required value={runPeriod} onChange={e => setRunPeriod(e.target.value)} /></div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowRunModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting ? 'Running...' : 'Run'}</button>
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
