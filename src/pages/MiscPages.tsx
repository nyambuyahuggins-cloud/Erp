import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { audit } from '../lib/audit'
import { Download, Eye, EyeOff, Filter, RefreshCw, Shield, UserCheck, Users, GitBranch, User, Plus, Trash2, X, ChevronDown } from 'lucide-react'
import TabBar from '../components/TabBar'

/* ─── OversightPage ───────────────────────────────────────────────────── */
export function OversightPage({ embedded }: { embedded?: boolean }) {
  const { profile, post } = useAuth()
  const [tab, setTab] = useState<'team' | 'users'>('team')
  const [team, setTeam] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showSoftDeleted, setShowSoftDeleted] = useState(false)
  const [showActingModal, setShowActingModal] = useState(false)
  const [actingForm, setActingForm] = useState({ absent_user_id: '', acting_user_id: '', end_date: '', reason: '' })
  const [delegations, setDelegations] = useState<any[]>([])

  const level = post?.hierarchy_levels
  const isManager = level && level.rank <= 2
  const canManageRoles = !!((level && level.rank <= 1) || level?.is_it_admin)

  const [roleModalUser, setRoleModalUser] = useState<any>(null)
  const [allPosts, setAllPosts] = useState<any[]>([])
  const [userRoles, setUserRoles] = useState<any[]>([])
  const [addRolePostId, setAddRolePostId] = useState('')
  const [roleBusy, setRoleBusy] = useState(false)

  useEffect(() => { if (profile) { loadTeam(); loadUsers(); loadDelegations() } }, [profile, showSoftDeleted])

  async function loadTeam() {
    let q = supabase.from('user_profiles')
      .select('*, posts!post_id(title, hierarchy_levels(name, rank)), entities!entity_id(name)')
      .eq('tenant_id', profile!.tenant_id)
    if (!showSoftDeleted) q = q.is('deleted_at', null)
    const { data } = await q.order('full_name')
    setTeam(data || [])
    setLoading(false)
  }

  async function loadUsers() {
    let q = supabase.from('user_profiles')
      .select('*, posts!post_id(title, hierarchy_levels(name)), entities!entity_id(name)')
      .eq('tenant_id', profile!.tenant_id)
    if (!showSoftDeleted) q = q.is('deleted_at', null)
    const { data } = await q.order('created_at', { ascending: false })
    setUsers(data || [])
  }

  async function softDeleteUser(userId: string, name: string) {
    if (!confirm(`Deactivate ${name}? They will no longer be able to log in. Historical records are preserved.`)) return
    const before = users.find(u => u.id === userId)
    await supabase.from('user_profiles').update({
      deleted_at: new Date().toISOString(),
      deleted_by: profile!.id,
      is_active: false
    }).eq('id', userId)
    await audit.deleted({
      tenant_id: profile!.tenant_id, actor_id: profile!.id,
      entity_type: 'user_profile', entity_id: userId, entity_name: name,
      before_snapshot: before
    })
    loadTeam(); loadUsers()
  }

  async function reactivateUser(userId: string, name: string) {
    await supabase.from('user_profiles').update({ deleted_at: null, deleted_by: null, is_active: true }).eq('id', userId)
    await audit.restored({ tenant_id: profile!.tenant_id, actor_id: profile!.id, entity_type: 'user_profile', entity_id: userId, entity_name: name })
    loadTeam(); loadUsers()
  }

  async function loadDelegations() {
    const { data } = await supabase.from('acting_authority')
      .select('*, absent:user_profiles!absent_user_id(full_name), acting:user_profiles!acting_user_id(full_name)')
      .eq('tenant_id', profile!.tenant_id)
      .eq('is_active', true)
      .order('end_date', { ascending: true })
    setDelegations(data || [])
  }

  async function createActingAuthority() {
    if (!actingForm.absent_user_id || !actingForm.acting_user_id || !actingForm.end_date) return
    await supabase.from('acting_authority').insert({
      tenant_id: profile!.tenant_id,
      absent_user_id: actingForm.absent_user_id,
      acting_user_id: actingForm.acting_user_id,
      start_date: new Date().toISOString().split('T')[0],
      end_date: actingForm.end_date,
      granted_by: profile!.id,
      reason: actingForm.reason,
      is_active: true,
      activated_at: new Date().toISOString()
    })
    setShowActingModal(false)
    setActingForm({ absent_user_id: '', acting_user_id: '', end_date: '', reason: '' })
    loadDelegations()
  }

  async function revokeActingAuthority(id: string) {
    await supabase.from('acting_authority').update({ is_active: false, deactivated_at: new Date().toISOString() }).eq('id', id)
    loadDelegations()
  }

  async function openRoleModal(user: any) {
    setRoleModalUser(user)
    setAddRolePostId('')
    const [{ data: posts }, { data: roles }] = await Promise.all([
      supabase.from('posts').select('id, title, entity_id, entities!entity_id(name), hierarchy_levels(name, rank)')
        .eq('tenant_id', profile!.tenant_id).eq('is_active', true).order('title'),
      supabase.from('user_role_assignments').select('id, post_id, is_primary, posts!post_id(title, entity_id, entities!entity_id(name), hierarchy_levels(name, rank))')
        .eq('user_id', user.id).order('is_primary', { ascending: false }),
    ])
    setAllPosts(posts || [])
    setUserRoles(roles || [])
  }

  async function setPrimaryRole(postId: string) {
    if (!roleModalUser) return
    setRoleBusy(true)
    await supabase.from('user_profiles').update({ post_id: postId }).eq('id', roleModalUser.id)
    // Sync the assignments table: clear old primary flag, upsert this one as primary.
    await supabase.from('user_role_assignments').update({ is_primary: false }).eq('user_id', roleModalUser.id)
    await supabase.from('user_role_assignments').upsert(
      { tenant_id: profile!.tenant_id, user_id: roleModalUser.id, post_id: postId, is_primary: true, created_by: profile!.id },
      { onConflict: 'user_id,post_id' }
    )
    await openRoleModal({ ...roleModalUser, post_id: postId })
    loadTeam(); loadUsers()
    setRoleBusy(false)
  }

  async function addRoleInEntity() {
    if (!roleModalUser || !addRolePostId) return
    setRoleBusy(true)
    await supabase.from('user_role_assignments').insert({
      tenant_id: profile!.tenant_id, user_id: roleModalUser.id, post_id: addRolePostId, is_primary: false, created_by: profile!.id,
    })
    setAddRolePostId('')
    await openRoleModal(roleModalUser)
    setRoleBusy(false)
  }

  async function removeRoleAssignment(id: string) {
    await supabase.from('user_role_assignments').delete().eq('id', id)
    await openRoleModal(roleModalUser)
  }

  const displayUsers = tab === 'team' ? team : users

  const innerAction = isManager ? (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <button className="btn-ghost" style={{ fontSize: 'var(--text-micro)', display: 'flex', alignItems: 'center', gap: 5 }}
        onClick={() => setShowSoftDeleted(!showSoftDeleted)}>
        {showSoftDeleted ? <EyeOff size={13} /> : <Eye size={13} />}
        {showSoftDeleted ? 'Hide Deleted' : 'Show Deleted'}
      </button>
      <button className="btn-gold" style={{ fontSize: 'var(--text-micro)', display: 'flex', alignItems: 'center', gap: 5 }}
        onClick={() => setShowActingModal(true)}>
        <UserCheck size={13} /> Acting Authority
          </button>
        </div>
  ) : null

  const innerContent = (
    <>
      <TabBar style={{ marginBottom: '1.25rem' }}>
        <button className={`tab ${tab === 'team' ? 'active' : ''}`} onClick={() => setTab('team')}>Team ({team.length})</button>
        <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>All Users</button>
      </TabBar>
      {isManager && delegations.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', background: 'var(--gold-wash)', border: '1px solid var(--gold-ring)' }}>
          <p style={{ margin: '0 0 0.6rem', fontSize: 'var(--text-micro)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Active Delegations</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {delegations.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', fontSize: 'var(--text-small)' }}>
                <span>
                  <strong>{d.acting?.full_name}</strong> is acting for <strong>{d.absent?.full_name}</strong>
                  <span style={{ color: 'var(--text-muted)' }}> · until {new Date(d.end_date).toLocaleDateString()}{d.reason ? ` · ${d.reason}` : ''}</span>
                </span>
                <button className="btn-ghost" style={{ padding: '0.25rem 0.6rem', fontSize: 'var(--text-micro)', color: 'var(--danger)', flexShrink: 0 }} onClick={() => revokeActingAuthority(d.id)}>Revoke</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Name</th><th>Post</th><th>Level</th><th>Entity</th><th>Status</th><th>Last Login</th>{isManager && <th></th>}</tr></thead>
              <tbody>
                {displayUsers.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No users</td></tr>
                ) : displayUsers.map(u => (
                  <tr key={u.id} style={{ opacity: u.deleted_at ? 0.5 : 1 }}>
                    <td style={{ fontWeight: 500 }}>
                      {u.full_name}
                      {u.id === profile?.id && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--gold)', marginLeft: 6 }}>YOU</span>}
                      {u.deleted_at && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--danger)', marginLeft: 6 }}>DEACTIVATED</span>}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{u.posts?.title || '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{u.posts?.hierarchy_levels?.name || '—'}</td>
                    <td>{u.entities?.name || '—'}</td>
                    <td><span className={`badge ${u.is_active && !u.deleted_at ? 'badge-active' : 'badge-rejected'}`}>{u.is_active && !u.deleted_at ? 'Active' : 'Inactive'}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}</td>
                    {isManager && (
                      <td>
                        {u.id !== profile?.id && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            {canManageRoles && !u.deleted_at && (
                              <button onClick={() => openRoleModal(u)} className="btn-ghost" style={{ fontSize: 'var(--text-micro)', padding: '0.25rem 0.6rem' }}>Manage Role</button>
                            )}
                            {u.deleted_at ? (
                              <button onClick={() => reactivateUser(u.id, u.full_name)} className="btn-ghost" style={{ fontSize: 'var(--text-micro)', padding: '0.25rem 0.6rem', color: 'var(--success)' }}>Reactivate</button>
                            ) : (
                              <button onClick={() => softDeleteUser(u.id, u.full_name)} style={{ background: 'var(--danger-dim)', border: 'none', borderRadius: 6, color: 'var(--danger)', cursor: 'pointer', padding: '0.3rem 0.5rem' }}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Acting Authority Modal */}
      {showActingModal && (
        <div className="modal-backdrop" onClick={() => setShowActingModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-body)' }}>Assign Acting Authority</h3>
              <button onClick={() => setShowActingModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Delegating From</label>
                <select className="input" value={actingForm.absent_user_id} onChange={e => setActingForm({ ...actingForm, absent_user_id: e.target.value })}>
                  <option value="">Select user...</option>
                  {team.filter(u => !u.deleted_at).map(u => <option key={u.id} value={u.id}>{u.full_name} — {u.posts?.title}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Acting User</label>
                <select className="input" value={actingForm.acting_user_id} onChange={e => setActingForm({ ...actingForm, acting_user_id: e.target.value })}>
                  <option value="">Select user...</option>
                  {team.filter(u => !u.deleted_at && u.id !== actingForm.absent_user_id).map(u => <option key={u.id} value={u.id}>{u.full_name} — {u.posts?.title}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ends On</label>
                <input className="input" type="date" min={new Date().toISOString().split('T')[0]} value={actingForm.end_date} onChange={e => setActingForm({ ...actingForm, end_date: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reason</label>
                <input className="input" value={actingForm.reason} onChange={e => setActingForm({ ...actingForm, reason: e.target.value })} placeholder="e.g. Annual leave, medical" />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button className="btn-ghost" onClick={() => setShowActingModal(false)}>Cancel</button>
                <button className="btn-gold" onClick={createActingAuthority}>Assign</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {roleModalUser && (
        <div className="modal-backdrop" onClick={() => setRoleModalUser(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-body)' }}>Manage Role — {roleModalUser.full_name}</h3>
              <button onClick={() => setRoleModalUser(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Primary Role</label>
            <select className="input" value={roleModalUser.post_id || ''} disabled={roleBusy} onChange={e => setPrimaryRole(e.target.value)} style={{ marginBottom: '1.25rem' }}>
              {allPosts.map(p => (
                <option key={p.id} value={p.id}>{p.title} — {p.hierarchy_levels?.name} · {p.entities?.name}</option>
              ))}
            </select>

            {userRoles.filter(r => !r.is_primary).length > 0 && (
              <>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Additional Entity Roles</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: '1.25rem' }}>
                  {userRoles.filter(r => !r.is_primary).map(r => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--bg-900)', borderRadius: 8 }}>
                      <span style={{ fontSize: 'var(--text-small)' }}>{r.posts?.title} — {r.posts?.hierarchy_levels?.name} · <span style={{ color: 'var(--text-muted)' }}>{r.posts?.entities?.name}</span></span>
                      <button className="btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: 'var(--text-micro)', color: 'var(--danger)' }} onClick={() => removeRoleAssignment(r.id)}>Remove</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Add a Role in Another Entity
            </label>
            <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
              Lets this person hold a different rank in a different entity — e.g. Dept Manager here, Staff elsewhere.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select className="input" value={addRolePostId} onChange={e => setAddRolePostId(e.target.value)}>
                <option value="">Select a role...</option>
                {allPosts.filter(p => !userRoles.some(r => r.post_id === p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.title} — {p.hierarchy_levels?.name} · {p.entities?.name}</option>
                ))}
              </select>
              <button className="btn-gold" disabled={!addRolePostId || roleBusy} onClick={addRoleInEntity} style={{ flexShrink: 0 }}>Add</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
  return embedded ? <>{innerContent}</> : <Layout title="Oversight" action={innerAction}>{innerContent}</Layout>
}

/* ─── HierarchyPage ───────────────────────────────────────────────────── */
export function HierarchyPage({ embedded }: { embedded?: boolean }) {
  const { profile, post } = useAuth()
  const [entities, setEntities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeleted, setShowDeleted] = useState(false)

  const level = post?.hierarchy_levels
  const isExec = level && level.rank <= 1
  if (!isExec) {
    const msg = <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>Executive access only.</div>
    return embedded ? msg : <Layout title="Hierarchy">{msg}</Layout>
  }

  useEffect(() => { if (profile) load() }, [profile, showDeleted])

  async function load() {
    let q = supabase.from('entities').select('*').eq('tenant_id', profile!.tenant_id)
    if (!showDeleted) q = q.is('deleted_at', null).eq('is_active', true)
    const { data } = await q.order('entity_type')
    setEntities(data || [])
    setLoading(false)
  }

  async function softDeleteEntity(id: string, name: string) {
    if (!confirm(`Archive entity "${name}"? Historical data is preserved.`)) return
    const before = entities.find(e => e.id === id)
    await supabase.from('entities').update({ deleted_at: new Date().toISOString(), deleted_by: profile!.id, is_active: false }).eq('id', id)
    await audit.deleted({ tenant_id: profile!.tenant_id, actor_id: profile!.id, entity_type: 'entity', entity_id: id, entity_name: name, before_snapshot: before })
    load()
  }

  async function restoreEntity(id: string, name: string) {
    await supabase.from('entities').update({ deleted_at: null, deleted_by: null, is_active: true }).eq('id', id)
    await audit.restored({ tenant_id: profile!.tenant_id, actor_id: profile!.id, entity_type: 'entity', entity_id: id, entity_name: name })
    load()
  }

  const typeOrder = ['holding', 'subsidiary', 'branch', 'department']
  const grouped = typeOrder.reduce((acc, type) => {
    acc[type] = entities.filter(e => e.entity_type === type)
    return acc
  }, {} as Record<string, any[]>)
  const typeColors: Record<string, string> = { holding: 'var(--gold)', subsidiary: 'var(--info)', branch: 'var(--success)', department: '#a78bfa' }

  const action = (
    <button className="btn-ghost" style={{ fontSize: 'var(--text-micro)', display: 'flex', alignItems: 'center', gap: 5 }}
      onClick={() => setShowDeleted(!showDeleted)}>
      {showDeleted ? <EyeOff size={13} /> : <Eye size={13} />}
      {showDeleted ? 'Hide Archived' : 'Show Archived'}
    </button>
  )

  const content = (
    <>
      {!embedded && null /* action shown via Layout prop below */}
      {loading ? <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}><div className="spinner" /></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {typeOrder.map(type => grouped[type].length > 0 && (
            <div key={type}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: typeColors[type] }} />
                <h3 style={{ margin: 0, fontSize: 'var(--text-micro)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {type}s ({grouped[type].length})
                </h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {grouped[type].map(e => (
                  <div key={e.id} className="card" style={{ borderLeft: `3px solid ${typeColors[type]}`, opacity: e.deleted_at ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ margin: '0 0 0.25rem', fontWeight: 600, fontSize: 'var(--text-body)' }}>{e.name}</p>
                        {e.historical_name && <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: '#f97316' }}>Formerly: {e.historical_name}</p>}
                        {e.short_name && <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{e.short_name}</p>}
                        {e.sold_at && <p style={{ margin: '4px 0 0', fontSize: 'var(--text-micro)', color: 'var(--danger)' }}>Sold: {new Date(e.sold_at).toLocaleDateString()}</p>}
                      </div>
                      {e.deleted_at ? (
                        <button onClick={() => restoreEntity(e.id, e.name)} className="btn-ghost" style={{ fontSize: 'var(--text-micro)', padding: '0.2rem 0.5rem', color: 'var(--success)' }}>Restore</button>
                      ) : type !== 'holding' && (
                        <button onClick={() => softDeleteEntity(e.id, e.name)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    {e.brand_color && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.5rem' }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: e.brand_color }} />
                        <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{e.brand_color}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )

  if (embedded) return content
  return <Layout title="Hierarchy" action={action}>{content}</Layout>
}

/* ─── NotFoundPage ────────────────────────────────────────────────────── */
export function NotFoundPage() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-900)', padding:'2rem', flexDirection:'column', gap:'1rem', textAlign:'center' }}>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'5rem', color:'var(--gold)', lineHeight:1 }}>404</div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:'var(--text-primary)', margin:0 }}>Page not found</h2>
      <p style={{ color:'var(--text-muted)', maxWidth:320 }}>This page doesn't exist. You may have followed a broken link.</p>
      <a href="/" className="btn-gold" style={{ textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6, marginTop:'0.5rem' }}>← Back to home</a>
    </div>
  )
}

/* ─── ToSPage ─────────────────────────────────────────────────────────── */
export function ToSPage() {
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-900)', padding:'4rem 1.5rem' }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <a href="/" style={{ color:'var(--gold)', fontSize:'0.875rem', textDecoration:'none' }}>← Back</a>
        <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:'2rem', margin:'1.5rem 0 0.5rem', color:'var(--text-primary)' }}>Terms of Service</h1>
        <p style={{ color:'var(--text-muted)', marginBottom:'2rem', fontSize:'0.875rem' }}>Last updated: {new Date().getFullYear()}</p>
        {[
          ['1. Acceptance', 'By accessing or using VELA, you agree to these terms. If you are using VELA on behalf of an organisation, you represent that you have authority to bind that organisation.'],
          ['2. Service', 'VELA is a cloud-based ERP platform designed for Zimbabwean holding companies. We provide the platform as-is and make no guarantees of uninterrupted access, though we strive for high availability.'],
          ['3. Your Data', 'You retain ownership of all data you submit to VELA. We process your data to deliver the service and do not sell it to third parties. Data is stored on secure servers in accordance with our Privacy Policy.'],
          ['4. Acceptable Use', 'You agree not to use VELA to process illegal transactions, violate Zimbabwean law, or circumvent ZIMRA obligations. Misuse may result in immediate account suspension.'],
          ['5. Billing', 'Paid plans are billed monthly or annually as selected. The first month is free. Annual plans receive 2 months free. Cancellations take effect at the end of the current billing period.'],
          ['6. Termination', 'Either party may terminate the agreement with 30 days written notice. On termination you may export your data in CSV format within 30 days before it is permanently deleted.'],
          ['7. Limitation of Liability', 'VELA and its operators are not liable for indirect, incidental, or consequential damages arising from use of the platform.'],
          ['8. Changes', 'We may update these terms. Continued use after notice constitutes acceptance.'],
          ['9. Contact', 'For questions about these terms, contact us via the in-app support form or WhatsApp button on our website.'],
        ].map(([title, body]) => (
          <div key={title as string} style={{ marginBottom:'1.5rem' }}>
            <h3 style={{ color:'var(--text-primary)', marginBottom:'0.375rem', fontSize:'1rem' }}>{title as string}</h3>
            <p style={{ color:'var(--text-muted)', lineHeight:1.7, margin:0 }}>{body as string}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── PrivacyPage ─────────────────────────────────────────────────────── */
export function PrivacyPage() {
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-900)', padding:'4rem 1.5rem' }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <a href="/" style={{ color:'var(--gold)', fontSize:'0.875rem', textDecoration:'none' }}>← Back</a>
        <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:'2rem', margin:'1.5rem 0 0.5rem', color:'var(--text-primary)' }}>Privacy Policy</h1>
        <p style={{ color:'var(--text-muted)', marginBottom:'2rem', fontSize:'0.875rem' }}>Last updated: {new Date().getFullYear()}</p>
        {[
          ['Data We Collect', 'We collect information you provide during registration (name, email, phone, company), data you enter into the platform (employees, transactions, inventory), and usage data (session logs, feature usage).'],
          ['How We Use Your Data', 'To deliver and improve the VELA service, send transactional notifications, comply with legal obligations, and support you when you contact us.'],
          ['Data Storage', 'Data is stored on Supabase infrastructure. We do not store data outside of secure, access-controlled environments.'],
          ['Data Sharing', 'We do not sell your data. We share it only with sub-processors necessary to deliver the service (e.g., SMS gateways for notifications) and only to the extent required.'],
          ['Your Rights', 'You may request a full export of your data at any time from the Admin page. You may request deletion of your account and data by contacting support.'],
          ['Cookies', 'VELA uses session cookies for authentication and local storage for theme and offline queue management. No third-party advertising cookies are used.'],
          ['Contact', 'Privacy enquiries can be directed to us through the in-app support form.'],
        ].map(([title, body]) => (
          <div key={title as string} style={{ marginBottom:'1.5rem' }}>
            <h3 style={{ color:'var(--text-primary)', marginBottom:'0.375rem', fontSize:'1rem' }}>{title as string}</h3>
            <p style={{ color:'var(--text-muted)', lineHeight:1.7, margin:0 }}>{body as string}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── ProfilePage ─────────────────────────────────────────────────────── */
export function ProfilePage() {
  const { profile, post, refreshProfile, effectivePlan } = useAuth()
  const [form, setForm] = useState({ full_name: '', phone: '' })
  const [pwForm, setPwForm] = useState({ newPw: '', confirm: '' })
  const [sessions, setSessions] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  useEffect(() => {
    if (profile) {
      setForm({ full_name: profile.full_name || '', phone: profile.phone || '' })
      loadSessions()
    }
  }, [profile])

  async function loadSessions() {
    const { data } = await supabase.from('user_sessions').select('*').eq('user_id', profile!.id).order('created_at', { ascending: false }).limit(10)
    setSessions(data || [])
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const before = { full_name: profile!.full_name, phone: profile!.phone }
    await supabase.from('user_profiles').update({ full_name: form.full_name, phone: form.phone }).eq('id', profile!.id)
    await audit.updated({ tenant_id: profile!.tenant_id, actor_id: profile!.id, entity_type: 'user_profile', entity_id: profile!.id, entity_name: form.full_name, before_snapshot: before, after_snapshot: form })
    await refreshProfile()
    setMsg('Profile updated')
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwForm.newPw !== pwForm.confirm) { setPwMsg('Passwords do not match'); return }
    if (pwForm.newPw.length < 8) { setPwMsg('Password must be at least 8 characters'); return }
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw })
    if (error) { setPwMsg(error.message) } else {
      setPwMsg('Password changed')
      setPwForm({ newPw: '', confirm: '' })
      // Audit: session invalidation on password change
      await supabase.from('user_sessions').update({ invalidated_at: new Date().toISOString(), invalidated_reason: 'password_change' }).eq('user_id', profile!.id).is('invalidated_at', null)
      await audit.updated({ tenant_id: profile!.tenant_id, actor_id: profile!.id, entity_type: 'user_session', entity_id: profile!.id, action: 'password_changed' } as any)
    }
    setPwSaving(false)
    setTimeout(() => setPwMsg(''), 4000)
  }

  return (
    <Layout title="Profile">
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Avatar */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-h3)', fontWeight: 700, color: '#0f0f23', flexShrink: 0 }}>
            {profile?.full_name?.charAt(0)}
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-body)' }}>{profile?.full_name}</p>
            <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{post?.title}</p>
            <p style={{ margin: '0.1rem 0 0', color: 'var(--gold)', fontSize: 'var(--text-micro)' }}>{post?.hierarchy_levels?.name}</p>
            <p style={{ margin: '0.1rem 0 0', color: 'var(--text-muted)', fontSize: 'var(--text-micro)', textTransform: 'capitalize' }}>
              {effectivePlan} plan
            </p>
          </div>
        </div>

        {/* Personal Info */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Personal Info</h3>
          <form onSubmit={saveProfile}>
            {[
              { label: 'Full Name', el: <input className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /> },
              { label: 'Phone', el: <input className="input" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+263..." /> },
            ].map(({ label, el }) => (
              <div key={label} style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>
                {el}
              </div>
            ))}
            {msg && <p style={{ color: 'var(--success)', fontSize: 'var(--text-small)', margin: '0 0 0.75rem' }}>{msg}</p>}
            <button type="submit" className="btn-gold" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </form>
        </div>

        {/* Password */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Change Password</h3>
          <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', marginBottom: '1rem' }}>Changing your password will invalidate all other active sessions.</p>
          <form onSubmit={changePassword}>
            {[
              { label: 'New Password', field: 'newPw', placeholder: 'Min 8 characters' },
              { label: 'Confirm Password', field: 'confirm', placeholder: 'Repeat new password' },
            ].map(({ label, field, placeholder }) => (
              <div key={field} style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>
                <input className="input" type="password" value={pwForm[field as keyof typeof pwForm]} onChange={e => setPwForm({ ...pwForm, [field]: e.target.value })} placeholder={placeholder} />
              </div>
            ))}
            {pwMsg && <p style={{ color: pwMsg.includes('changed') ? 'var(--success)' : 'var(--danger)', fontSize: 'var(--text-small)', margin: '0 0 0.75rem' }}>{pwMsg}</p>}
            <button type="submit" className="btn-gold" disabled={pwSaving}>{pwSaving ? 'Changing...' : 'Change Password'}</button>
          </form>
        </div>

        {/* Session list */}
        {sessions.length > 0 && (
          <div className="card">
            <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Active Sessions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {sessions.slice(0, 5).map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--bg-900)', borderRadius: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 'var(--text-small)' }}>{s.device_type || 'Unknown device'} · {s.browser || 'Browser'}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{s.ip_address ? String(s.ip_address) : 'IP unknown'} · {new Date(s.created_at).toLocaleDateString()}</p>
                  </div>
                  {s.invalidated_at ? (
                    <span className="badge badge-draft" style={{ fontSize: 'var(--text-micro)' }}>Ended</span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge badge-active" style={{ fontSize: 'var(--text-micro)' }}>Active</span>
                      <button className="btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: 'var(--text-micro)', color: 'var(--danger)' }}
                        onClick={async () => { await supabase.from('user_sessions').update({ invalidated_at: new Date().toISOString(), invalidated_reason: 'manual' }).eq('id', s.id); loadSessions() }}>
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sign Out */}
        <SignOutCard />
      </div>
    </Layout>
  )
}

function SignOutCard() {
  const { signOut } = useAuth()
  return (
    <div className="card" style={{ borderColor: 'var(--danger-dim)' }}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sign Out</h3>
      <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
        You will be returned to the login page. Active sessions on other devices will remain open.
      </p>
      <button onClick={signOut}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--danger-dim)', border: '1px solid var(--danger-dim)', color: 'var(--danger)', borderRadius: 8, padding: '0.5rem 1.25rem', cursor: 'pointer', fontSize: 'var(--text-small)', fontWeight: 600 }}>
        Sign Out
      </button>
    </div>
  )
}
export function AuditPage() {
  const { profile, post } = useAuth()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [filterEntity, setFilterEntity] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'xml'>('csv')

  const level = post?.hierarchy_levels
  const canAccess = level?.is_accounting || (level && level.rank <= 1)
  if (!canAccess) return (
    <Layout title="Audit Log">
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Access restricted.</div>
    </Layout>
  )

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    const { data } = await supabase.from('audit_log')
      .select('*, user_profiles!actor_id(full_name)')
      .eq('tenant_id', profile!.tenant_id)
      .order('created_at', { ascending: false })
      .limit(500)
    setLogs(data || [])
    setLoading(false)
  }

  function doExport() {
    const rows = filtered
    if (exportFormat === 'json') {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
      dl(blob, 'audit_log.json')
    } else if (exportFormat === 'csv') {
      const header = 'time,actor,action,entity_type,entity_id,ip,before,after\n'
      const body = rows.map(l => [
        l.created_at, l.user_profiles?.full_name || '', l.action,
        l.entity_type, l.entity_id || '',
        l.ip_address || '',
        JSON.stringify(l.before_snapshot || '').replace(/,/g, ';'),
        JSON.stringify(l.after_snapshot || '').replace(/,/g, ';')
      ].map(v => `"${v}"`).join(',')).join('\n')
      const blob = new Blob([header + body], { type: 'text/csv' })
      dl(blob, 'audit_log.csv')
    } else {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<audit_log>\n` +
        rows.map(l => `  <entry time="${l.created_at}" actor="${l.user_profiles?.full_name || ''}" action="${l.action}" entity_type="${l.entity_type}" />`).join('\n') +
        `\n</audit_log>`
      const blob = new Blob([xml], { type: 'application/xml' })
      dl(blob, 'audit_log.xml')
    }
    audit.exported({ tenant_id: profile!.tenant_id, actor_id: profile!.id, entity_type: 'audit_log', entity_id: 'export' }, exportFormat)
  }

  function dl(blob: Blob, name: string) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
  }

  const actions = [...new Set(logs.map(l => l.action))].sort()
  const entityTypes = [...new Set(logs.map(l => l.entity_type))].sort()

  const filtered = logs.filter(l => {
    if (filterAction !== 'all' && l.action !== filterAction) return false
    if (filterEntity !== 'all' && l.entity_type !== filterEntity) return false
    if (filter && !`${l.action} ${l.entity_type} ${l.user_profiles?.full_name} ${l.entity_name}`.toLowerCase().includes(filter.toLowerCase())) return false
    return true
  })

  const actionColors: Record<string, string> = {
    login: 'var(--info)', logout: '#9ca3af', submitted: 'var(--gold)',
    approved: 'var(--success)', rejected: 'var(--danger)', updated: 'var(--warning)',
    deleted: '#f97316', restored: '#a78bfa', exported_csv: '#34d399',
    exported_json: '#34d399', exported_xml: '#34d399', context_switch: 'var(--info)'
  }

  return (
    <Layout title="Audit Log" action={
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <select className="input" style={{ width: 80, fontSize: 'var(--text-micro)' }} value={exportFormat} onChange={e => setExportFormat(e.target.value as any)}>
          <option value="csv">CSV</option><option value="json">JSON</option><option value="xml">XML</option>
        </select>
        <button className="btn-gold" style={{ fontSize: 'var(--text-micro)', display: 'flex', alignItems: 'center', gap: 5 }} onClick={doExport}>
          <Download size={13} /> Export
        </button>
        <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.4rem' }}>
          <RefreshCw size={14} />
        </button>
      </div>
    }>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={13} style={{ color: 'var(--text-muted)' }} />
        <input className="input" style={{ maxWidth: 240, fontSize: 'var(--text-small)' }} placeholder="Search actor, action, entity..." value={filter} onChange={e => setFilter(e.target.value)} />
        <select className="input" style={{ width: 'auto', fontSize: 'var(--text-small)' }} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
          <option value="all">All Actions</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="input" style={{ width: 'auto', fontSize: 'var(--text-small)' }} value={filterEntity} onChange={e => setFilterEntity(e.target.value)}>
          <option value="all">All Types</option>
          {entityTypes.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{filtered.length} entries</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th><th>Actor</th><th>Action</th><th>Entity</th>
                  <th>IP</th><th>Changes</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No audit logs match filters</td></tr>
                ) : filtered.map(l => (
                  <React.Fragment key={l.id}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-micro)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(l.created_at).toLocaleString('en-ZW', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ fontSize: 'var(--text-small)', fontWeight: 500 }}>
                        {l.user_profiles?.full_name || 'System'}
                        {l.is_impersonation && <span style={{ fontSize: 'var(--text-micro)', color: '#f97316', marginLeft: 5 }}>IMPERSONATING</span>}
                      </td>
                      <td>
                        <span style={{ fontSize: 'var(--text-micro)', fontWeight: 600, color: actionColors[l.action] || 'var(--text-muted)' }}>
                          {l.action}
                        </span>
                      </td>
                      <td>
                        <div>
                          <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>{l.entity_type}</span>
                          {l.entity_name && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-primary)', marginLeft: 6 }}>{l.entity_name}</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {l.ip_address ? String(l.ip_address) : '—'}
                      </td>
                      <td>
                        {(l.before_snapshot || l.after_snapshot) && (
                          <span style={{ fontSize: 'var(--text-micro)', padding: '2px 6px', borderRadius: 999, background: 'var(--warning-dim)', color: 'var(--warning)' }}>
                            Δ changed
                          </span>
                        )}
                      </td>
                      <td>
                        <ChevronDown size={13} style={{ color: 'var(--text-muted)', transform: expandedId === l.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      </td>
                    </tr>
                    {expandedId === l.id && (
                      <tr>
                        <td colSpan={7} style={{ padding: '0 1rem 1rem', background: 'var(--bg-900)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', paddingTop: '0.75rem' }}>
                            {l.before_snapshot && (
                              <div>
                                <p style={{ margin: '0 0 0.4rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Before</p>
                                <pre style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", overflow: 'auto', maxHeight: 200 }}>
                                  {JSON.stringify(l.before_snapshot, null, 2)}
                                </pre>
                              </div>
                            )}
                            {l.after_snapshot && (
                              <div>
                                <p style={{ margin: '0 0 0.4rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>After</p>
                                <pre style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", overflow: 'auto', maxHeight: 200 }}>
                                  {JSON.stringify(l.after_snapshot, null, 2)}
                                </pre>
                              </div>
                            )}
                            {l.device_info && (
                              <div>
                                <p style={{ margin: '0 0 0.4rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Device</p>
                                <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{JSON.stringify(l.device_info)}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
