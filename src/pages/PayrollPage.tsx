import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Plus, Download, X } from 'lucide-react'
import { dbWrite } from '../lib/offlineWrite'
import TabBar from '../components/TabBar'

export default function PayrollPage() {
  const { profile, post, activeEntityId } = useAuth()
  const [employees, setEmployees] = useState<any[]>([])
  const [runs, setRuns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'employees' | 'runs'>('employees')
  const [showEmpModal, setShowEmpModal] = useState(false)
  const [showRunModal, setShowRunModal] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [empForm, setEmpForm] = useState({ user_id: '', base_salary: '', housing_allowance: '', transport_allowance: '' })
  const [runPeriod, setRunPeriod] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const level = post?.hierarchy_levels
  const canAccess = level?.is_accounting || (level && level.rank <= 1)

  useEffect(() => { if (profile) { loadAll(); loadUsers() } }, [profile, tab])

  async function loadAll() {
    setLoading(true)
    const [empRes, runRes] = await Promise.all([
      supabase.from('payroll_employees').select('*, user_profiles!user_id(full_name, post_id), entities!entity_id(name)').eq('tenant_id', profile!.tenant_id).eq('is_active', true),
      supabase.from('payroll_runs').select('*, entities!entity_id(name), run_by_profile:user_profiles!run_by(full_name)').eq('tenant_id', profile!.tenant_id).order('created_at', { ascending: false })
    ])
    setEmployees(empRes.data || [])
    setRuns(runRes.data || [])
    setLoading(false)
  }

  async function loadUsers() {
    const { data } = await supabase.from('user_profiles').select('id,full_name').eq('tenant_id', profile!.tenant_id).eq('is_active', true)
    setUsers(data || [])
  }

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const { data: userProf } = await supabase.from('user_profiles').select('entity_id').eq('id', empForm.user_id).single()
    await supabase.from('payroll_employees').insert({
      tenant_id: profile!.tenant_id,
      user_id: empForm.user_id,
      entity_id: userProf?.entity_id || profile!.entity_id,
      base_salary: parseFloat(empForm.base_salary),
      housing_allowance: parseFloat(empForm.housing_allowance || '0'),
      transport_allowance: parseFloat(empForm.transport_allowance || '0'),
    })
    setShowEmpModal(false)
    setEmpForm({ user_id: '', base_salary: '', housing_allowance: '', transport_allowance: '' })
    loadAll()
    setSubmitting(false)
  }

  async function runPayroll(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    // FIX #10: filter by active entity
    const entityEmployees = employees.filter(e => !profile!.entity_id || e.entity_id === (activeEntityId || profile!.entity_id))
    const totalGross = entityEmployees.reduce((sum, e) => sum + parseFloat(e.base_salary) + parseFloat(e.housing_allowance || 0) + parseFloat(e.transport_allowance || 0), 0)
    const { data: run } = await supabase.from('payroll_runs').insert({
      tenant_id: profile!.tenant_id,
      entity_id: profile!.entity_id,
      period: runPeriod,
      status: 'draft',
      total_gross: totalGross,
      run_by: profile!.id
    }).select().single()

    if (run) {
      const entries = entityEmployees.map(emp => ({
        tenant_id: profile!.tenant_id,
        run_id: run.id,
        employee_id: emp.id,
        base_salary: parseFloat(emp.base_salary),
        housing_allowance: parseFloat(emp.housing_allowance || 0),
        transport_allowance: parseFloat(emp.transport_allowance || 0),
        gross_pay: parseFloat(emp.base_salary) + parseFloat(emp.housing_allowance || 0) + parseFloat(emp.transport_allowance || 0),
      }))
      await supabase.from('payroll_entries').insert(entries)
    }
    setShowRunModal(false)
    loadAll()
    setSubmitting(false)
  }

  async function exportCSV(run: any) {
    const { data: entries } = await supabase
      .from('payroll_entries')
      .select('*, payroll_employees!employee_id(user_profiles!user_id(full_name))')
      .eq('run_id', run.id)
    if (!entries) return
    const rows = [['Employee', 'Base Salary', 'Housing', 'Transport', 'Gross Pay']]
    entries.forEach(e => {
      rows.push([e.payroll_employees?.user_profiles?.full_name || '', e.base_salary, e.housing_allowance, e.transport_allowance, e.gross_pay])
    })
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `payroll-${run.period}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (!canAccess) return <Layout title="Payroll"><div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Access restricted to Accounting and Executives.</div></Layout>

  return (
    <Layout title="Payroll">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <TabBar>
          <button className={`tab ${tab === 'employees' ? 'active' : ''}`} onClick={() => setTab('employees')}>Employees ({employees.length})</button>
          <button className={`tab ${tab === 'runs' ? 'active' : ''}`} onClick={() => setTab('runs')}>Pay Runs ({runs.length})</button>
        </TabBar>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-ghost" onClick={() => setShowEmpModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-small)' }}>
            <Plus size={14} /> Add Employee
          </button>
          {employees.length > 0 && (
            <button className="btn-gold" onClick={() => setShowRunModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Run Payroll
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
        ) : tab === 'employees' ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Employee</th><th>Entity</th><th>Base Salary</th><th>Housing</th><th>Transport</th><th>Gross</th></tr></thead>
              <tbody>
                {employees.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No employees on payroll</td></tr>
                  : employees.map(e => {
                    const gross = parseFloat(e.base_salary) + parseFloat(e.housing_allowance || 0) + parseFloat(e.transport_allowance || 0)
                    return (
                      <tr key={e.id}>
                        <td style={{ fontWeight: 500 }}>{e.user_profiles?.full_name}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{e.entities?.name}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>USD {parseFloat(e.base_salary).toFixed(2)}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace', color: 'var(--text-muted)'" }}>USD {parseFloat(e.housing_allowance || 0).toFixed(2)}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>USD {parseFloat(e.transport_allowance || 0).toFixed(2)}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--gold)', fontWeight: 600 }}>USD {gross.toFixed(2)}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Period</th><th>Entity</th><th>Total Gross</th><th>Status</th><th>Run By</th><th>Date</th><th>Export</th></tr></thead>
              <tbody>
                {runs.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No payroll runs</td></tr>
                  : runs.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--gold)' }}>{r.period}</td>
                      <td>{r.entities?.name}</td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>USD {parseFloat(r.total_gross).toFixed(2)}</td>
                      <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{r.run_by_profile?.full_name}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                      <td>
                        <button className="btn-ghost" style={{ padding: '0.3rem 0.7rem', fontSize: 'var(--text-micro)', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => exportCSV(r)}>
                          <Download size={12} /> CSV
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEmpModal && (
        <div className="modal-backdrop" onClick={() => setShowEmpModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-lead)', margin: 0 }}>Add to Payroll</h3>
              <button onClick={() => setShowEmpModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={addEmployee}>
              {[
                { label: 'Employee', el: <select className="input" required value={empForm.user_id} onChange={e => setEmpForm({ ...empForm, user_id: e.target.value })}><option value="">Select employee...</option>{users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select> },
                { label: 'Base Salary (USD)', el: <input className="input" type="number" required min="0" step="0.01" value={empForm.base_salary} onChange={e => setEmpForm({ ...empForm, base_salary: e.target.value })} placeholder="0.00" /> },
                { label: 'Housing Allowance (USD)', el: <input className="input" type="number" min="0" step="0.01" value={empForm.housing_allowance} onChange={e => setEmpForm({ ...empForm, housing_allowance: e.target.value })} placeholder="0.00" /> },
                { label: 'Transport Allowance (USD)', el: <input className="input" type="number" min="0" step="0.01" value={empForm.transport_allowance} onChange={e => setEmpForm({ ...empForm, transport_allowance: e.target.value })} placeholder="0.00" /> },
              ].map(({ label, el }) => <div key={label} style={{ marginBottom: '1rem' }}><label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>{el}</div>)}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowEmpModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting ? 'Adding...' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRunModal && (
        <div className="modal-backdrop" onClick={() => setShowRunModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-lead)', margin: 0 }}>Run Payroll</h3>
              <button onClick={() => setShowRunModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)', marginBottom: '1rem' }}>
              This will generate a pay run for {employees.length} employee(s).
              Total gross: <strong style={{ color: 'var(--gold)' }}>USD {employees.reduce((s, e) => s + parseFloat(e.base_salary) + parseFloat(e.housing_allowance || 0) + parseFloat(e.transport_allowance || 0), 0).toFixed(2)}</strong>
            </p>
            <form onSubmit={runPayroll}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Pay Period</label>
                <input className="input" type="month" required value={runPeriod} onChange={e => setRunPeriod(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowRunModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting ? 'Running...' : 'Run Payroll'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
