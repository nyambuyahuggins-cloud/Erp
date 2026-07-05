import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Megaphone, Plus, X, Trash2 } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

/* ── NOTICE BOARD ──────────────────────────────────────────────── */
const PRIORITY_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  urgent: { bg: 'rgba(239,68,68,0.1)',  color: '#ef4444', label: 'Urgent' },
  normal: { bg: 'var(--gold-soft)', color: 'var(--gold)', label: 'Notice' },
  info:   { bg: 'var(--info-dim)', color: 'var(--info)', label: 'Info' },
}

export default function NoticeBoardSection({ profile, isAdmin }: { profile: any; isAdmin: boolean }) {
  const [items, setItems]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem]   = useState<any>(null)
  const [form, setForm] = useState({ title: '', body: '', priority: 'normal', expires_at: '' })
  const [submitting, setSubmitting] = useState(false)
  // Which notices were UNREAD when the page loaded — used only for the dot indicator
  const [unreadAtLoad, setUnreadAtLoad] = useState<Set<string>>(new Set())
  useEscapeKey(() => setShowModal(false))

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('notice_board_posts')
      .select('*, user_profiles!posted_by(full_name)')
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)

    // Mark all current notices as read for this user
    if (data && data.length > 0) {
      const { data: existingReads } = await supabase.from('notice_reads')
        .select('notice_id').eq('user_id', profile.id)
      const alreadyRead = new Set((existingReads || []).map((r: any) => r.notice_id))
      const toMark = data.filter(n => !alreadyRead.has(n.id))
      // Snapshot unread state BEFORE marking — so the dot stays visible this session
      setUnreadAtLoad(new Set(toMark.map(n => n.id)))
      if (toMark.length > 0) {
        await supabase.from('notice_reads').upsert(
          toMark.map(n => ({ tenant_id: profile.tenant_id, notice_id: n.id, user_id: profile.id })),
          { onConflict: 'notice_id,user_id', ignoreDuplicates: true }
        )
      }
    }
  }

  function openAdd() {
    setEditItem(null)
    setForm({ title: '', body: '', priority: 'normal', expires_at: '' })
    setShowModal(true)
  }
  function openEdit(n: any) {
    setEditItem(n)
    setForm({ title: n.title, body: n.body, priority: n.priority, expires_at: n.expires_at?.split('T')[0] || '' })
    setShowModal(true)
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true)
    const payload = {
      title: form.title, body: form.body, priority: form.priority,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    }
    if (editItem) {
      await supabase.from('notice_board_posts').update(payload).eq('id', editItem.id)
    } else {
      await supabase.from('notice_board_posts').insert({ tenant_id: profile.tenant_id, posted_by: profile.id, ...payload })
    }
    setShowModal(false); setEditItem(null); await load(); setSubmitting(false)
  }
  async function del(id: string) {
    if (!confirm('Delete this notice?')) return
    await supabase.from('notice_board_posts').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    await load()
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>

  return (
    <>
      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="btn-gold" style={{ gap: 5 }} onClick={openAdd}><Plus size={14} />Post Notice</button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty-state">
          <Megaphone size={32} style={{ color: 'var(--gold)', opacity: 0.3 }} />
          <p className="empty-state-title">No notices yet</p>
          {isAdmin && <button className="btn-gold" onClick={openAdd}>Post First Notice</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {items.map(n => {
            const ps = PRIORITY_STYLES[n.priority] || PRIORITY_STYLES.normal
            const expired = n.expires_at && new Date(n.expires_at) < new Date()
            const isNew = unreadAtLoad.has(n.id)
            return (
              <div key={n.id} className="card" style={{
                borderLeft: `3px solid ${ps.color}`,
                opacity: expired ? 0.55 : 1,
                position: 'relative',
              }}>
                {/* "New" dot — persists for this session even after marking read */}
                {isNew && (
                  <span style={{
                    position: 'absolute', top: 14, right: 14,
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--info)',
                    boxShadow: '0 0 0 2px var(--bg-850)',
                  }} title="New" aria-label="New notice" />
                )}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: '0.06em',
                        textTransform: 'uppercase', padding: '2px 7px', borderRadius: 999,
                        background: ps.bg, color: ps.color,
                      }}>{ps.label}</span>
                      {expired && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>Expired</span>}
                    </div>
                    <h3 style={{ margin: '0 0 0.375rem', fontSize: 'var(--text-body)', fontWeight: 600 }}>{n.title}</h3>
                    <p style={{ margin: 0, fontSize: 'var(--text-small)', color: 'var(--text-muted)', lineHeight: 1.55 }}>{n.body}</p>
                    <p style={{ margin: '0.625rem 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
                      Posted by {n.user_profiles?.full_name} · {new Date(n.created_at).toLocaleDateString()}
                      {n.expires_at && ` · Expires ${new Date(n.expires_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button className="btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--text-micro)' }} onClick={() => openEdit(n)}>Edit</button>
                      <button onClick={() => del(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.25rem' }}><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)} role="dialog" aria-modal="true" aria-label="Notice form">
          <div className="card" style={{ width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", margin: 0, fontSize: 'var(--text-body)' }}>{editItem ? 'Edit Notice' : 'Post Notice'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={save}>
              <div style={{ marginBottom: '1rem' }}><label className="form-label">Title *</label><input className="input" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div style={{ marginBottom: '1rem' }}><label className="form-label">Body *</label><textarea className="input" required rows={4} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1 }}><label className="form-label">Priority</label>
                  <select className="input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="info">Info</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}><label className="form-label">Expires (optional)</label>
                  <input className="input" type="date" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting ? 'Posting…' : editItem ? 'Save' : 'Post'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

