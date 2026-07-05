import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { dbWrite } from '../lib/offlineWrite'
import { Plus, X, CheckSquare, Target, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import TabBar from '../components/TabBar'

export default function WorkPage() {
  const { profile, post, activeEntityId } = useAuth()
  const [tab, setTab] = useState<'tasks' | 'targets'>('tasks')

  const level = post?.hierarchy_levels
  const canAssign = level?.can_assign_tasks
  const canSetTargets = level?.can_set_targets
  const entityId = activeEntityId || profile?.entity_id

  return (
    <Layout title="Tasks & Targets">
      <TabBar style={{ marginBottom: '1.25rem' }}>
        <button className={`tab ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckSquare size={14} /> Tasks
        </button>
        <button className={`tab ${tab === 'targets' ? 'active' : ''}`} onClick={() => setTab('targets')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Target size={14} /> Targets
        </button>
      </TabBar>
      {tab === 'tasks' ? <TasksTab profile={profile} post={post} entityId={entityId} canAssign={canAssign} /> : <TargetsTab profile={profile} post={post} entityId={entityId} canSet={canSetTargets} />}
    </Layout>
  )
}

function TasksTab({ profile, post, entityId, canAssign }: any) {
  const [tasks, setTasks] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [tabFilter, setTabFilter] = useState<'mine' | 'assigned'>('mine')
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', due_date: '', priority: 'Normal' })

  useEffect(() => { if (profile) { load(); loadUsers() } }, [profile])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('tasks')
      .select('*, assigned_by_profile:user_profiles!assigned_by(full_name), assigned_to_profile:user_profiles!assigned_to(full_name)')
      .eq('tenant_id', profile.tenant_id).order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  async function loadUsers() {
    const { data } = await supabase.from('user_profiles').select('id,full_name').eq('tenant_id', profile.tenant_id).eq('is_active', true).is('deleted_at', null)
    setUsers(data || [])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await dbWrite('tasks', 'insert', {
      tenant_id: profile.tenant_id, entity_id: entityId,
      assigned_by: profile.id, assigned_to: form.assigned_to || profile.id,
      title: form.title, description: form.description,
      due_date: form.due_date || null, priority: form.priority, status: 'open'
    })
    setShowModal(false)
    setForm({ title: '', description: '', assigned_to: '', due_date: '', priority: 'Normal' })
    load()
  }

  async function updateStatus(id: string, status: string) {
    const updatePayload: any = { status, progress: status === 'done' ? 100 : status === 'inprogress' ? 50 : 0 }
    if (status === 'done') updatePayload.completed_at = new Date().toISOString()
    await dbWrite('tasks', 'update', updatePayload, ['id', id])
    load()
  }

  const mine = tasks.filter(t => t.assigned_to === profile?.id)
  const assigned = tasks.filter(t => t.assigned_by === profile?.id && t.assigned_to !== profile?.id)
  const displayed = tabFilter === 'mine' ? mine : assigned

  const priColor: Record<string, string> = { Urgent: 'var(--danger)', High: 'var(--warning)', Normal: 'var(--text-muted)', Low: 'var(--text-muted)' }
  const statusMap: Record<string, string> = { open: 'badge-pending', inprogress: 'badge-funded', done: 'badge-approved', cancelled: 'badge-draft' }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <TabBar>
          <button className={`tab ${tabFilter === 'mine' ? 'active' : ''}`} style={{ fontSize: 'var(--text-small)' }} onClick={() => setTabFilter('mine')}>My Tasks ({mine.length})</button>
          {canAssign && <button className={`tab ${tabFilter === 'assigned' ? 'active' : ''}`} style={{ fontSize: 'var(--text-small)' }} onClick={() => setTabFilter('assigned')}>Assigned ({assigned.length})</button>}
        </TabBar>
        {canAssign && <button className="btn-gold" style={{ fontSize: 'var(--text-small)', gap: 5 }} onClick={() => setShowModal(true)}><Plus size={14} /> New Task</button>}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
          : displayed.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><CheckSquare size={40} strokeWidth={1} /></div>
              <p className="empty-state-title">No tasks here</p>
              {canAssign && <button className="btn-gold" onClick={() => setShowModal(true)}>Create Task</button>}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Task</th><th>Assigned To/By</th><th>Priority</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {displayed.map(t => (
                    <tr key={t.id}>
                      <td>
                        <p style={{ margin: 0, fontWeight: 500, fontSize: 'var(--text-small)' }}>{t.title}</p>
                        {t.description && <p style={{ margin: '2px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{t.description}</p>}
                      </td>
                      <td style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
                        {tabFilter === 'mine' ? t.assigned_by_profile?.full_name : t.assigned_to_profile?.full_name}
                      </td>
                      <td><span style={{ fontSize: 'var(--text-micro)', color: priColor[t.priority] || 'var(--text-muted)', fontWeight: 600 }}>{t.priority}</span></td>
                      <td style={{ fontSize: 'var(--text-small)', color: t.due_date && new Date(t.due_date) < new Date() ? 'var(--danger)' : 'var(--text-muted)' }}>{t.due_date || '—'}</td>
                      <td><span className={`badge ${statusMap[t.status] || 'badge-draft'}`}>{t.status}</span></td>
                      <td>
                        {t.assigned_to === profile?.id && t.status !== 'done' && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            {t.status === 'open' && <button className="btn-ghost" style={{ fontSize: 'var(--text-micro)', padding: '0.2rem 0.5rem' }} onClick={() => updateStatus(t.id, 'inprogress')}>Start</button>}
                            {t.status === 'inprogress' && <button className="btn-gold" style={{ fontSize: 'var(--text-micro)', padding: '0.2rem 0.5rem' }} onClick={() => updateStatus(t.id, 'done')}>Done</button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-body)' }}>New Task</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={submit}>
              {[
                { label: 'Title *', el: <input className="input" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /> },
                { label: 'Description', el: <textarea className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /> },
                { label: 'Assign To', el: <select className="input" value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}><option value="">Myself</option>{users.filter(u => u.id !== profile?.id).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select> },
                { label: 'Priority', el: <select className="input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>{['Low','Normal','High','Urgent'].map(p => <option key={p}>{p}</option>)}</select> },
                { label: 'Due Date', el: <input className="input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /> },
              ].map(({ label, el }) => <div key={label} style={{ marginBottom: '1rem' }}><label className="form-label">{label}</label>{el}</div>)}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function TargetsTab({ profile, post, entityId, canSet }: any) {
  const [targets, setTargets] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', deadline: '', target_type: 'Sales', target_value: '', unit: '' })

  useEffect(() => { if (profile) { load(); loadUsers() } }, [profile])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('targets')
      .select('*, set_by_profile:user_profiles!set_by(full_name), assigned_to_profile:user_profiles!assigned_to(full_name)')
      .eq('tenant_id', profile.tenant_id).order('created_at', { ascending: false })
    setTargets(data || [])
    setLoading(false)
  }

  async function loadUsers() {
    const { data } = await supabase.from('user_profiles').select('id,full_name').eq('tenant_id', profile.tenant_id).eq('is_active', true).is('deleted_at', null)
    setUsers(data || [])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await dbWrite('targets', 'insert', {
      tenant_id: profile.tenant_id, entity_id: entityId,
      set_by: profile.id, assigned_to: form.assigned_to || profile.id,
      title: form.title, description: form.description, deadline: form.deadline || null,
      target_type: form.target_type, target_value: form.target_value ? parseFloat(form.target_value) : null,
      unit: form.unit, progress: 0
    })
    setShowModal(false)
    setForm({ title: '', description: '', assigned_to: '', deadline: '', target_type: 'Sales', target_value: '', unit: '' })
    load()
  }

  async function updateProgress(id: string, progress: number) {
    await dbWrite('targets', 'update', { progress, actual_value: progress }, ['id', id])
    load()
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        {canSet && <button className="btn-gold" style={{ fontSize: 'var(--text-small)', gap: 5 }} onClick={() => setShowModal(true)}><Plus size={14} /> Set Target</button>}
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
          : targets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Target size={40} strokeWidth={1} /></div>
              <p className="empty-state-title">No targets set</p>
              {canSet && <button className="btn-gold" onClick={() => setShowModal(true)}>Set First Target</button>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {targets.map(t => (
                <div key={t.id} style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-body)' }}>{t.title}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{t.target_type} · {t.assigned_to_profile?.full_name}</p>
                    </div>
                    <span style={{ fontSize: 'var(--text-small)', fontFamily: "'JetBrains Mono', monospace", color: 'var(--gold)', fontWeight: 600 }}>{t.progress || 0}%</span>
                  </div>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${t.progress || 0}%` }} />
                  </div>
                  {t.assigned_to === profile?.id && (t.progress || 0) < 100 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: '0.5rem' }}>
                      {[25, 50, 75, 100].map(p => (
                        <button key={p} className="btn-ghost" style={{ fontSize: 'var(--text-micro)', padding: '0.2rem 0.5rem', color: (t.progress || 0) >= p ? 'var(--gold)' : 'var(--text-muted)' }} onClick={() => updateProgress(t.id, p)}>{p}%</button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-body)' }}>Set Target</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={submit}>
              {[
                { label: 'Title *', el: <input className="input" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /> },
                { label: 'Type', el: <select className="input" value={form.target_type} onChange={e => setForm({ ...form, target_type: e.target.value })}>{['Sales','Revenue','Units','Calls','Tasks','Other'].map(t => <option key={t}>{t}</option>)}</select> },
                { label: 'Assign To', el: <select className="input" value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}><option value="">Myself</option>{users.filter(u => u.id !== profile?.id).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select> },
                { label: 'Target Value', el: <input className="input" type="number" value={form.target_value} onChange={e => setForm({ ...form, target_value: e.target.value })} placeholder="e.g. 10000" /> },
                { label: 'Unit', el: <input className="input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="e.g. USD, units, calls" /> },
                { label: 'Deadline', el: <input className="input" type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /> },
              ].map(({ label, el }) => <div key={label} style={{ marginBottom: '1rem' }}><label className="form-label">{label}</label>{el}</div>)}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold">Set Target</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
