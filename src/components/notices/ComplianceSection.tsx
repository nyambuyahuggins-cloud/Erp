import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { CalendarClock, Plus, X, Trash2, CheckCircle2 } from 'lucide-react'
import TabBar from '../TabBar'
import { useEscapeKey } from '../../hooks/useEscapeKey'

/* ── COMPLIANCE CALENDAR ───────────────────────────────────────── */
const STATUS_COLOR: Record<string, string> = {
  upcoming: 'var(--warning)', overdue: '#ef4444', completed: 'var(--success)', waived: '#6b7280',
}

export default function ComplianceSection({ profile, isAdmin }: { profile: any; isAdmin: boolean }) {
  const [items, setItems]     = useState<any[]>([])
  const [users, setUsers]     = useState<any[]>([])
  const [entities, setEntities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem]   = useState<any>(null)
  const [form, setForm] = useState({
    title: '', category: 'License', due_date: '', responsible_id: '',
    entity_id: '', recurrence: 'none', notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'overdue' | 'completed'>('all')
  useEscapeKey(() => setShowModal(false))

  useEffect(() => {
    if (profile) { load(); if (isAdmin) { loadUsers(); loadEntities() } }
  }, [profile])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('compliance_items')
      .select('*, user_profiles!responsible_id(full_name), entities!entity_id(name)')
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .order('due_date')
    setItems(data || []); setLoading(false)
  }
  async function loadUsers() {
    const { data } = await supabase.from('user_profiles').select('id,full_name').eq('tenant_id', profile.tenant_id).eq('is_active', true)
    setUsers(data || [])
  }
  async function loadEntities() {
    const { data } = await supabase.from('entities').select('id,name').eq('tenant_id', profile.tenant_id).is('deleted_at', null)
    setEntities(data || [])
  }

  function openAdd() {
    setEditItem(null)
    setForm({ title: '', category: 'License', due_date: '', responsible_id: '', entity_id: '', recurrence: 'none', notes: '' })
    setShowModal(true)
  }
  function openEdit(c: any) {
    setEditItem(c)
    setForm({ title: c.title, category: c.category, due_date: c.due_date, responsible_id: c.responsible_id || '', entity_id: c.entity_id || '', recurrence: c.recurrence || 'none', notes: c.notes || '' })
    setShowModal(true)
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true)
    const payload = { title: form.title, category: form.category, due_date: form.due_date, responsible_id: form.responsible_id || null, entity_id: form.entity_id || null, recurrence: form.recurrence, notes: form.notes || null }
    if (editItem) await supabase.from('compliance_items').update(payload).eq('id', editItem.id)
    else await supabase.from('compliance_items').insert({ tenant_id: profile.tenant_id, ...payload })
    setShowModal(false); setEditItem(null); await load(); setSubmitting(false)
  }
  async function markDone(id: string) {
    await supabase.from('compliance_items').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id)
    await load()
  }
  async function del(id: string) {
    if (!confirm('Delete this item?')) return
    await supabase.from('compliance_items').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    await load()
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter)

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <TabBar>
          {(['all', 'upcoming', 'overdue', 'completed'] as const).map(f => (
            <button key={f} className={`tab ${filter === f ? 'active' : ''}`}
              style={{ fontSize: 'var(--text-small)', textTransform: 'capitalize' }}
              onClick={() => setFilter(f)}>{f === 'all' ? `All (${items.length})` : f}
            </button>
          ))}
        </TabBar>
        {isAdmin && <button className="btn-gold" style={{ gap: 5, flexShrink: 0 }} onClick={openAdd}><Plus size={14} />Add Item</button>}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <CalendarClock size={32} style={{ color: 'var(--gold)', opacity: 0.3 }} />
          <p className="empty-state-title">{filter === 'all' ? 'No compliance items' : `No ${filter} items`}</p>
          {isAdmin && filter === 'all' && <button className="btn-gold" onClick={openAdd}>Add First Item</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {filtered.map(c => {
            const daysLeft = Math.ceil((new Date(c.due_date).getTime() - Date.now()) / 86400000)
            const sc = STATUS_COLOR[c.status] || '#6b7280'
            return (
              <div key={c.id} className="card" style={{ borderLeft: `3px solid ${sc}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--text-micro)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: sc }}>{c.status}</span>
                      <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{c.category}</span>
                      {c.recurrence !== 'none' && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>· {c.recurrence}</span>}
                    </div>
                    <p style={{ margin: '0 0 0.3rem', fontSize: 'var(--text-body)', fontWeight: 600 }}>{c.title}</p>
                    <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
                      Due {new Date(c.due_date).toLocaleDateString()}
                      {c.status !== 'completed' && (
                        <span style={{ color: daysLeft < 0 ? '#ef4444' : daysLeft <= 7 ? 'var(--warning)' : 'var(--text-muted)' }}>
                          {' '}({daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Today' : `${daysLeft}d left`})
                        </span>
                      )}
                      {c.user_profiles?.full_name && ` · ${c.user_profiles.full_name}`}
                      {c.entities?.name && ` · ${c.entities.name}`}
                    </p>
                    {c.notes && <p style={{ margin: '0.3rem 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)', fontStyle: 'italic' }}>{c.notes}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {isAdmin && c.status !== 'completed' && (
                      <button className="btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--text-micro)', color: 'var(--success)' }}
                        onClick={() => markDone(c.id)} title="Mark as done">
                        <CheckCircle2 size={13} />
                      </button>
                    )}
                    {isAdmin && <button className="btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--text-micro)' }} onClick={() => openEdit(c)}>Edit</button>}
                    {isAdmin && <button onClick={() => del(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.25rem' }}><Trash2 size={13} /></button>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)} role="dialog" aria-modal="true" aria-label="Compliance item form">
          <div className="card" style={{ width: '100%', maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", margin: 0, fontSize: 'var(--text-body)' }}>{editItem ? 'Edit Item' : 'Add Compliance Item'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={save}>
              <div style={{ marginBottom: '1rem' }}><label className="form-label">Title *</label><input className="input" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}><label className="form-label">Category</label>
                  <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {['License', 'Insurance', 'Tax', 'Audit', 'Registration', 'Regulatory', 'Other'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}><label className="form-label">Due Date *</label><input className="input" type="date" required value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}><label className="form-label">Responsible</label>
                  <select className="input" value={form.responsible_id} onChange={e => setForm({ ...form, responsible_id: e.target.value })}>
                    <option value="">None</option>{users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}><label className="form-label">Entity</label>
                  <select className="input" value={form.entity_id} onChange={e => setForm({ ...form, entity_id: e.target.value })}>
                    <option value="">All</option>{entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}><label className="form-label">Recurrence</label>
                <select className="input" value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })}>
                  <option value="none">None</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option>
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}><label className="form-label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting ? 'Saving…' : editItem ? 'Save' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
