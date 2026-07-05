import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Plus, X } from 'lucide-react'

export default function TargetsPage() {
  const { profile, post } = useAuth()
  const [targets, setTargets] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', deadline: '', target_type: 'Sales', target_value: '', unit: '', actual_value: '' })
  const [submitting, setSubmitting] = useState(false)

  const level = post?.hierarchy_levels
  const canSet = level?.can_set_targets

  useEffect(() => { if (profile) { load(); loadUsers() } }, [profile])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('targets')
      .select('*, set_by_profile:user_profiles!set_by(full_name), assigned_to_profile:user_profiles!assigned_to(full_name)')
      .eq('tenant_id', profile!.tenant_id)
      .order('created_at', { ascending: false })
    setTargets(data || [])
    setLoading(false)
  }

  async function loadUsers() {
    const { data } = await supabase.from('user_profiles').select('id,full_name').eq('tenant_id', profile!.tenant_id).eq('is_active', true)
    setUsers(data || [])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await supabase.from('targets').insert({
      tenant_id: profile!.tenant_id,
      entity_id: profile!.entity_id,
      set_by: profile!.id,
      assigned_to: form.assigned_to || profile!.id,
      title: form.title,
      description: form.description,
      deadline: form.deadline,
      target_type: form.target_type,
      target_value: form.target_value ? parseFloat(form.target_value) : null,
      unit: form.unit,
      progress: 0
    })
    setShowModal(false)
    setForm({ title: '', description: '', assigned_to: '', deadline: '', target_type: 'Sales', target_value: '', unit: '', actual_value: '' })
    load()
    setSubmitting(false)
  }

  async function updateProgress(id: string, progress: number, actual: number) {
    await supabase.from('targets').update({ progress, actual_value: actual }).eq('id', id)
    load()
  }

  function progressBar(pct: number) {
    const color = pct >= 100 ? 'var(--success)' : pct >= 60 ? 'var(--gold)' : 'var(--danger)'
    return (
      <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', width: '100%', minWidth: 80 }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
    )
  }

  return (
    <Layout title="Targets">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
        {canSet && (
          <button className="btn-gold" onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={16} /> Set Target
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gap: '0.875rem' }}>
          {targets.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>No targets set yet</div>
          ) : targets.map(t => (
            <div key={t.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-body)' }}>{t.title}</span>
                    <span style={{ fontSize: 'var(--text-micro)', background: 'var(--gold-soft)', color: 'var(--gold)', padding: '0.15rem 0.5rem', borderRadius: 4 }}>{t.target_type}</span>
                  </div>
                  {t.description && <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{t.description}</p>}
                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: 'var(--text-small)', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span>Assigned to: <strong style={{ color: 'var(--text-primary)' }}>{t.assigned_to_profile?.full_name}</strong></span>
                    <span>Deadline: <strong style={{ color: 'var(--text-primary)' }}>{t.deadline}</strong></span>
                    {t.target_value && <span>Target: <strong style={{ color: 'var(--text-primary)' }}>{t.actual_value || 0}/{t.target_value} {t.unit}</strong></span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 100 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-h3)', fontWeight: 700, color: t.progress >= 100 ? 'var(--success)' : 'var(--text-primary)' }}>
                    {t.progress}%
                  </span>
                </div>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                {progressBar(t.progress)}
              </div>
              {t.assigned_to === profile?.id && t.progress < 100 && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  {[25, 50, 75, 100].map(p => (
                    <button key={p} className="btn-ghost" style={{ padding: '0.25rem 0.6rem', fontSize: 'var(--text-micro)' }} onClick={() => updateProgress(t.id, p, t.target_value ? (t.target_value * p / 100) : 0)}>
                      {p}%
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 460, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-lead)', margin: 0 }}>Set Target</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={submit}>
              {[
                { label: 'Title', el: <input className="input" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Target title" /> },
                { label: 'Description', el: <textarea className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /> },
                { label: 'Assign To', el: <select className="input" value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}><option value="">Myself</option>{users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select> },
                { label: 'Deadline', el: <input className="input" type="date" required value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /> },
                { label: 'Type', el: <select className="input" value={form.target_type} onChange={e => setForm({ ...form, target_type: e.target.value })}><option>Sales</option><option>Revenue</option><option>Clients</option><option>General</option><option>KPI</option></select> },
                { label: 'Target Value', el: <input className="input" type="number" value={form.target_value} onChange={e => setForm({ ...form, target_value: e.target.value })} placeholder="e.g. 10000" /> },
                { label: 'Unit', el: <input className="input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="USD, units, calls..." /> },
              ].map(({ label, el }) => (
                <div key={label} style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>
                  {el}
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting ? 'Setting...' : 'Set Target'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
