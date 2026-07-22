import React, { useEffect, useState, useRef } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import {
  Shield, Key, Layers, Globe, Sun, Moon, Upload, Plus, Trash2,
  CheckCircle, X, AlertCircle, GitBranch, Sliders, Package, TrendingUp
} from 'lucide-react'
import { getPlanLimits } from '../lib/planEnforcement'
import type { Plan } from '../lib/planEnforcement'
import { isSubdomainAvailable, ROOT_DOMAIN } from '../lib/subdomain'
import TabBar from '../components/TabBar'
import { isLight } from '../lib/color'

// ── Add-on definitions with 30% margin baked in ───────────────────
// Costs are actual cost to operator; price = Math.round(cost * 1.30)
const ADDON_CATALOG = [
  { key: 'power_bi',        label: 'Power BI Embedded',         cost: 200,  price: 260,  unit: '/mo',    desc: 'Isolated Power BI workspace for custom dashboards on your approvals, compliance, tasks, and asset data.' },
  { key: 'whatsapp_api',    label: 'WhatsApp Business API',     cost: 15,   price: 20,   unit: '/mo',    desc: 'Dedicated phone number for approval alerts, notice broadcasts, and compliance reminders via WhatsApp.' },
  { key: 'email_api',       label: 'Email API (SendGrid)',       cost: 15,   price: 20,   unit: '/mo',    desc: 'Transactional emails and scheduled report delivery.' },
  { key: 'ocr_api',         label: 'OCR API',                   cost: 30,   price: 39,   unit: '/mo',    desc: 'Scan receipts for Expense Claims and ID documents for HR onboarding. Includes 500 scans/mo; extra scans $0.03 each.' },
  { key: 'google_maps',     label: 'Google Maps API',            cost: 10,   price: 13,   unit: '/mo',    desc: 'Location check-ins for field staff and fleet vehicles.' },
] as const

type AddonKey = typeof ADDON_CATALOG[number]['key']

const ADMIN_TABS = [
  'Users',
  'Approval Matrix',
  'Enterprise Add-ons',
  'White Label',
  'API & Keys',
  'Subscription',
] as const
type AdminTab = typeof ADMIN_TABS[number]

export default function AdminPage() {
  const { profile, post, tenant, branding, refreshBranding, effectivePlan } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const level = post?.hierarchy_levels
  const isExec = level && level.rank <= 1
  const isITAdmin = level?.is_it_admin || isExec

  if (!isITAdmin) return (
    <Layout title="Admin">
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
        <Shield size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
        <p>Admin access is restricted to IT Administrators and Group Executives.</p>
      </div>
    </Layout>
  )

  const [tab, setTab] = useState<AdminTab>('Users')

  return (
    <Layout title="Admin">
      <TabBar style={{ marginBottom: '1.5rem' }}>
        {ADMIN_TABS.map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)} style={{ fontSize: 'var(--text-small)' }}>{t}</button>
        ))}
      </TabBar>

      {tab === 'Users'              && <UsersTab profile={profile} tenant={tenant} />}
      {tab === 'Approval Matrix'    && <ApprovalMatrixTab profile={profile} tenant={tenant} isExec={isExec} effectivePlan={effectivePlan} />}
      {tab === 'Enterprise Add-ons' && <EnterpriseAddonsTab profile={profile} tenant={tenant} />}
      {tab === 'White Label'        && <WhiteLabelTab profile={profile} tenant={tenant} branding={branding} refreshBranding={refreshBranding} />}
      {tab === 'API & Keys'         && <APIKeysTab profile={profile} tenant={tenant} />}
      {tab === 'Subscription'       && <SubscriptionTab tenant={tenant} navigate={navigate} profile={profile} isExec={isExec} />}
    </Layout>
  )
}

/* ── USERS TAB ──────────────────────────────────────────────────── */
function UsersTab({ profile, tenant }: any) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<any>(null)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', entity_id: '', post_id: '' })
  const [entities, setEntities] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

  useEffect(() => { if (profile) { load(); loadEntities(); loadPosts() } }, [profile])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('user_profiles')
      .select('*, entities!entity_id(name), hierarchy_levels!post_id(name, rank)')
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .order('full_name')
      .limit(1000)
    setUsers(data || [])
    setLoading(false)
  }

  async function loadEntities() {
    const { data } = await supabase.from('entities').select('id,name').eq('tenant_id', profile.tenant_id)
    setEntities(data || [])
  }

  async function loadPosts() {
    const { data } = await supabase.from('hierarchy_levels').select('id,name,rank').eq('tenant_id', profile.tenant_id).order('rank')
    setPosts(data || [])
  }

  function openAdd() {
    setEditUser(null)
    setForm({ full_name: '', email: '', phone: '', entity_id: entities[0]?.id || '', post_id: posts[0]?.id || '' })
    setShowModal(true)
  }

  function openEdit(u: any) {
    setEditUser(u)
    setForm({ full_name: u.full_name || '', email: u.email || '', phone: u.phone || '', entity_id: u.entity_id || '', post_id: u.post_id || '' })
    setShowModal(true)
  }

  const [inviteResult, setInviteResult] = useState<{ email: string; tempPw: string } | null>(null)

  async function saveUser(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true)
    if (editUser) {
      await supabase.from('user_profiles').update({
        full_name: form.full_name, phone: form.phone,
        entity_id: form.entity_id, post_id: form.post_id
      }).eq('id', editUser.id)
      setShowModal(false); setEditUser(null); await load(); setSubmitting(false)
      return
    }

    // Generate a temporary password the admin can share
    const tempPw = 'Vela@' + Math.random().toString(36).slice(2, 8).toUpperCase() + '!'

    // Create the auth user — trigger handle_new_user will create the profile
    const { data: signupData, error: signupErr } = await supabase.auth.signUp({
      email: form.email,
      password: tempPw,
      options: {
        data: {
          full_name: form.full_name,
          phone: form.phone,
          tenant_id: profile.tenant_id,
          entity_id: form.entity_id,
          post_id: form.post_id,
        },
        emailRedirectTo: `${window.location.origin}/login`,
      }
    })

    if (signupErr) {
      alert('Failed to create user: ' + signupErr.message)
      setSubmitting(false)
      return
    }

    // Ensure profile row has correct tenant (trigger should handle this, belt+braces)
    if (signupData.user) {
      await supabase.from('user_profiles').upsert({
        id: signupData.user.id,
        email: form.email,
        full_name: form.full_name,
        phone: form.phone,
        tenant_id: profile.tenant_id,
        entity_id: form.entity_id || null,
        post_id: form.post_id || null,
        is_active: true
      }, { onConflict: 'id' })
    }

    setShowModal(false)
    setEditUser(null)
    setInviteResult({ email: form.email, tempPw })
    await load()
    setSubmitting(false)
  }

  async function toggleActive(u: any) {
    const newState = !u.is_active
    await supabase.from('user_profiles').update({ is_active: newState }).eq('id', u.id)
    await load()
  }

  async function deleteUser(id: string) {
    if (!confirm('Soft-delete this user? They will lose access immediately.')) return
    await supabase.from('user_profiles').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', id)
    await load()
  }

  const filtered = users.filter(u =>
    filter === 'all' ? true : filter === 'active' ? u.is_active : !u.is_active
  )

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <TabBar>
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button key={f} className={`tab ${filter === f ? 'active' : ''}`} style={{ fontSize: 'var(--text-small)', textTransform: 'capitalize' }} onClick={() => setFilter(f)}>{f} ({f === 'all' ? users.length : f === 'active' ? users.filter(u => u.is_active).length : users.filter(u => !u.is_active).length})</button>
          ))}
        </TabBar>
        <button className="btn-gold" style={{ fontSize: 'var(--text-small)', gap: 5 }} onClick={openAdd}><Plus size={14} />Invite User</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
          : filtered.length === 0
          ? <div className="empty-state"><p className="empty-state-title">No users</p><button className="btn-gold" onClick={openAdd}>Invite First User</button></div>
          : <div style={{ overflowX: 'auto' }}><table className="data-table">
              <thead><tr><th>Name</th><th>Email</th><th>Entity</th><th>Role</th><th>Status</th><th></th></tr></thead>
              <tbody>{filtered.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.full_name || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{u.email}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{u.entities?.name || '—'}</td>
                  <td>{u.hierarchy_levels?.name || '—'}</td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-approved' : 'badge-rejected'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--text-micro)' }} onClick={() => openEdit(u)}>Edit</button>
                      <button className="btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--text-micro)', color: u.is_active ? 'var(--danger)' : 'var(--gold)' }} onClick={() => toggleActive(u)}>
                        {u.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button onClick={() => deleteUser(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.25rem' }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
        }
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", margin: 0, fontSize: 'var(--text-body)' }}>{editUser ? 'Edit User' : 'Invite User'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={saveUser}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Full Name</label>
                <input className="input" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
              </div>
              {!editUser && (
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Email</label>
                  <input className="input" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="user@company.co.zw" />
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Phone</label>
                <input className="input" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+263..." />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Entity / Company</label>
                <select className="input" value={form.entity_id} onChange={e => setForm({ ...form, entity_id: e.target.value })}>
                  <option value="">Select entity...</option>
                  {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Role / Level</label>
                <select className="input" value={form.post_id} onChange={e => setForm({ ...form, post_id: e.target.value })}>
                  <option value="">Select role...</option>
                  {posts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {!editUser && (
                <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  A temporary password will be generated. Share it securely with the new user — they can change it after first login.
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting ? 'Saving...' : editUser ? 'Save Changes' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {inviteResult && (
        <div className="modal-backdrop" onClick={() => setInviteResult(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 400, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
            <h3 style={{ fontFamily: "'Playfair Display',serif", margin: '0 0 0.5rem' }}>User Created</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)', marginBottom: '1.25rem' }}>
              Share these credentials securely with <strong>{inviteResult.email}</strong>
            </p>
            <div style={{ background: 'var(--bg-900)', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem', textAlign: 'left' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>EMAIL</p>
              <p style={{ margin: '0 0 1rem', fontFamily: "'JetBrains Mono',monospace", fontSize: 'var(--text-small)' }}>{inviteResult.email}</p>
              <p style={{ margin: '0 0 0.5rem', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>TEMPORARY PASSWORD</p>
              <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: 'var(--text-body)', color: 'var(--gold)', fontWeight: 700 }}>{inviteResult.tempPw}</p>
            </div>
            <p style={{ fontSize: 'var(--text-micro)', color: 'var(--info)', marginBottom: '0.75rem' }}>
              📧 A confirmation email was just sent to {inviteResult.email}. They must click it before this password will work — otherwise sign-in will fail with "email not confirmed."
            </p>
            <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              The user should change this password after first login via Profile → Security.
            </p>
            <button className="btn-gold" style={{ width: '100%' }} onClick={() => {
              navigator.clipboard?.writeText(`Email: ${inviteResult.email}\nPassword: ${inviteResult.tempPw}`)
              setInviteResult(null)
            }}>Copy & Close</button>
          </div>
        </div>
      )}
    </>
  )
}

/* ── APPROVAL MATRIX TAB ────────────────────────────────────────── */
function ApprovalMatrixTab({ profile, tenant, isExec, effectivePlan }: any) {
  const isEnterprise = effectivePlan === 'enterprise'
  const isGroup      = effectivePlan === 'group'
  const canModify    = isExec

  // Starter: upgrade prompt
  if (!isEnterprise && !isGroup) return (
    <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: '2.5rem' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔒</div>
      <h3 style={{ fontFamily: "'Playfair Display',serif", margin: '0 0 0.5rem' }}>Group or Enterprise Feature</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>Approval threshold settings require the Group plan or above. Upgrade to configure petty cash limits and dual-approval rules. Enterprise adds full custom rule workflows.</p>
    </div>
  )

  // Group plan: simple two-threshold form
  if (isGroup) return <GroupThresholdsForm profile={profile} tenant={tenant} canModify={canModify} />

  // ── ENTERPRISE: full rules engine ────────────────────────────────
  const [rules, setRules] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [entities, setEntities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editRule, setEditRule] = useState<any>(null)
  const [form, setForm] = useState({
    rule_name: '', rule_type: 'amount_range', amount_min: '', amount_max: '',
    categories: '', required_rank: '2', required_approvers_count: '1',
    parallel_ranks: '', escalate_after_hours: '', escalate_to_rank: '',
    entity_id: '', notes: '', priority: '50'
  })

  const RULE_TYPES = [
    { value: 'amount_range',      label: 'Amount Range',           desc: 'Route by USD amount band' },
    { value: 'category',          label: 'Category Rule',          desc: 'Always route specific categories to a rank' },
    { value: 'dual_required',     label: 'Dual Approval Required', desc: 'Requires 2 approvers regardless of amount' },
    { value: 'skip_level',        label: 'Skip Level',             desc: 'Bypass endorsement for small amounts' },
    { value: 'parallel',          label: 'Parallel Approval',      desc: 'Multiple approvers simultaneously' },
    { value: 'sequential',        label: 'Sequential',             desc: 'Must follow exact rank order' },
    { value: 'time_sensitive',    label: 'Auto-Escalate',          desc: 'Escalate after N hours of inaction' },
    { value: 'entity_transfer',   label: 'Inter-Entity Transfer',  desc: 'Inter-company = Exec only' },
    { value: 'recurring',         label: 'Recurring Requests',     desc: 'Recurring requests need extra level' },
    { value: 'department_budget', label: 'Budget Overrun',         desc: 'Escalate when dept budget exceeded' },
  ]

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    setLoading(true)
    const [rRes, lRes, eRes] = await Promise.all([
      supabase.from('approval_rules').select('*, entities!entity_id(name)').eq('tenant_id', profile.tenant_id).order('priority', { ascending: false }).limit(100),
      supabase.from('hierarchy_levels').select('id,name,rank').eq('tenant_id', profile.tenant_id).order('rank'),
      supabase.from('entities').select('id,name').eq('tenant_id', profile.tenant_id).eq('is_active', true).is('deleted_at', null),
    ])
    setRules(rRes.data || [])
    setLevels(lRes.data || [])
    setEntities(eRes.data || [])
    setLoading(false)
  }

  function openCreate() {
    setEditRule(null)
    setForm({ rule_name: '', rule_type: 'amount_range', amount_min: '', amount_max: '', categories: '', required_rank: '2', required_approvers_count: '1', parallel_ranks: '', escalate_after_hours: '', escalate_to_rank: '', entity_id: '', notes: '', priority: '50' })
    setShowModal(true)
  }

  function openEdit(rule: any) {
    setEditRule(rule)
    setForm({
      rule_name: rule.rule_name || '', rule_type: rule.rule_type || 'amount_range',
      amount_min: rule.amount_min?.toString() || '', amount_max: rule.amount_max?.toString() || '',
      categories: rule.categories?.join(', ') || '', required_rank: rule.required_rank?.toString() || '2',
      required_approvers_count: rule.required_approvers_count?.toString() || '1',
      parallel_ranks: rule.parallel_ranks?.join(', ') || '', escalate_after_hours: rule.escalate_after_hours?.toString() || '',
      escalate_to_rank: rule.escalate_to_rank?.toString() || '', entity_id: rule.entity_id || '',
      notes: rule.notes || '', priority: rule.priority?.toString() || '50'
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.rule_name.trim()) return
    const payload: any = {
      tenant_id: profile.tenant_id,
      rule_name: form.rule_name, rule_type: form.rule_type,
      amount_min: form.amount_min ? parseFloat(form.amount_min) : null,
      amount_max: form.amount_max ? parseFloat(form.amount_max) : null,
      categories: form.categories ? form.categories.split(',').map(s => s.trim()).filter(Boolean) : null,
      required_rank: parseInt(form.required_rank),
      required_approvers_count: parseInt(form.required_approvers_count),
      parallel_ranks: form.parallel_ranks ? form.parallel_ranks.split(',').map(s => parseInt(s.trim())).filter(Boolean) : null,
      escalate_after_hours: form.escalate_after_hours ? parseInt(form.escalate_after_hours) : null,
      escalate_to_rank: form.escalate_to_rank ? parseInt(form.escalate_to_rank) : null,
      entity_id: form.entity_id || null, notes: form.notes || null,
      priority: parseInt(form.priority), created_by: profile.id, is_active: true,
    }
    if (editRule) {
      await supabase.from('approval_rules').update(payload).eq('id', editRule.id)
    } else {
      await supabase.from('approval_rules').insert(payload)
    }
    setShowModal(false); load()
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('approval_rules').update({ is_active: !current }).eq('id', id)
    load()
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this rule?')) return
    await supabase.from('approval_rules').delete().eq('id', id)
    load()
  }

  const ruleTypeLabel = (type: string) => RULE_TYPES.find(t => t.value === type)?.label || type
  const rankName = (rank: number) => levels.find(l => l.rank === rank)?.name || `Rank ${rank}`

  const typeColors: Record<string, string> = {
    amount_range: 'var(--gold)', category: 'var(--info)', dual_required: '#f97316',
    skip_level: 'var(--success)', parallel: '#a78bfa', sequential: 'var(--text-muted)',
    time_sensitive: 'var(--danger)', entity_transfer: 'var(--danger)', recurring: 'var(--warning)', department_budget: '#f97316'
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <p style={{ margin: 0, fontSize: 'var(--text-small)', color: 'var(--text-muted)', maxWidth: 560 }}>
            Custom approval rules for this tenant. Rules are evaluated by priority (higher = first). {!canModify && <span style={{ color: 'var(--warning)' }}>View only — only Executives can modify rules.</span>}
          </p>
        </div>
        {canModify && <button className="btn-gold" style={{ fontSize: 'var(--text-small)', gap: 5, flexShrink: 0 }} onClick={openCreate}><Plus size={14} />New Rule</button>}
      </div>

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {rules.length === 0 && (
            <div className="empty-state card">
              <div className="empty-state-icon"><Sliders size={40} strokeWidth={1} /></div>
              <p className="empty-state-title">No approval rules defined</p>
              <p className="empty-state-body">Default rules apply: petty cash &lt; $15 → Dept Manager, &gt; $999 → Dual approval. Create custom rules to override.</p>
              {canModify && <button className="btn-gold" onClick={openCreate}>Create First Rule</button>}
            </div>
          )}
          {rules.map(r => (
            <div key={r.id} className="card" style={{ opacity: r.is_active ? 1 : 0.5, display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-body)' }}>{r.rule_name}</span>
                  <span style={{ fontSize: 'var(--text-micro)', padding: '2px 7px', borderRadius: 999, background: `${typeColors[r.rule_type]}18`, color: typeColors[r.rule_type], fontWeight: 600 }}>{ruleTypeLabel(r.rule_type)}</span>
                  {r.entity_id && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', padding: '2px 7px', borderRadius: 999, background: 'var(--surface)' }}>{r.entities?.name}</span>}
                  <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>Priority {r.priority}</span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
                  {r.amount_min != null && <span>From: ${r.amount_min}</span>}
                  {r.amount_max != null && <span>To: ${r.amount_max}</span>}
                  {r.amount_max == null && r.amount_min != null && <span>No upper limit</span>}
                  {r.categories?.length > 0 && <span>Categories: {r.categories.join(', ')}</span>}
                  {r.required_rank && <span>→ {rankName(r.required_rank)}</span>}
                  {r.required_approvers_count > 1 && <span>× {r.required_approvers_count} approvers</span>}
                  {r.escalate_after_hours && <span>Escalate after {r.escalate_after_hours}h</span>}
                </div>
                {r.notes && <p style={{ margin: '4px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)', fontStyle: 'italic' }}>{r.notes}</p>}
              </div>
              {canModify && (
                <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                  <button className="btn-ghost" style={{ fontSize: 'var(--text-micro)', padding: '0.3rem 0.6rem' }} onClick={() => openEdit(r)}>Edit</button>
                  <button onClick={() => toggleActive(r.id, r.is_active)} style={{ fontSize: 'var(--text-micro)', padding: '0.3rem 0.6rem', background: r.is_active ? 'var(--warning-dim)' : 'var(--success-dim)', color: r.is_active ? 'var(--warning)' : 'var(--success)', border: `1px solid ${r.is_active ? 'var(--warning-dim)' : 'var(--success-dim)'}`, borderRadius: 8, cursor: 'pointer' }}>
                    {r.is_active ? 'Pause' : 'Activate'}
                  </button>
                  <button onClick={() => deleteRule(r.id)} style={{ background: 'var(--danger-dim)', border: 'none', borderRadius: 6, color: 'var(--danger)', cursor: 'pointer', padding: '0.3rem 0.5rem' }}><Trash2 size={12} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", margin: 0, fontSize: 'var(--text-lead)' }}>{editRule ? 'Edit Rule' : 'New Approval Rule'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              {/* Rule name - full width */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Rule Name *</label>
                <input className="input" value={form.rule_name} onChange={e => setForm({ ...form, rule_name: e.target.value })} placeholder="e.g. Large equipment purchases" />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Rule Type</label>
                <select className="input" value={form.rule_type} onChange={e => setForm({ ...form, rule_type: e.target.value })}>
                  {RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>)}
                </select>
              </div>

              {/* Amount range */}
              {['amount_range', 'dual_required', 'skip_level', 'department_budget'].includes(form.rule_type) && <>
                <div>
                  <label className="form-label">Min Amount ($)</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.amount_min} onChange={e => setForm({ ...form, amount_min: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <label className="form-label">Max Amount ($ · blank = no limit)</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.amount_max} onChange={e => setForm({ ...form, amount_max: e.target.value })} placeholder="∞" />
                </div>
              </>}

              {/* Categories */}
              {form.rule_type === 'category' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Categories (comma separated)</label>
                  <input className="input" value={form.categories} onChange={e => setForm({ ...form, categories: e.target.value })} placeholder="Equipment, Travel, Marketing" />
                </div>
              )}

              {/* Required rank */}
              <div>
                <label className="form-label">Required Approver Rank</label>
                <select className="input" value={form.required_rank} onChange={e => setForm({ ...form, required_rank: e.target.value })}>
                  {levels.map(l => <option key={l.id} value={l.rank}>{l.name} (Rank {l.rank})</option>)}
                </select>
              </div>

              {/* Approver count */}
              <div>
                <label className="form-label">Number of Approvers Required</label>
                <input className="input" type="number" min="1" max="5" value={form.required_approvers_count} onChange={e => setForm({ ...form, required_approvers_count: e.target.value })} />
              </div>

              {/* Parallel ranks */}
              {form.rule_type === 'parallel' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Parallel Approver Ranks (comma separated rank numbers)</label>
                  <input className="input" value={form.parallel_ranks} onChange={e => setForm({ ...form, parallel_ranks: e.target.value })} placeholder="1, 2, 3" />
                </div>
              )}

              {/* Auto-escalate */}
              {form.rule_type === 'time_sensitive' && <>
                <div>
                  <label className="form-label">Escalate After (hours)</label>
                  <input className="input" type="number" min="1" value={form.escalate_after_hours} onChange={e => setForm({ ...form, escalate_after_hours: e.target.value })} placeholder="72" />
                </div>
                <div>
                  <label className="form-label">Escalate To Rank</label>
                  <select className="input" value={form.escalate_to_rank} onChange={e => setForm({ ...form, escalate_to_rank: e.target.value })}>
                    <option value="">Next level up</option>
                    {levels.map(l => <option key={l.id} value={l.rank}>{l.name}</option>)}
                  </select>
                </div>
              </>}

              {/* Entity scope */}
              <div>
                <label className="form-label">Scope (blank = all entities)</label>
                <select className="input" value={form.entity_id} onChange={e => setForm({ ...form, entity_id: e.target.value })}>
                  <option value="">All Entities</option>
                  {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="form-label">Priority (0–100, higher = evaluated first)</label>
                <input className="input" type="number" min="0" max="100" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} />
              </div>

              {/* Notes */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional explanation for this rule..." />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-gold" onClick={save} disabled={!form.rule_name.trim()}>{editRule ? 'Save Changes' : 'Create Rule'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── GROUP THRESHOLDS FORM ──────────────────────────────────────── */
function GroupThresholdsForm({ profile, tenant, canModify }: any) {
  const [pettyCash, setPettyCash]     = useState<string>((tenant?.petty_cash_limit ?? 15).toString())
  const [dualApproval, setDualApproval] = useState<string>((tenant?.dual_approval_threshold ?? 999).toString())
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')

  async function save() {
    const pc  = parseFloat(pettyCash)
    const da  = parseFloat(dualApproval)
    if (isNaN(pc) || pc < 0)   { setError('Petty cash limit must be a positive number.'); return }
    if (isNaN(da) || da <= pc) { setError('Dual approval threshold must be greater than the petty cash limit.'); return }
    setError('')
    setSaving(true)
    const { error: err } = await supabase.from('tenants')
      .update({ petty_cash_limit: pc, dual_approval_threshold: da })
      .eq('id', profile.tenant_id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const pc  = parseFloat(pettyCash)  || 15
  const da  = parseFloat(dualApproval) || 999

  return (
    <div>
      <p style={{ margin: '0 0 1.5rem', fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
        Configure the two approval thresholds that govern how requests are routed across your group.
        {!canModify && <span style={{ color: 'var(--warning)' }}> View only — only Executives can modify these settings.</span>}
      </p>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div>
            <label className="form-label">Petty Cash Limit (USD)</label>
            <input
              className="input"
              type="number" min="1" step="0.01"
              value={pettyCash}
              onChange={e => setPettyCash(e.target.value)}
              disabled={!canModify}
            />
            <p style={{ margin: '0.4rem 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
              Requests below this amount require <strong>Department Manager</strong> approval only.
            </p>
          </div>

          <div>
            <label className="form-label">Dual Approval Threshold (USD)</label>
            <input
              className="input"
              type="number" min="1" step="0.01"
              value={dualApproval}
              onChange={e => setDualApproval(e.target.value)}
              disabled={!canModify}
            />
            <p style={{ margin: '0.4rem 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
              Requests above this amount require <strong>two approvers</strong> simultaneously.
            </p>
          </div>
        </div>

        {error && <p style={{ margin: '0.75rem 0 0', fontSize: 'var(--text-small)', color: 'var(--danger)' }}>{error}</p>}

        {canModify && (
          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="btn-gold" onClick={save} disabled={saving} style={{ minWidth: 100 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {saved && <span style={{ fontSize: 'var(--text-small)', color: 'var(--success)' }}>✓ Saved</span>}
          </div>
        )}
      </div>

      {/* Live rule summary */}
      <div className="card" style={{ background: 'var(--gold-wash)', border: '1px solid var(--gold-ring)' }}>
        <p style={{ margin: '0 0 0.75rem', fontSize: 'var(--text-micro)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current Routing Rules</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: 'var(--text-small)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
            <span>Below <strong style={{ color: 'var(--gold)' }}>${pc.toFixed(2)}</strong> → Department Manager only</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
            <span><strong style={{ color: 'var(--gold)' }}>${pc.toFixed(2)}</strong> – <strong style={{ color: 'var(--gold)' }}>${da.toFixed(2)}</strong> → Standard approval chain</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />
            <span>Above <strong style={{ color: 'var(--gold)' }}>${da.toFixed(2)}</strong> → Dual approval required</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', background: 'var(--info-dim)', border: '1px solid var(--info-dim)' }}>
        <span style={{ fontSize: 'var(--text-body)', flexShrink: 0 }}>⬆️</span>
        <div>
          <p style={{ margin: 0, fontSize: 'var(--text-small)', fontWeight: 600 }}>Need more control?</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>Enterprise unlocks full custom rule workflows — category-based routing, skip-level rules, parallel approvals, auto-escalation, and per-entity scoping.</p>
        </div>
      </div>
    </div>
  )
}

/* ── ENTERPRISE ADD-ONS TAB ─────────────────────────────────────── */
function EnterpriseAddonsTab({ profile, tenant }: any) {
  const [activeAddons, setActiveAddons] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const isEnterprise = tenant?.plan === 'enterprise'

  useEffect(() => { if (profile && isEnterprise) load() }, [profile, isEnterprise])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('tenant_addons').select('addon_key').eq('tenant_id', profile.tenant_id).eq('is_active', true)
    setActiveAddons(new Set((data || []).map((a: any) => a.addon_key)))
    setLoading(false)
  }

  async function toggle(key: string, price: number) {
    setSaving(key)
    const isOn = activeAddons.has(key)
    if (isOn) {
      await supabase.from('tenant_addons').update({ is_active: false, deactivated_at: new Date().toISOString() }).eq('tenant_id', profile.tenant_id).eq('addon_key', key)
      setActiveAddons(prev => { const s = new Set(prev); s.delete(key); return s })
    } else {
      await supabase.from('tenant_addons').upsert({ tenant_id: profile.tenant_id, addon_key: key, is_active: true, activated_at: new Date().toISOString(), price_usd: price }, { onConflict: 'tenant_id,addon_key' })
      setActiveAddons(prev => new Set([...prev, key]))
    }
    setSaving(null)
  }

  if (!isEnterprise) return (
    <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: '2rem' }}>
      <p style={{ color: 'var(--text-muted)' }}>Add-ons are available on the Enterprise plan only.</p>
    </div>
  )

  const monthlyTotal = ADDON_CATALOG.filter(a => activeAddons.has(a.key)).reduce((s, a) => s + a.price, 0)

  return (
    <div>
      {/* Running total */}
      <div className="card" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Active Add-ons Monthly Total</p>
          <p style={{ margin: '4px 0 0', fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-h2)', fontWeight: 700, color: 'var(--gold)' }}>
            ${(399 + monthlyTotal).toLocaleString()}<span style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', fontFamily: 'inherit' }}>/mo</span>
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
            Enterprise base $399 + ${monthlyTotal} add-ons
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>Annual (2 months free)</p>
          <p style={{ margin: '4px 0 0', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>${((399 + monthlyTotal) * 10).toLocaleString()}/yr</p>
        </div>
      </div>

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.875rem' }}>
          {ADDON_CATALOG.map(addon => {
            const isOn = activeAddons.has(addon.key)
            const isLoading = saving === addon.key
            return (
              <div key={addon.key} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderColor: isOn ? 'var(--gold)' : 'var(--border)', background: isOn ? 'var(--gold-wash)' : 'var(--surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ margin: 0, fontSize: 'var(--text-body)', fontWeight: 600, flex: 1, paddingRight: '0.5rem' }}>{addon.label}</h4>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 'var(--text-lead)', color: 'var(--gold)' }}>${addon.price}</span>
                    <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{addon.unit}</span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 'var(--text-small)', color: 'var(--text-muted)', lineHeight: 1.5, flex: 1 }}>{addon.desc}</p>
                {isOn && (
                  <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--info)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    🔧 Provisioning — our team will reach out to complete setup before this goes live.
                  </p>
                )}
                <button
                  onClick={() => toggle(addon.key, addon.price)}
                  disabled={isLoading}
                  style={{
                    width: '100%', padding: '0.5rem', borderRadius: 8, cursor: 'pointer',
                    background: isOn ? 'var(--danger-dim)' : 'linear-gradient(135deg, var(--gold), var(--gold-dark))',
                    color: isOn ? 'var(--danger)' : '#0f0f23',
                    border: isOn ? '1px solid var(--danger-dim)' : 'none',
                    fontWeight: 600, fontSize: 'var(--text-small)',
                    transition: 'all 0.15s'
                  }}
                >
                  {isLoading ? '...' : isOn ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── WHITE LABEL TAB ────────────────────────────────────────────── */
function WhiteLabelTab({ profile, tenant, branding, refreshBranding }: any) {
  const [entities, setEntities] = useState<any[]>([])
  const [selectedEntity, setSelectedEntity] = useState<string>('__tenant__')
  const [form, setForm] = useState({
    app_name: '', tagline: '', primary_color: '#d4a84b',
    secondary_color: '#16213e', accent_color: '#0f0f23',
    hide_holding_branding: false,
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isEnterprise = tenant?.plan === 'enterprise'
  const COLOR_PRESETS = [
    { label:'Gold',    primary:'#d4a84b', secondary:'#16213e', accent:'#0f0f23' },
    { label:'Emerald', primary:'#10b981', secondary:'#064e3b', accent:'#022c22' },
    { label:'Cobalt',  primary:'#3b82f6', secondary:'#1e3a5f', accent:'#0f1f3d' },
    { label:'Crimson', primary:'#ef4444', secondary:'#450a0a', accent:'#1c0505' },
    { label:'Violet',  primary:'#8b5cf6', secondary:'#2e1065', accent:'#14052e' },
    { label:'Amber',   primary:'#f59e0b', secondary:'#451a03', accent:'#1c0a00' },
    { label:'Slate',   primary:'#94a3b8', secondary:'#1e293b', accent:'#0f172a' },
    { label:'Rose',    primary:'#f43f5e', secondary:'#4c0519', accent:'#1f0210' },
  ]

  useEffect(() => {
    if (profile) {
      supabase.from('entities').select('id,name,entity_type,app_name,tagline,logo_url,primary_color,secondary_color,accent_color,hide_holding_branding')
        .eq('tenant_id', profile.tenant_id).eq('is_active', true).is('deleted_at', null)
        .then(({ data }) => setEntities(data || []))
    }
  }, [profile])

  useEffect(() => {
    if (selectedEntity === '__tenant__') {
      setForm({ app_name: branding?.app_name || '', tagline: branding?.tagline || '', primary_color: branding?.primary_color || '#d4a84b', secondary_color: branding?.secondary_color || '#16213e', accent_color: branding?.accent_color || '#0f0f23', hide_holding_branding: false })
      setLogoPreview(branding?.logo_url || null)
    } else {
      const e = entities.find(x => x.id === selectedEntity)
      if (e) {
        setForm({ app_name: e.app_name || '', tagline: e.tagline || '', primary_color: e.primary_color || '#d4a84b', secondary_color: e.secondary_color || '#16213e', accent_color: e.accent_color || '#0f0f23', hide_holding_branding: e.hide_holding_branding || false })
        setLogoPreview(e.logo_url || null)
      }
    }
  }, [selectedEntity, branding, entities])

  if (!isEnterprise) return (
    <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: '2.5rem' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🎨</div>
      <h3 style={{ fontFamily: "'Playfair Display',serif", margin: '0 0 0.5rem' }}>Enterprise Feature</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>White labelling and per-subsidiary branding require the Enterprise plan.</p>
    </div>
  )

  async function uploadLogo() {
    const file = fileRef.current?.files?.[0]; if (!file) return
    setUploading(true)
    const isTenant = selectedEntity === '__tenant__'
    const path = isTenant
      ? `${profile.tenant_id}/logo.${file.name.split('.').pop()}`
      : `${profile.tenant_id}/entities/${selectedEntity}/logo.${file.name.split('.').pop()}`
    await supabase.storage.from('vela-logos').upload(path, file, { upsert: true, contentType: file.type })
    const { data: urlData } = supabase.storage.from('vela-logos').getPublicUrl(path)
    const publicUrl = urlData.publicUrl
    setLogoPreview(publicUrl)
    if (isTenant) {
      await supabase.from('tenant_branding').upsert({ tenant_id: profile.tenant_id, logo_storage_path: path }, { onConflict: 'tenant_id' })
    } else {
      await supabase.from('entities').update({ logo_url: publicUrl, logo_path: path }).eq('id', selectedEntity)
    }
    setUploading(false)
    refreshBranding()
  }

  async function save() {
    setSaving(true)
    if (selectedEntity === '__tenant__') {
      await supabase.from('tenant_branding').upsert({
        tenant_id: profile.tenant_id,
        app_name: form.app_name || null, tagline: form.tagline || null,
        primary_color: form.primary_color, secondary_color: form.secondary_color,
        accent_color: form.accent_color,
      }, { onConflict: 'tenant_id' })
    } else {
      await supabase.from('entities').update({
        app_name: form.app_name || null, tagline: form.tagline || null,
        primary_color: form.primary_color, secondary_color: form.secondary_color,
        accent_color: form.accent_color, hide_holding_branding: form.hide_holding_branding,
      }).eq('id', selectedEntity)
    }
    await refreshBranding()
    setMsg('Saved ✓')
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  const holdingName = entities.find(e => e.entity_type === 'holding')?.name || tenant?.name || 'Group'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Entity selector */}
      <div className="card">
        <h3 style={{ margin: '0 0 0.875rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Branding Target</h3>
        <p style={{ margin: '0 0 0.875rem', fontSize: 'var(--text-small)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Set group-level branding that applies to all users, or configure each subsidiary independently so workers only see that company's identity.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            className={selectedEntity === '__tenant__' ? 'btn-gold' : 'btn-ghost'}
            style={{ fontSize: 'var(--text-small)', padding: '0.4rem 0.875rem' }}
            onClick={() => setSelectedEntity('__tenant__')}>
            🏢 {holdingName} (Group)
          </button>
          {entities.filter(e => e.entity_type !== 'holding').map(e => (
            <button key={e.id}
              className={selectedEntity === e.id ? 'btn-gold' : 'btn-ghost'}
              style={{ fontSize: 'var(--text-small)', padding: '0.4rem 0.875rem' }}
              onClick={() => setSelectedEntity(e.id)}>
              {e.name}
            </button>
          ))}
        </div>
      </div>

      {/* Logo */}
      <div className="card">
        <h3 style={{ margin: '0 0 0.875rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Logo</h3>
        {logoPreview && <img src={logoPreview} alt="Logo" style={{ height: 44, maxWidth: 200, objectFit: 'contain', marginBottom: '0.75rem', background: 'var(--bg-900)', borderRadius: 8, padding: 6 }} />}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadLogo} />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ fontSize: 'var(--text-small)', gap: 6 }}>
            <Upload size={13} />{uploading ? 'Uploading…' : logoPreview ? 'Replace Logo' : 'Upload Logo'}
          </button>
          {logoPreview && (
            <button className="btn-ghost" onClick={async () => { setLogoPreview(null); if (selectedEntity==='__tenant__') await supabase.from('tenant_branding').update({ logo_storage_path: null }).eq('tenant_id', profile.tenant_id); else await supabase.from('entities').update({ logo_url: null }).eq('id', selectedEntity); refreshBranding() }} style={{ fontSize: 'var(--text-small)', color: 'var(--danger)' }}>
              Remove
            </button>
          )}
        </div>
        <p style={{ margin: '0.5rem 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>PNG, SVG or JPG. Shown in the sidebar instead of the VELA shield.</p>
      </div>

      {/* Name & tagline */}
      <div className="card">
        <h3 style={{ margin: '0 0 0.875rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Name & Tagline</h3>
        {[
          { label: 'App / Company Name', key: 'app_name', placeholder: selectedEntity === '__tenant__' ? holdingName : entities.find(e=>e.id===selectedEntity)?.name || 'Company Name' },
          { label: 'Tagline', key: 'tagline', placeholder: 'e.g. Building Zimbabwe Together' },
        ].map(({ label, key, placeholder }) => (
          <div key={key} style={{ marginBottom: '1rem' }}>
            <label className="form-label">{label}</label>
            <input className="input" value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} />
          </div>
        ))}
        {selectedEntity !== '__tenant__' && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 'var(--text-small)' }}>
            <input type="checkbox" checked={form.hide_holding_branding} onChange={e => setForm({ ...form, hide_holding_branding: e.target.checked })} style={{ marginTop: 3, accentColor: 'var(--gold)' }} />
            <div>
              <span style={{ fontWeight: 500 }}>Hide group/holding company identity</span>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>Workers in this subsidiary only see this company's name and branding — no mention of {holdingName}.</p>
            </div>
          </label>
        )}
      </div>

      {/* Colors */}
      <div className="card">
        <h3 style={{ margin: '0 0 0.5rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Colour Theme</h3>
        <p style={{ margin: '0 0 0.875rem', fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>Choose a preset or set custom hex values.</p>

        {/* Presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {COLOR_PRESETS.map(p => (
            <button key={p.label} onClick={() => setForm({ ...form, primary_color: p.primary, secondary_color: p.secondary, accent_color: p.accent })}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.35rem 0.75rem', borderRadius: 8, border: `1px solid ${form.primary_color === p.primary ? p.primary : 'var(--border)'}`, background: form.primary_color === p.primary ? `${p.primary}18` : 'var(--surface)', cursor: 'pointer', fontSize: 'var(--text-micro)', color: 'var(--text-primary)' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: p.primary, flexShrink: 0 }} />
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom inputs */}
        {[
          { label: 'Accent / Button Color', key: 'primary_color' },
          { label: 'Sidebar Background', key: 'secondary_color' },
          { label: 'Page Background', key: 'accent_color' },
        ].map(({ label, key }) => (
          <div key={key} style={{ marginBottom: '1rem' }}>
            <label className="form-label">{label}</label>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <input type="color" value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                style={{ width: 44, height: 40, borderRadius: 8, border: '1px solid var(--border)', padding: 3, background: 'transparent', cursor: 'pointer', flexShrink: 0 }} />
              <input className="input" value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 'var(--text-small)' }} />
              <span style={{ width: 32, height: 32, borderRadius: 8, background: (form as any)[key], border: '1px solid var(--border)', flexShrink: 0 }} />
            </div>
          </div>
        ))}

        {/* Live preview */}
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', marginTop: '0.25rem' }}>
          <div style={{ background: form.secondary_color, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={16} style={{ color: form.primary_color }} />
            <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, color: form.primary_color, fontSize: 'var(--text-body)' }}>
              {form.app_name || (selectedEntity === '__tenant__' ? holdingName : entities.find(e=>e.id===selectedEntity)?.name || 'Company')}
            </span>
          </div>
          <div style={{ background: form.accent_color, padding: '0.875rem 1rem' }}>
            <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: isLight(form.accent_color) ? '#7a7060' : '#94a3b8' }}>{form.tagline || 'Your tagline here'}</p>
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: 6 }}>
              <div style={{ background: form.primary_color, borderRadius: 6, padding: '0.3rem 0.75rem', fontSize: 'var(--text-micro)', fontWeight: 700, color: isLight(form.primary_color) ? '#1a1814' : '#f0ead6' }}>Button</div>
              <div style={{ background: `${form.primary_color}18`, border: `1px solid ${form.primary_color}40`, borderRadius: 6, padding: '0.3rem 0.75rem', fontSize: 'var(--text-micro)', color: form.primary_color }}>Outline</div>
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button className="btn-gold" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Branding'}</button>
        {msg && <span style={{ fontSize: 'var(--text-small)', color: 'var(--success)' }}>{msg}</span>}
      </div>
    </div>
  )
}
function APIKeysTab({ profile, tenant }: any) {
  const [keys, setKeys] = useState<any[]>([])
  const [newKey, setNewKey] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', scopes: ['read'] as string[] })
  const [showCreate, setShowCreate] = useState(false)
  const isEnterprise = tenant?.plan === 'enterprise'

  useEffect(() => { if (profile && isEnterprise) supabase.from('api_keys').select('*').eq('tenant_id', profile.tenant_id).order('created_at', { ascending: false }).then(({ data }) => setKeys(data || [])) }, [profile, isEnterprise])

  async function create() {
    const raw = `vela_${Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')}`
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))).map(b => b.toString(16).padStart(2, '0')).join('')
    await supabase.from('api_keys').insert({ tenant_id: profile.tenant_id, name: form.name, key_hash: hash, key_prefix: raw.slice(0, 12) + '...', scopes: form.scopes, rate_limit_per_min: 60, created_by: profile.id })
    setNewKey(raw); setShowCreate(false)
    const { data } = await supabase.from('api_keys').select('*').eq('tenant_id', profile.tenant_id).order('created_at', { ascending: false })
    setKeys(data || [])
  }

  if (!isEnterprise) return <div className="card" style={{ maxWidth: 480 }}><p style={{ color: 'var(--text-muted)' }}>API access requires Enterprise plan.</p></div>

  return (
    <div>
      {newKey && (
        <div className="card" style={{ marginBottom: '1.25rem', borderColor: 'var(--success-dim)', background: 'var(--success-dim)' }}>
          <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--success)', fontSize: 'var(--text-small)' }}>⚡ Copy now — never shown again</p>
          <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-small)', wordBreak: 'break-all' }}>{newKey}</code>
          <button className="btn-gold" onClick={() => { navigator.clipboard.writeText(newKey); setNewKey(null) }} style={{ marginTop: '0.75rem', fontSize: 'var(--text-small)', gap: 5 }}>Copy & Close</button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn-gold" style={{ fontSize: 'var(--text-small)', gap: 5 }} onClick={() => setShowCreate(!showCreate)}><Plus size={13} />New Key</button>
      </div>
      {showCreate && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div><label className="form-label">Name</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Payroll Sync" /></div>
            <div><label className="form-label">Scopes</label>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {['read','write','payroll','inventory','reporting'].map(s => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-small)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.scopes.includes(s)} onChange={e => setForm({ ...form, scopes: e.target.checked ? [...form.scopes, s] : form.scopes.filter(x => x !== s) })} />{s}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-ghost" style={{ fontSize: 'var(--text-small)' }} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn-gold" style={{ fontSize: 'var(--text-small)' }} onClick={create} disabled={!form.name.trim()}>Generate</button>
            </div>
          </div>
        </div>
      )}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead><tr><th>Name</th><th>Prefix</th><th>Scopes</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {keys.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>No API keys</td></tr>
              : keys.map(k => (
                <tr key={k.id}>
                  <td style={{ fontWeight: 500 }}>{k.name}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-small)', color: 'var(--gold)' }}>{k.key_prefix}</td>
                  <td style={{ fontSize: 'var(--text-micro)' }}>{k.scopes?.join(', ')}</td>
                  <td><span className={`badge ${k.is_active ? 'badge-active' : 'badge-draft'}`}>{k.is_active ? 'Active' : 'Revoked'}</span></td>
                  <td>{k.is_active && <button onClick={async () => { await supabase.from('api_keys').update({ is_active: false }).eq('id', k.id); const { data } = await supabase.from('api_keys').select('*').eq('tenant_id', profile.tenant_id); setKeys(data || []) }} style={{ background: 'var(--danger-dim)', border: 'none', borderRadius: 6, color: 'var(--danger)', cursor: 'pointer', padding: '0.3rem 0.5rem' }}><Trash2 size={12} /></button>}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── SUBSCRIPTION TAB ───────────────────────────────────────────── */
function SubscriptionTab({ tenant, navigate, profile, isExec }: any) {
  const plan = (tenant?.plan || 'starter') as Plan
  const limits = getPlanLimits(plan)
  const descriptions: Record<Plan, { price: string; summary: string }> = {
    starter: { price: '$49/mo', summary: '1 company · 5 branches · 50 employees' },
    group: { price: '$199/mo', summary: '5 companies · 50 branches · Unlimited employees' },
    enterprise: { price: '$399/mo base', summary: 'Unlimited · Full API · White-label · Insights Dashboard' },
  }
  const info = descriptions[plan]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card" style={{ borderColor: 'var(--gold)' }}>
        <p style={{ margin: '0 0 0.25rem', fontSize: 'var(--text-micro)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current Plan</p>
        <p style={{ margin: '0 0 0.25rem', fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-h2)', fontWeight: 700, color: 'var(--gold)', textTransform: 'capitalize' }}>{plan}</p>
        <p style={{ margin: '0 0 1rem', fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>{info.price} · {info.summary}</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Group Oversight', on: limits.hasGroupOversight },
            { label: 'Insights Dashboard', on: limits.hasInsightsDashboard },
            { label: 'White-Label', on: limits.hasWhiteLabel },
            { label: 'REST API & Webhooks', on: limits.hasAPI },
            { label: 'Custom Reports', on: limits.hasCustomReports },
            { label: `${limits.documentRetentionDays >= 365 ? Math.round(limits.documentRetentionDays/365)+'yr' : limits.documentRetentionDays+'d'} Audit Retention`, on: true },
            { label: 'CSV Export', on: limits.hasCSVExport },
          ].map(f => (
            <span key={f.label} style={{ fontSize: 'var(--text-micro)', padding: '3px 8px', borderRadius: 999, background: f.on ? 'var(--success-dim)' : 'var(--surface)', color: f.on ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {f.on ? <CheckCircle size={11} /> : <X size={11} />} {f.label}
            </span>
          ))}
        </div>
      </div>

      <SubdomainManager tenant={tenant} profile={profile} isExec={isExec} />

      {plan !== 'enterprise' && (
        <button className="btn-gold" onClick={() => navigate('/register?upgrade=true')} style={{ alignSelf: 'flex-start', gap: 6 }}>
          Upgrade to {plan === 'starter' ? 'Group' : 'Enterprise'} →
        </button>
      )}
    </div>
  )
}

/* ── SUBDOMAIN MANAGER ───────────────────────────────────────────────── */
function SubdomainManager({ tenant, profile, isExec }: any) {
  const [slug, setSlug] = useState(tenant?.subdomain || '')
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!slug || slug === tenant?.subdomain) { setAvailable(slug === tenant?.subdomain ? true : null); return }
    if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) { setAvailable(null); return }
    clearTimeout(debounceRef.current)
    setChecking(true)
    debounceRef.current = setTimeout(async () => {
      const ok = await isSubdomainAvailable(slug, profile.tenant_id)
      setAvailable(ok); setChecking(false)
    }, 500)
    return () => clearTimeout(debounceRef.current)
  }, [slug])

  function handleChange(raw: string) {
    setSlug(raw.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-'))
    setSavedMsg(false)
  }

  async function save() {
    if (!available || slug === tenant?.subdomain) return
    setSaving(true)
    await supabase.from('tenants').update({ subdomain: slug }).eq('id', profile.tenant_id)
    setSaving(false); setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 3000)
  }

  const isValid = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)
  const isUnchanged = slug === tenant?.subdomain

  return (
    <div className="card">
      <p style={{ margin: '0 0 0.25rem', fontSize: 'var(--text-micro)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>VELA Address</p>
      <p style={{ margin: '0 0 0.875rem', fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
        Your team logs in at this address.{!isExec && ' Only executives can change this.'}
      </p>
      <div style={{
        display: 'flex', alignItems: 'center',
        border: `1px solid ${available === false && !isUnchanged ? 'var(--danger)' : available === true && !isUnchanged ? 'var(--success)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)', overflow: 'hidden', opacity: isExec ? 1 : 0.6,
      }}>
        <input
          value={slug}
          onChange={e => handleChange(e.target.value)}
          disabled={!isExec}
          placeholder="your-company"
          style={{ flex: 1, padding: '0.625rem 0.75rem', background: 'var(--input-bg)', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 'var(--text-small)', fontFamily: "'JetBrains Mono', monospace" }}
        />
        <span style={{ padding: '0.625rem 0.75rem 0.625rem 0', fontSize: 'var(--text-small)', color: 'var(--text-muted)', background: 'var(--input-bg)', whiteSpace: 'nowrap' }}>.{ROOT_DOMAIN}</span>
      </div>
      <p style={{ margin: '0.5rem 0 0', fontSize: 'var(--text-micro)', color: !isValid && slug ? 'var(--danger)' : available === false && !isUnchanged ? 'var(--danger)' : available === true && !isUnchanged ? 'var(--success)' : 'var(--text-muted)' }}>
        {!isValid && slug ? 'Lowercase letters, numbers, hyphens only.'
          : isUnchanged && slug ? `Currently live at ${slug}.${ROOT_DOMAIN}`
          : available === false ? 'Already taken.'
          : available === true ? `✓ Available`
          : ' '}
      </p>
      {isExec && (
        <div style={{ marginTop: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn-gold" disabled={!available || isUnchanged || saving} onClick={save} style={{ minWidth: 100 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {savedMsg && <span style={{ fontSize: 'var(--text-small)', color: 'var(--success)' }}>✓ Saved</span>}
        </div>
      )}
    </div>
  )
}

