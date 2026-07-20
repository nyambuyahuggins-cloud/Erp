import React, { useEffect, useState, useRef } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import {
  Sun, Moon, User, Lock, Eye,
  Shield, Upload, Plus, Trash2, CheckCircle, X, Fingerprint
} from 'lucide-react'
import { getPlanLimits } from '../lib/planEnforcement'
import type { Plan } from '../lib/planEnforcement'
import TabBar from '../components/TabBar'

const TABS = ['Notifications', 'Display', 'Security'] as const
type SettingsTab = typeof TABS[number]

export default function SettingsPage() {
  const { profile, post, tenant, refreshProfile } = useAuth()
  const { theme, toggleTheme } = useTheme() as any

  const level = post?.hierarchy_levels
  const isExec = level && level.rank <= 1
  const isITAdmin = level?.is_it_admin || isExec

  const [tab, setTab] = useState<SettingsTab>('Notifications')

  return (
    <Layout title="Settings" action={
      <button onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 8, padding: '0.4rem 0.875rem', cursor: 'pointer', fontSize: 'var(--text-small)', fontWeight: 600 }}>
        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
      </button>
    }>
      <TabBar style={{ marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </TabBar>

      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        {tab === 'Notifications' && <NotificationsTab profile={profile} />}
        {tab === 'Display'       && <DisplayTab theme={theme} toggleTheme={toggleTheme} post={post} />}
        {tab === 'Security'      && <SecurityTab profile={profile} />}
      </div>
    </Layout>
  )
}

/* ── NOTIFICATIONS TAB ────────────────────────────────────────────── */
function NotificationsTab({ profile }: any) {
  const [prefs, setPrefs] = useState({
    email_approvals: true, email_rejections: true, email_payroll: false,
    inapp_approvals: true, inapp_requests: true, inapp_lowstock: true,
    sms_approvals: false, sms_urgent: false,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    // Store in user_profiles metadata or a separate notifications_prefs table
    await supabase.from('user_profiles').update({ notification_prefs: prefs }).eq('id', profile?.id)
    setSaved(true); setTimeout(() => setSaved(false), 2000); setSaving(false)
  }

  type PrefKey = keyof typeof prefs

  const sections = [
    {
      label: 'Email Notifications',
      items: [
        { key: 'email_approvals' as PrefKey, label: 'Request approved', desc: 'Get an email when your request is approved' },
        { key: 'email_rejections' as PrefKey, label: 'Request rejected', desc: 'Get an email when your request is rejected' },
        { key: 'email_payroll' as PrefKey, label: 'Payroll run completed', desc: 'Get an email when a payroll run is finalised' },
      ]
    },
    {
      label: 'In-App Notifications',
      items: [
        { key: 'inapp_approvals' as PrefKey, label: 'Approval actions', desc: 'Notify when requests in your queue need action' },
        { key: 'inapp_requests' as PrefKey, label: 'My request updates', desc: 'Notify when your requests change status' },
        { key: 'inapp_lowstock' as PrefKey, label: 'Low stock alerts', desc: 'Notify when inventory items hit threshold' },
      ]
    },
    {
      label: 'SMS Notifications',
      items: [
        { key: 'sms_approvals' as PrefKey, label: 'Approval reminders', desc: 'SMS when you have pending approvals (requires SMS add-on)' },
        { key: 'sms_urgent' as PrefKey, label: 'Urgent notices', desc: 'SMS for urgent notice board posts' },
      ]
    },
  ]

  return (
    <div style={{ maxWidth: 560 }}>
      {sections.map(section => (
        <div key={section.label} className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{section.label}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {section.items.map(item => (
              <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 'var(--text-small)', fontWeight: 500 }}>{item.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{item.desc}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={prefs[item.key]}
                  onClick={() => setPrefs(p => ({ ...p, [item.key]: !p[item.key] }))}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
                    background: prefs[item.key] ? 'var(--gold)' : 'var(--border)',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: prefs[item.key] ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', display: 'block',
                  }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <button className="btn-gold" onClick={save} disabled={saving}>
        {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  )
}

/* ── DISPLAY TAB ──────────────────────────────────────────────────── */
function DisplayTab({ theme, toggleTheme, post }: any) {
  const level = post?.hierarchy_levels
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => (localStorage.getItem('vela-density') as any) || 'comfortable')
  const [defaultPage, setDefaultPage] = useState(() => localStorage.getItem('vela-default-page') || '/dashboard')

  function saveDensity(d: 'comfortable' | 'compact') {
    setDensity(d)
    localStorage.setItem('vela-density', d)
    document.documentElement.setAttribute('data-density', d)
  }

  function saveDefaultPage(p: string) {
    setDefaultPage(p)
    localStorage.setItem('vela-default-page', p)
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Colour Mode</h3>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {(['dark', 'light'] as const).map(m => (
            <button key={m} onClick={() => { if (theme !== m) toggleTheme() }}
              style={{ flex: 1, padding: '0.875rem', borderRadius: 10, border: `2px solid ${theme === m ? 'var(--gold)' : 'var(--border)'}`, background: theme === m ? 'var(--gold-dim)' : 'var(--surface)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: 'var(--text-h2)' }}>{m === 'dark' ? '🌙' : '☀️'}</span>
              <span style={{ fontSize: 'var(--text-small)', fontWeight: 600, color: theme === m ? 'var(--gold)' : 'var(--text-muted)', textTransform: 'capitalize' }}>{m}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Table Density</h3>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {(['comfortable', 'compact'] as const).map(d => (
            <button key={d} onClick={() => saveDensity(d)}
              style={{ flex: 1, padding: '0.875rem', borderRadius: 10, border: `2px solid ${density === d ? 'var(--gold)' : 'var(--border)'}`, background: density === d ? 'var(--gold-dim)' : 'var(--surface)', cursor: 'pointer', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 'var(--text-small)', fontWeight: 600, color: density === d ? 'var(--gold)' : 'var(--text-muted)', textTransform: 'capitalize' }}>{d}</p>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{d === 'comfortable' ? 'More breathing room' : 'More rows visible'}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Default Landing Page</h3>
        <select className="input" style={{ maxWidth: 280 }} value={defaultPage} onChange={e => saveDefaultPage(e.target.value)}>
          {['/dashboard', '/requests', '/hr', '/work', '/notices', ...(level?.can_see_budgets || level?.is_accounting || (level && level.rank <= 1) ? ['/finance'] : [])].map(p => (
            <option key={p} value={p}>{p.replace('/', '').replace('-', ' ') || 'dashboard'}</option>
          ))}
        </select>
        <p style={{ margin: '0.5rem 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>The first page you see after signing in.</p>
      </div>
    </div>
  )
}

/* ── Profile Tab ──────────────────────────────────────────────────── */
function ProfileTab({ profile, post, tenant, refreshProfile }: any) {
  const [form, setForm] = useState({ full_name: '', phone: '' })
  const [pwForm, setPwForm] = useState({ newPw: '', confirm: '' })
  const [sessions, setSessions] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  useEffect(() => {
    if (profile) { setForm({ full_name: profile.full_name || '', phone: profile.phone || '' }); loadSessions() }
  }, [profile])

  async function loadSessions() {
    const { data } = await supabase.from('user_sessions').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(5)
    setSessions(data || [])
  }

  async function revokeSession(id: string) {
    await supabase.from('user_sessions').update({ invalidated_at: new Date().toISOString(), invalidated_reason: 'manual' }).eq('id', id)
    loadSessions()
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await supabase.from('user_profiles').update({ full_name: form.full_name, phone: form.phone }).eq('id', profile.id)
    await refreshProfile()
    setMsg('Profile updated'); setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  async function changePw(e: React.FormEvent) {
    e.preventDefault()
    if (pwForm.newPw !== pwForm.confirm) { setPwMsg('Passwords do not match'); return }
    if (pwForm.newPw.length < 8) { setPwMsg('Minimum 8 characters'); return }
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw })
    if (error) setPwMsg(error.message)
    else { setPwMsg('Password changed — other sessions invalidated'); setPwForm({ newPw: '', confirm: '' }) }
    setPwSaving(false)
    setTimeout(() => setPwMsg(''), 5000)
  }

  return (
    <div style={{ maxWidth: 500, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Avatar card */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-h3)', fontWeight: 700, color: '#0f0f23', flexShrink: 0 }}>
          {profile?.full_name?.charAt(0)}
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-body)' }}>{profile?.full_name}</p>
          <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{post?.title}</p>
          <p style={{ margin: '2px 0 0', color: 'var(--gold)', fontSize: 'var(--text-micro)', textTransform: 'capitalize' }}>{tenant?.plan} plan · {post?.hierarchy_levels?.name}</p>
        </div>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Personal Info</h3>
        <form onSubmit={saveProfile}>
          {[
            { label: 'Full Name', el: <input className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /> },
            { label: 'Phone', el: <input className="input" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+263..." /> },
          ].map(({ label, el }) => <div key={label} style={{ marginBottom: '1rem' }}><label className="form-label">{label}</label>{el}</div>)}
          {msg && <p style={{ color: 'var(--success)', fontSize: 'var(--text-small)', margin: '0 0 0.75rem' }}>{msg}</p>}
          <button type="submit" className="btn-gold" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 0.75rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Change Password</h3>
        <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', marginBottom: '1rem' }}>Changing password invalidates all other active sessions.</p>
        <form onSubmit={changePw}>
          {[{ label: 'New Password', field: 'newPw' }, { label: 'Confirm', field: 'confirm' }].map(({ label, field }) => (
            <div key={field} style={{ marginBottom: '1rem' }}>
              <label className="form-label">{label}</label>
              <input className="input" type="password" value={(pwForm as any)[field]} onChange={e => setPwForm({ ...pwForm, [field]: e.target.value })} />
            </div>
          ))}
          {pwMsg && <p style={{ color: pwMsg.includes('changed') ? 'var(--success)' : 'var(--danger)', fontSize: 'var(--text-small)', margin: '0 0 0.75rem' }}>{pwMsg}</p>}
          <button type="submit" className="btn-gold" disabled={pwSaving}>{pwSaving ? 'Changing...' : 'Change Password'}</button>
        </form>
      </div>

      {sessions.length > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Active Sessions</h3>
          <p style={{ margin: '0 0 0.75rem', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>VELA keeps up to 2 active sessions per account — signing in on a third device signs the oldest one out.</p>
          {sessions.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--bg-900)', borderRadius: 8, marginBottom: 4 }}>
              <div>
                <p style={{ margin: 0, fontSize: 'var(--text-small)' }}>{s.device_type || 'Unknown'} · {s.browser || 'Browser'}</p>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{s.created_at ? new Date(s.created_at).toLocaleDateString() : ''}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`badge ${s.invalidated_at ? 'badge-draft' : 'badge-active'}`} style={{ fontSize: 'var(--text-micro)' }}>
                  {s.invalidated_at ? 'Ended' : 'Active'}
                </span>
                {!s.invalidated_at && (
                  <button className="btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: 'var(--text-micro)', color: 'var(--danger)' }}
                    onClick={() => revokeSession(s.id)}>Sign out</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Appearance Tab ───────────────────────────────────────────────── */
function AppearanceTab({ theme, toggleTheme }: any) {
  return (
    <div style={{ maxWidth: 500, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card">
        <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Color Mode</h3>
        <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Choose the app's color scheme. Dark mode uses black backgrounds, light mode uses white.
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {(['dark', 'light'] as const).map(t => (
            <button
              key={t}
              onClick={() => t !== theme && toggleTheme()}
              style={{
                flex: 1, padding: '1rem', borderRadius: 12, cursor: 'pointer',
                border: `2px solid ${theme === t ? 'var(--gold)' : 'var(--border)'}`,
                background: t === 'dark' ? '#0f0f23' : '#ffffff',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                transition: 'all 0.2s'
              }}
            >
              {t === 'dark' ? <Moon size={22} style={{ color: 'var(--gold)' }} /> : <Sun size={22} style={{ color: '#b8892e' }} />}
              <span style={{ fontSize: 'var(--text-small)', fontWeight: 600, color: t === 'dark' ? '#f0ead6' : '#1a1814', textTransform: 'capitalize' }}>{t}</span>
              <span style={{ fontSize: 'var(--text-micro)', color: t === 'dark' ? '#8b8fa8' : '#6b6560' }}>
                {t === 'dark' ? 'Black background' : 'White background'}
              </span>
              {theme === t && <CheckCircle size={16} style={{ color: 'var(--gold)' }} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── White Label Tab ──────────────────────────────────────────────── */
function WhiteLabelTab({ profile, tenant, branding, refreshBranding }: any) {
  const isEnterprise = tenant?.plan === 'enterprise'
  const [form, setForm] = useState({
    app_name: '', tagline: '', primary_color: 'var(--gold)',
    secondary_color: '#16213e', hide_vela_branding: false
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (branding) {
      setForm({
        app_name: branding.app_name || 'VELA',
        tagline: branding.tagline || 'COMMAND YOUR GROUP',
        primary_color: branding.primary_color || 'var(--gold)',
        secondary_color: branding.secondary_color || '#16213e',
        hide_vela_branding: branding.hide_vela_branding || false,
      })
      setLogoPreview(branding.logo_url || null)
    }
  }, [branding])

  async function uploadLogo() {
    const file = fileRef.current?.files?.[0]
    if (!file || !profile) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${profile.tenant_id}/logo.${ext}`
    const { error } = await supabase.storage.from('vela-logos').upload(path, file, { upsert: true, contentType: file.type })
    if (!error) {
      const { data } = supabase.storage.from('vela-logos').getPublicUrl(path)
      setLogoPreview(data.publicUrl)
      await supabase.from('tenant_branding').upsert({ tenant_id: profile.tenant_id, logo_storage_path: path }, { onConflict: 'tenant_id' })
    }
    setUploading(false)
  }

  async function removeLogo() {
    if (!profile) return
    await supabase.from('tenant_branding').update({ logo_storage_path: null }).eq('tenant_id', profile.tenant_id)
    setLogoPreview(null)
    await refreshBranding()
  }

  async function save() {
    if (!profile) return
    setSaving(true)
    await supabase.from('tenant_branding').upsert({
      tenant_id: profile.tenant_id,
      app_name: form.app_name || null,
      tagline: form.tagline || null,
      primary_color: form.primary_color,
      secondary_color: form.secondary_color,
      hide_vela_branding: form.hide_vela_branding,
    }, { onConflict: 'tenant_id' })
    await refreshBranding()
    setMsg('Branding saved — reload to apply fully')
    setSaving(false)
    setTimeout(() => setMsg(''), 4000)
  }

  if (!isEnterprise) return (
    <div className="card" style={{ maxWidth: 480 }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-body)', margin: 0 }}>White labelling requires the Enterprise plan.</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 540, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Logo upload */}
      <div className="card">
        <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Logo</h3>
        <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Upload your company logo. It will replace the VELA shield icon in the sidebar. PNG, SVG, JPG. Max 5MB.
        </p>
        {logoPreview ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <img src={logoPreview} alt="Logo" style={{ height: 44, maxWidth: 180, objectFit: 'contain', background: 'var(--bg-900)', borderRadius: 8, padding: 6 }} />
            <button onClick={removeLogo} style={{ background: 'var(--danger-dim)', border: 'none', color: 'var(--danger)', borderRadius: 6, padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: 'var(--text-small)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Trash2 size={13} /> Remove
            </button>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }} onChange={uploadLogo} />
          <button className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-small)' }}>
            <Upload size={14} /> {uploading ? 'Uploading...' : logoPreview ? 'Replace Logo' : 'Upload Logo'}
          </button>
        </div>
      </div>

      {/* Branding text */}
      <div className="card">
        <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>App Identity</h3>
        {[
          { label: 'App Name (shown in sidebar)', key: 'app_name', placeholder: 'VELA' },
          { label: 'Tagline', key: 'tagline', placeholder: 'COMMAND YOUR GROUP' },
        ].map(({ label, key, placeholder }) => (
          <div key={key} style={{ marginBottom: '1rem' }}>
            <label className="form-label">{label}</label>
            <input className="input" value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} />
          </div>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 'var(--text-small)', marginBottom: '1rem' }}>
          <input type="checkbox" checked={form.hide_vela_branding} onChange={e => setForm({ ...form, hide_vela_branding: e.target.checked })} />
          <div>
            <span style={{ fontWeight: 500 }}>Remove all VELA branding</span>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>Hides "VELA", "Command Your Group", and all Anthropic/VELA references from the UI</p>
          </div>
        </label>
      </div>

      {/* Colors */}
      <div className="card">
        <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Brand Colors</h3>
        {[
          { label: 'Primary / Accent Color', key: 'primary_color', hint: 'Used for buttons, gold accents, active states' },
          { label: 'Sidebar Background', key: 'secondary_color', hint: 'Used for sidebar and card backgrounds' },
        ].map(({ label, key, hint }) => (
          <div key={key} style={{ marginBottom: '1rem' }}>
            <label className="form-label">{label}</label>
            <p style={{ margin: '0 0 0.5rem', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{hint}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input type="color" value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                style={{ width: 44, height: 38, borderRadius: 8, border: '1px solid var(--border)', padding: 2, background: 'transparent', cursor: 'pointer' }} />
              <input className="input" value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace" }} placeholder="var(--gold)" />
            </div>
          </div>
        ))}
        {/* Live preview */}
        <div style={{ padding: '0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: form.secondary_color, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: form.primary_color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={14} style={{ color: '#0f0f23' }} />
          </div>
          <span style={{ color: form.primary_color, fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 'var(--text-body)' }}>{form.app_name || 'Your App'}</span>
        </div>
      </div>

      {msg && <p style={{ color: 'var(--success)', fontSize: 'var(--text-small)' }}>{msg}</p>}
      <button className="btn-gold" onClick={save} disabled={saving} style={{ alignSelf: 'flex-start' }}>
        {saving ? 'Saving...' : 'Save Branding'}
      </button>
    </div>
  )
}

/* ── API & Integrations Tab ───────────────────────────────────────── */
function APITab({ profile, tenant }: any) {
  const [keys, setKeys] = useState<any[]>([])
  const [integrations, setIntegrations] = useState<any[]>([])
  const [newKey, setNewKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [keyForm, setKeyForm] = useState({ name: '', scopes: ['read'] as string[] })
  const [showCreate, setShowCreate] = useState(false)

  const isEnterprise = tenant?.plan === 'enterprise'

  useEffect(() => { if (profile && isEnterprise) load() }, [profile, isEnterprise])

  async function load() {
    const [kRes, iRes] = await Promise.all([
      supabase.from('api_keys').select('*').eq('tenant_id', profile.tenant_id).order('created_at', { ascending: false }),
      supabase.from('enterprise_integrations').select('*').eq('tenant_id', profile.tenant_id),
    ])
    setKeys(kRes.data || [])
    setIntegrations(iRes.data || [])
    setLoading(false)
  }

  async function createKey() {
    const rawKey = `vela_${Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')}`
    const encoder = new TextEncoder()
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey))
    const keyHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
    await supabase.from('api_keys').insert({
      tenant_id: profile.tenant_id, name: keyForm.name,
      key_hash: keyHash, key_prefix: rawKey.slice(0, 12) + '...',
      scopes: keyForm.scopes, rate_limit_per_min: 60, created_by: profile.id
    })
    setNewKey(rawKey)
    setShowCreate(false)
    load()
  }

  async function revokeKey(id: string) {
    if (!confirm('Revoke this key? Integrations using it will stop working.')) return
    await supabase.from('api_keys').update({ is_active: false }).eq('id', id)
    load()
  }

  if (!isEnterprise) return (
    <div className="card" style={{ maxWidth: 480 }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-body)', margin: 0 }}>API access requires the Enterprise plan. Stub endpoints are provisioned for Enterprise customers.</p>
    </div>
  )

  const integrationLabels: Record<string, string> = {
    payroll_sync: 'Payroll Real-Time Sync', zimra_autofiling: 'ZIMRA Auto-Filing',
    inventory_bom: 'Bill of Materials', inventory_mrp: 'MRP Planning',
    reporting_powerbi: 'Power BI Connector', reporting_custom: 'Custom Reports',
    rest_api: 'REST API Access', webhook_outbound: 'Outgoing Webhooks'
  }

  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {newKey && (
        <div className="card" style={{ borderColor: 'var(--success-dim)', background: 'var(--success-dim)' }}>
          <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--success)', fontSize: 'var(--text-small)' }}>⚡ Copy your key now — it won't be shown again</p>
          <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-small)', wordBreak: 'break-all' }}>{newKey}</code>
          <button className="btn-gold" onClick={() => { navigator.clipboard.writeText(newKey); setNewKey(null) }} style={{ marginTop: '0.75rem', fontSize: 'var(--text-small)', gap: 5 }}>Copy & Close</button>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>API Keys</h3>
          <button className="btn-gold" style={{ fontSize: 'var(--text-micro)', gap: 5 }} onClick={() => setShowCreate(!showCreate)}><Plus size={13} /> New Key</button>
        </div>
        {showCreate && (
          <div style={{ padding: '0.875rem', background: 'var(--bg-900)', borderRadius: 8, marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div><label className="form-label">Key Name</label><input className="input" value={keyForm.name} onChange={e => setKeyForm({ ...keyForm, name: e.target.value })} placeholder="e.g. Payroll Integration" /></div>
            <div>
              <label className="form-label">Scopes</label>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {['read', 'write', 'payroll', 'inventory', 'reporting'].map(s => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-small)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={keyForm.scopes.includes(s)} onChange={e => setKeyForm({ ...keyForm, scopes: e.target.checked ? [...keyForm.scopes, s] : keyForm.scopes.filter(x => x !== s) })} />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-ghost" style={{ fontSize: 'var(--text-small)' }} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn-gold" style={{ fontSize: 'var(--text-small)' }} onClick={createKey} disabled={!keyForm.name.trim()}>Generate</button>
            </div>
          </div>
        )}
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
                  <td>{k.is_active && <button onClick={() => revokeKey(k.id)} style={{ background: 'var(--danger-dim)', border: 'none', borderRadius: 6, color: 'var(--danger)', cursor: 'pointer', padding: '0.3rem 0.5rem' }}><Trash2 size={12} /></button>}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Enterprise Integrations</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {integrations.map(intg => (
            <div key={intg.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.75rem', background: 'var(--bg-900)', borderRadius: 8 }}>
              <div>
                <p style={{ margin: 0, fontSize: 'var(--text-small)', fontWeight: 500 }}>{integrationLabels[intg.integration_type] || intg.integration_type}</p>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>Provisioned — connect API endpoint to activate</p>
              </div>
              <span style={{ fontSize: 'var(--text-micro)', padding: '2px 7px', borderRadius: 999, background: intg.status === 'active' ? 'var(--success-dim)' : 'var(--warning-dim)', color: intg.status === 'active' ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                {intg.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Security Tab ─────────────────────────────────────────────────── */
function SecurityTab({ profile }: any) {
  const [loginAttempts, setLoginAttempts] = useState<any[]>([])
  const [passkeys, setPasskeys] = useState<any[]>([])
  const [pkLoading, setPkLoading] = useState(false)
  const [pkError, setPkError] = useState('')
  const [pkSupported, setPkSupported] = useState(true)

  useEffect(() => {
    if (!profile) return
    supabase.from('login_attempts').select('*').eq('email', profile.email || '')
      .order('attempted_at', { ascending: false }).limit(10)
      .then(({ data }) => setLoginAttempts(data || []))
    setPkSupported(typeof window !== 'undefined' && !!window.PublicKeyCredential)
    loadPasskeys()
  }, [profile])

  async function loadPasskeys() {
    const { data, error } = await supabase.auth.passkey.list()
    if (!error) setPasskeys(data || [])
  }

  async function addPasskey() {
    setPkError('')
    setPkLoading(true)
    const { error } = await supabase.auth.registerPasskey()
    setPkLoading(false)
    if (error) { setPkError(error.message); return }
    loadPasskeys()
  }

  async function removePasskey(passkeyId: string) {
    await supabase.auth.passkey.delete({ passkeyId })
    loadPasskeys()
  }

  return (
    <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card">
        <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Login Activity</h3>
        <table className="data-table">
          <thead><tr><th>Time</th><th>IP</th><th>Result</th></tr></thead>
          <tbody>
            {loginAttempts.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>No recent attempts</td></tr>
              : loginAttempts.map(a => (
                <tr key={a.id}>
                  <td style={{ fontSize: 'var(--text-small)' }}>{new Date(a.attempted_at).toLocaleString()}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-small)' }}>{a.ip_address || '—'}</td>
                  <td><span className={`badge ${a.success ? 'badge-approved' : 'badge-rejected'}`}>{a.success ? 'Success' : 'Failed'}</span></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 0.5rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Passkeys</h3>
        <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Sign in with Face ID, Touch ID, Windows Hello, or a security key — no password needed. Replaces the need for a separate 2FA code.
        </p>

        {!pkSupported && (
          <div style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning-dim)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', fontSize: 'var(--text-small)', color: 'var(--warning)' }}>
            This browser or device doesn't support passkeys. Try a recent version of Chrome, Safari, or Edge.
          </div>
        )}
        {pkError && (
          <div style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger-dim)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', fontSize: 'var(--text-small)', color: 'var(--danger)' }}>
            {pkError}
          </div>
        )}

        {passkeys.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: '1rem' }}>
            {passkeys.map(pk => (
              <div key={pk.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--bg-900)', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Fingerprint size={14} style={{ color: 'var(--gold)' }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 'var(--text-small)' }}>{pk.friendly_name || 'Passkey'}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
                      Added {new Date(pk.created_at).toLocaleDateString()}{pk.last_used_at ? ` · last used ${new Date(pk.last_used_at).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                </div>
                <button className="btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: 'var(--text-micro)', color: 'var(--danger)' }}
                  onClick={() => removePasskey(pk.id)}>Remove</button>
              </div>
            ))}
          </div>
        )}

        <button className="btn-gold" disabled={!pkSupported || pkLoading} onClick={addPasskey}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Fingerprint size={14} />
          {pkLoading ? 'Follow the prompt…' : 'Add a passkey'}
        </button>
      </div>
    </div>
  )
}

/* ── Subscription Tab ─────────────────────────────────────────────── */
function SubscriptionTab({ tenant, navigate }: any) {
  const plan = tenant?.plan || 'starter'
  const limits = getPlanLimits(plan as Plan)

  const planDescriptions: Record<string, { price: string; features: string[] }> = {
    starter: { price: '$49/mo', features: ['1 company', '5 branches', '50 employees', 'Basic PWA', 'Email support'] },
    group: { price: '$199/mo', features: ['5 companies', '50 branches', 'Unlimited employees', 'Consolidated reporting', 'Inter-company transfers', 'WhatsApp support'] },
    enterprise: { price: '$399/mo base', features: ['Unlimited companies', 'Unlimited branches', 'Premium support', 'Full API access', 'White-label', 'All add-ons available'] },
  }

  const info = planDescriptions[plan] || planDescriptions.starter

  return (
    <div style={{ maxWidth: 540, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card" style={{ borderColor: 'var(--gold)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: '0 0 0.25rem', fontSize: 'var(--text-micro)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current Plan</p>
            <p style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-h2)', fontWeight: 700, color: 'var(--gold)', textTransform: 'capitalize' }}>{plan}</p>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>{info.price}</p>
          </div>
          <span style={{ fontSize: 'var(--text-micro)', fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: 'var(--gold-ring)', color: 'var(--gold)', border: '1px solid var(--gold-border)', textTransform: 'uppercase' }}>{plan}</span>
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {info.features.map(f => (
            <span key={f} style={{ fontSize: 'var(--text-micro)', padding: '3px 9px', borderRadius: 999, background: 'var(--success-dim)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle size={11} /> {f}
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Feature Flags</h3>
        {[
          { label: 'Group Oversight & Hierarchy', enabled: limits.hasGroupOversight },
          { label: 'Insights Dashboard', enabled: limits.hasInsightsDashboard },
          { label: 'White-Label', enabled: limits.hasWhiteLabel },
          { label: 'REST API & Webhooks', enabled: limits.hasAPI },
          { label: 'Custom Report Builder', enabled: limits.hasCustomReports },
          { label: 'CSV Export', enabled: limits.hasCSVExport },
          { label: `Audit Retention (${limits.documentRetentionDays >= 365 ? Math.round(limits.documentRetentionDays/365) + ' yr' : limits.documentRetentionDays + ' days'})`, enabled: true },
        ].map(f => (
          <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 'var(--text-small)' }}>{f.label}</span>
            <span className={`badge ${f.enabled ? 'badge-approved' : 'badge-draft'}`}>{f.enabled ? 'Included' : 'Upgrade'}</span>
          </div>
        ))}
      </div>

      {plan !== 'enterprise' && (
        <button className="btn-gold" onClick={() => navigate('/register?upgrade=true')} style={{ alignSelf: 'flex-start', gap: 6 }}>
          Upgrade Plan →
        </button>
      )}
    </div>
  )
}
