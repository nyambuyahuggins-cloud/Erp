import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Plus, X } from 'lucide-react'
import TabBar from '../components/TabBar'

export default function TasksPage() {
  const { profile, post } = useAuth()
  const [tasks, setTasks] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', due_date: '', priority: 'Normal' })
  const [submitting, setSubmitting] = useState(false)
  const [tab, setTab] = useState<'mine' | 'assigned'>('mine')

  const level = post?.hierarchy_levels
  const canAssign = level?.can_assign_tasks

  useEffect(() => { if (profile) { load(); loadUsers() } }, [profile])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('tasks')
      .select('*, assigned_by_profile:user_profiles!assigned_by(full_name), assigned_to_profile:user_profiles!assigned_to(full_name), entities(name)')
      .eq('tenant_id', profile!.tenant_id)
      .order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  async function loadUsers() {
    const { data } = await supabase.from('user_profiles').select('id,full_name').eq('tenant_id', profile!.tenant_id).eq('is_active', true)
    setUsers(data || [])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await supabase.from('tasks').insert({
      tenant_id: profile!.tenant_id,
      entity_id: profile!.entity_id,
      assigned_by: profile!.id,
      assigned_to: form.assigned_to || profile!.id,
      title: form.title,
      description: form.description,
      due_date: form.due_date,
      priority: form.priority,
      status: 'open'
    })
    setShowModal(false)
    setForm({ title: '', description: '', assigned_to: '', due_date: '', priority: 'Normal' })
    load()
    setSubmitting(false)
  }

  async function updateStatus(id: string, status: string) {
    const updatePayload: any = { status, progress: status === 'done' ? 100 : status === 'inprogress' ? 50 : 0 }; if (status === 'done') updatePayload.completed_at = new Date().toISOString(); await supabase.from('tasks').update(updatePayload).eq('id', id)
    load()
  }

  const mine = tasks.filter(t => t.assigned_to === profile?.id)
  const assigned = tasks.filter(t => t.assigned_by === profile?.id && t.assigned_to !== profile?.id)
  const displayed = tab === 'mine' ? mine : assigned

  function priorityColor(p: string) {
    return p === 'Urgent' ? 'var(--danger)' : p === 'High' ? 'var(--warning)' : 'var(--text-muted)'
  }

  function statusBadge(s: string) {
    const map: Record<string, string> = { open: 'badge-pending', inprogress: 'badge-funded', done: 'badge-approved', confirmed: 'badge-active', cancelled: 'badge-draft' }
    return <span className={`badge ${map[s] || 'badge-draft'}`}>{s}</span>
  }

  return (
    <Layout title="Tasks">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <TabBar>
          <button className={`tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>My Tasks ({mine.length})</button>
          {canAssign && <button className={`tab ${tab === 'assigned' ? 'active' : ''}`} onClick={() => setTab('assigned')}>Assigned ({assigned.length})</button>}
        </TabBar>
        {canAssign && (
          <button className="btn-gold" onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={16} /> New Task
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Title</th><th>Priority</th><th>{tab === 'mine' ? 'Assigned By' : 'Assigned To'}</th><th>Due</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No tasks</td></tr>
                ) : displayed.map(t => (
                  <tr key={t.id}>
                    <td>
                      <p style={{ margin: 0, fontWeight: 500 }}>{t.title}</p>
                      {t.description && <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{t.description}</p>}
                    </td>
                    <td style={{ color: priorityColor(t.priority), fontWeight: 600, fontSize: 'var(--text-small)' }}>{t.priority}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{tab === 'mine' ? t.assigned_by_profile?.full_name : t.assigned_to_profile?.full_name}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{t.due_date}</td>
                    <td>{statusBadge(t.status)}</td>
                    <td>
                      {t.assigned_to === profile?.id && t.status === 'open' && (
                        <button className="btn-ghost" style={{ padding: '0.3rem 0.7rem', fontSize: 'var(--text-micro)' }} onClick={() => updateStatus(t.id, 'inprogress')}>Start</button>
                      )}
                      {t.assigned_to === profile?.id && t.status === 'inprogress' && (
                        <button className="btn-gold" style={{ padding: '0.3rem 0.7rem', fontSize: 'var(--text-micro)' }} onClick={() => updateStatus(t.id, 'done')}>Done</button>
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
          <div className="card" style={{ width: '100%', maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-lead)', margin: 0 }}>New Task</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={submit}>
              {[
                { label: 'Title', el: <input className="input" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Task title" /> },
                { label: 'Description', el: <textarea className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Optional details" /> },
                { label: 'Assign To', el: <select className="input" value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}><option value="">Myself</option>{users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select> },
                { label: 'Due Date', el: <input className="input" type="date" required value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /> },
                { label: 'Priority', el: <select className="input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option>Normal</option><option>High</option><option>Urgent</option></select> },
              ].map(({ label, el }) => (
                <div key={label} style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>
                  {el}
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
