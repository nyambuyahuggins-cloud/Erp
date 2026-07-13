import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { audit } from '../lib/audit'
import { Key, Plus, Trash2, Copy, Eye, EyeOff, Globe, Webhook, RefreshCw, Activity, X, Mail, Clock, BarChart2 } from 'lucide-react'
import { getFeatureGateMessage } from '../lib/planEnforcement'

// ─── API Keys Page ────────────────────────────────────────────────────────────
export function APIKeysPage() {
  const { profile, post, tenant } = useAuth()
  const [keys, setKeys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyVisible, setNewKeyVisible] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', scopes: ['read'] as string[], entity_id: '', rate_limit_per_min: '60' })
  const [entities, setEntities] = useState<any[]>([])

  const isExec = post?.hierarchy_levels?.rank <= 1
  const isEnterprise = tenant?.plan === 'enterprise'

  useEffect(() => { if (profile) { load(); loadEntities() } }, [profile])

  async function load() {
    const { data } = await supabase.from('api_keys').select('*').eq('tenant_id', profile!.tenant_id).order('created_at', { ascending: false })
    setKeys(data || [])
    setLoading(false)
  }

  async function loadEntities() {
    const { data } = await supabase.from('entities').select('id,name').eq('tenant_id', profile!.tenant_id).eq('is_active', true)
    setEntities(data || [])
  }

  async function createKey() {
    if (!form.name.trim()) return
    // Generate a key: vela_xxxxxxxx... (32 hex chars)
    const rawKey = `vela_${Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')}`
    const prefix = rawKey.slice(0, 12) + '...'

    // Hash: SHA-256 (using SubtleCrypto)
    const encoder = new TextEncoder()
    const data = encoder.encode(rawKey)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

    await supabase.from('api_keys').insert({
      tenant_id: profile!.tenant_id,
      entity_id: form.entity_id || null,
      name: form.name,
      key_hash: keyHash,
      key_prefix: prefix,
      scopes: form.scopes,
      rate_limit_per_min: parseInt(form.rate_limit_per_min),
      created_by: profile!.id
    })

    await audit.submitted({ tenant_id: profile!.tenant_id, actor_id: profile!.id, entity_type: 'api_key', entity_id: keyHash.slice(0, 8), entity_name: form.name })

    setNewKeyVisible(rawKey)
    setShowCreate(false)
    setForm({ name: '', scopes: ['read'], entity_id: '', rate_limit_per_min: '60' })
    load()
  }

  async function revokeKey(id: string) {
    if (!confirm('Revoke this API key? All integrations using it will stop working.')) return
    await supabase.from('api_keys').update({ is_active: false }).eq('id', id)
    load()
  }

  if (!isExec || !isEnterprise) return (
    <Layout title="API Keys">
      <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: '2rem' }}>
        <Key size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-body)' }}>{getFeatureGateMessage('API Keys')}</p>
      </div>
    </Layout>
  )

  return (
    <Layout title="API Keys" action={
      <button className="btn-gold" style={{ fontSize: 'var(--text-small)', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowCreate(true)}>
        <Plus size={14} /> New Key
      </button>
    }>
      {/* One-time key display */}
      {newKeyVisible && (
        <div className="card" style={{ marginBottom: '1.25rem', borderColor: 'var(--success-dim)', background: 'var(--success-dim)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--success)', fontSize: 'var(--text-small)' }}>⚡ Key created — copy it now. It will never be shown again.</p>
              <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-small)', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{newKeyVisible}</code>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(newKeyVisible); setNewKeyVisible(null) }} className="btn-gold" style={{ fontSize: 'var(--text-micro)', flexShrink: 0, marginLeft: '1rem', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Copy size={13} /> Copy & Close
            </button>
          </div>
        </div>
      )}

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}><div className="spinner" /></div> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Prefix</th><th>Scopes</th><th>Rate Limit</th><th>Last Used</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {keys.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No API keys yet</td></tr>
              ) : keys.map(k => (
                <tr key={k.id}>
                  <td style={{ fontWeight: 500 }}>{k.name}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-small)', color: 'var(--gold)' }}>{k.key_prefix}</td>
                  <td>{k.scopes.map((s: string) => <span key={s} className="badge badge-draft" style={{ marginRight: 3 }}>{s}</span>)}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace', fontSize: 'var(--text-small)'" }}>{k.rate_limit_per_min}/min</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</td>
                  <td><span className={`badge ${k.is_active ? 'badge-active' : 'badge-rejected'}`}>{k.is_active ? 'Active' : 'Revoked'}</span></td>
                  <td>{k.is_active && <button onClick={() => revokeKey(k.id)} style={{ background: 'var(--danger-dim)', border: 'none', borderRadius: 6, color: 'var(--danger)', cursor: 'pointer', padding: '0.3rem 0.6rem' }}><Trash2 size={13} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-body)' }}>Create API Key</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Key Name *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Payroll Sync Production" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scopes</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {['read', 'write', 'payroll', 'inventory', 'reporting'].map(scope => (
                    <label key={scope} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 'var(--text-small)' }}>
                      <input type="checkbox" checked={form.scopes.includes(scope)}
                        onChange={e => setForm({ ...form, scopes: e.target.checked ? [...form.scopes, scope] : form.scopes.filter(s => s !== scope) })} />
                      {scope}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rate Limit (req/min)</label>
                <input className="input" type="number" value={form.rate_limit_per_min} onChange={e => setForm({ ...form, rate_limit_per_min: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn-gold" onClick={createKey}>Generate Key</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

// ─── Integrations Page ────────────────────────────────────────────────────────
export function IntegrationsPage() {
  const { profile, post, tenant } = useAuth()
  const [integrations, setIntegrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const isExec = post?.hierarchy_levels?.rank <= 1
  const isEnterprise = tenant?.plan === 'enterprise'

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    const { data } = await supabase.from('enterprise_integrations')
      .select('*')
      .eq('tenant_id', profile!.tenant_id)
      .order('integration_type')
    setIntegrations(data || [])
    setLoading(false)
  }

  const typeConfig: Record<string, { label: string; description: string; fromTable: string }> = {
    payroll_sync: { label: 'Payroll Real-Time Sync', description: 'Full real-time payroll synchronisation. Connect your external payroll provider.', fromTable: 'enterprise' },
    zimra_autofiling: { label: 'ZIMRA Auto-Filing', description: 'Automated ZIMRA VAT and tax submissions. Replace manual CSV exports.', fromTable: 'enterprise' },
    inventory_bom: { label: 'Bill of Materials (BOM)', description: 'Multi-level BOM management for manufacturing and assembly.', fromTable: 'enterprise' },
    inventory_mrp: { label: 'Material Requirements Planning', description: 'Automated procurement planning based on demand forecasts.', fromTable: 'enterprise' },
    reporting_powerbi: { label: 'Power BI Connector', description: 'Push VELA data to Microsoft Power BI for custom dashboards.', fromTable: 'enterprise' },
    reporting_custom: { label: 'Custom Report Builder', description: 'Build and schedule custom reports beyond the standard templates.', fromTable: 'enterprise' },
    rest_api: { label: 'REST API Access', description: 'Full CRUD REST API with API key authentication per subsidiary.', fromTable: 'enterprise' },
    webhook_outbound: { label: 'Outgoing Webhooks', description: 'Receive real-time events on invoice approval, employee changes, and more.', fromTable: 'enterprise' },
  }

  const statusConfig = {
    provisioned: { color: 'var(--warning)', label: 'Provisioned — Awaiting Setup' },
    active: { color: 'var(--success)', label: 'Active' },
    suspended: { color: 'var(--danger)', label: 'Suspended' },
    deprovisioned: { color: '#9ca3af', label: 'Deprovisioned' },
  }

  if (!isExec || !isEnterprise) return (
    <Layout title="Integrations">
      <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: '2rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-body)' }}>{getFeatureGateMessage('Enterprise Integrations')}</p>
      </div>
    </Layout>
  )

  return (
    <Layout title="Enterprise Integrations">
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)', marginBottom: '1.5rem' }}>
        Your Enterprise integrations are provisioned and ready to activate. Contact your implementation team or connect your API endpoint to go live.
      </p>
      {loading ? <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}><div className="spinner" /></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.875rem' }}>
          {integrations.map(intg => {
            const cfg = typeConfig[intg.integration_type]
            if (!cfg) return null
            const status = statusConfig[intg.status as keyof typeof statusConfig]
            return (
              <div key={intg.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ margin: 0, fontSize: 'var(--text-body)', fontWeight: 600 }}>{cfg.label}</h4>
                  <span style={{ fontSize: 'var(--text-micro)', padding: '2px 7px', borderRadius: 999, background: `${status.color}15`, color: status.color, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                    {intg.status === 'provisioned' ? '⏳ Provisioned' : intg.status === 'active' ? '✓ Active' : intg.status}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 'var(--text-small)', color: 'var(--text-muted)', lineHeight: 1.5 }}>{cfg.description}</p>
                {intg.last_sync_at && (
                  <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
                    Last sync: {new Date(intg.last_sync_at).toLocaleString()}
                  </p>
                )}
                <button className="btn-ghost" style={{ fontSize: 'var(--text-micro)', marginTop: 'auto' }} disabled>
                  Connect API Endpoint →
                </button>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}

// ─── Reports / Scheduled Reporting Page ──────────────────────────────────────
export function ReportsPage() {
  const { profile, post } = useAuth()
  const [subs, setSubs] = useState<any[]>([])
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [entities, setEntities] = useState<any[]>([])
  const [form, setForm] = useState({
    report_type: 'entity_summary',
    entity_id: '',
    schedule_label: 'Weekly (Monday 8AM)',
    schedule_cron: '0 8 * * 1',
    format: 'pdf',
    variance_threshold_pct: ''
  })

  const isExec = post?.hierarchy_levels?.rank <= 1

  const REPORT_TYPES = [
    { value: 'consolidated_pl', label: 'Consolidated P&L' },
    { value: 'entity_summary', label: 'Entity Summary' },
    { value: 'payroll', label: 'Payroll Report' },
    { value: 'inventory', label: 'Inventory Report' },
    { value: 'audit', label: 'Audit Log Export' },
  ]

  const SCHEDULES = [
    { label: 'Daily (8AM)', cron: '0 8 * * *' },
    { label: 'Weekly (Monday 8AM)', cron: '0 8 * * 1' },
    { label: 'Monthly (1st, 8AM)', cron: '0 8 1 * *' },
  ]

  useEffect(() => { if (profile) { load(); loadEntities() } }, [profile])

  async function load() {
    const [subRes, delRes] = await Promise.all([
      supabase.from('report_subscriptions').select('*').eq('tenant_id', profile!.tenant_id).order('created_at', { ascending: false }),
      supabase.from('report_delivery_log').select('*').eq('tenant_id', profile!.tenant_id).order('sent_at', { ascending: false }).limit(20)
    ])
    setSubs(subRes.data || [])
    setDeliveries(delRes.data || [])
    setLoading(false)
  }

  async function loadEntities() {
    const { data } = await supabase.from('entities').select('id,name').eq('tenant_id', profile!.tenant_id).eq('is_active', true)
    setEntities(data || [])
  }

  async function createSubscription() {
    await supabase.from('report_subscriptions').insert({
      tenant_id: profile!.tenant_id,
      subscriber_id: profile!.id,
      report_type: form.report_type,
      entity_id: form.entity_id || null,
      schedule_cron: form.schedule_cron,
      schedule_label: form.schedule_label,
      format: form.format,
      variance_threshold_pct: form.variance_threshold_pct ? parseFloat(form.variance_threshold_pct) : null,
    })
    setShowCreate(false)
    load()
  }

  async function toggleSub(id: string, isActive: boolean) {
    await supabase.from('report_subscriptions').update({ is_active: !isActive }).eq('id', id)
    load()
  }

  async function deleteSub(id: string) {
    await supabase.from('report_subscriptions').delete().eq('id', id)
    load()
  }

  if (!isExec) return (
    <Layout title="Scheduled Reports">
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Executive access only.</div>
    </Layout>
  )

  return (
    <Layout title="Scheduled Reports" action={
      <button className="btn-gold" style={{ fontSize: 'var(--text-small)', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowCreate(true)}>
        <Plus size={14} /> Subscribe
      </button>
    }>
      <div className="card" style={{ marginBottom: '1.25rem', background: 'var(--info-dim)', border: '1px solid var(--border)', fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
        📨 Subscriptions are saved immediately, but actual delivery requires the <strong style={{ color: 'var(--gold)' }}>Email API</strong> add-on to be provisioned first (Admin → Add-ons). Until then, subscriptions won't generate deliveries.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Subscriptions */}
        <div>
          <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-small)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Active Subscriptions</h3>
          {loading ? <div className="spinner" style={{ margin: '2rem auto' }} /> : subs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>
              No report subscriptions yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {subs.map(sub => (
                <div key={sub.id} className="card" style={{ opacity: sub.is_active ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-small)' }}>{REPORT_TYPES.find(t => t.value === sub.report_type)?.label || sub.report_type}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{sub.schedule_label} · {sub.format.toUpperCase()}</p>
                    </div>
                    <span className={`badge ${sub.is_active ? 'badge-active' : 'badge-draft'}`}>{sub.is_active ? 'Active' : 'Paused'}</span>
                  </div>
                  {sub.variance_threshold_pct && (
                    <p style={{ margin: '0 0 0.5rem', fontSize: 'var(--text-micro)', color: 'var(--warning)' }}>
                      ⚡ Only if deviation &gt;{sub.variance_threshold_pct}%
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-ghost" style={{ fontSize: 'var(--text-micro)', padding: '0.3rem 0.6rem' }}
                      onClick={() => toggleSub(sub.id, sub.is_active)}>
                      {sub.is_active ? 'Pause' : 'Resume'}
                    </button>
                    <button onClick={() => deleteSub(sub.id)} style={{ background: 'var(--danger-dim)', border: 'none', borderRadius: 6, color: 'var(--danger)', cursor: 'pointer', padding: '0.3rem 0.5rem' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delivery log */}
        <div>
          <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-small)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Delivery Log</h3>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead><tr><th>Report</th><th>Sent</th><th>Status</th></tr></thead>
              <tbody>
                {deliveries.length === 0 ? (
                  <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>No deliveries yet</td></tr>
                ) : deliveries.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontSize: 'var(--text-small)' }}>{d.subscription_id?.slice(0, 8)}</td>
                    <td style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{new Date(d.sent_at).toLocaleString()}</td>
                    <td><span className={`badge ${d.status === 'sent' ? 'badge-approved' : d.status === 'failed' ? 'badge-rejected' : 'badge-draft'}`}>{d.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-body)' }}>Subscribe to Report</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {[
                { label: 'Report Type', el: <select className="input" value={form.report_type} onChange={e => setForm({ ...form, report_type: e.target.value })}>{REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select> },
                { label: 'Entity (blank = all)', el: <select className="input" value={form.entity_id} onChange={e => setForm({ ...form, entity_id: e.target.value })}><option value="">All Entities</option>{entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select> },
                { label: 'Schedule', el: <select className="input" value={form.schedule_cron} onChange={e => { const s = SCHEDULES.find(s => s.cron === e.target.value); setForm({ ...form, schedule_cron: e.target.value, schedule_label: s?.label || '' }) }}>{SCHEDULES.map(s => <option key={s.cron} value={s.cron}>{s.label}</option>)}</select> },
                { label: 'Format', el: <select className="input" value={form.format} onChange={e => setForm({ ...form, format: e.target.value })}><option value="pdf">PDF</option><option value="csv">CSV</option><option value="json">JSON</option></select> },
                { label: 'Only send if deviation > % (blank = always)', el: <input className="input" type="number" placeholder="e.g. 10 for 10%" value={form.variance_threshold_pct} onChange={e => setForm({ ...form, variance_threshold_pct: e.target.value })} /> },
              ].map(({ label, el }) => (
                <div key={label}>
                  <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
                  {el}
                </div>
              ))}
              <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', margin: 0 }}>
                Reports will be generated on schedule and stored. Email delivery requires SMTP configuration (connect via Integrations).
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn-gold" onClick={createSubscription}>Subscribe</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

// ─── Settings Page ────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { profile, post, tenant } = useAuth()
  const [branding, setBranding] = useState<any>(null)
  const [form, setForm] = useState({ app_name: 'VELA', primary_color: 'var(--gold)' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const isExec = post?.hierarchy_levels?.rank <= 1
  const isEnterprise = tenant?.plan === 'enterprise'

  useEffect(() => { if (profile) loadBranding() }, [profile])

  async function loadBranding() {
    const { data } = await supabase.from('tenant_branding').select('*').eq('tenant_id', profile!.tenant_id).single()
    if (data) { setBranding(data); setForm({ app_name: data.app_name || 'VELA', primary_color: data.primary_color || 'var(--gold)' }) }
  }

  async function saveBranding() {
    setSaving(true)
    await supabase.from('tenant_branding').upsert({
      tenant_id: profile!.tenant_id,
      app_name: form.app_name,
      primary_color: form.primary_color
    }, { onConflict: 'tenant_id' })
    setMsg('Branding saved')
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <Layout title="Settings">
      <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Plan info */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Subscription</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div>
              <p style={{ margin: 0, fontSize: 'var(--text-h3)', fontWeight: 700, color: 'var(--gold)', fontFamily: "'Playfair Display', serif", textTransform: 'capitalize' }}>{tenant?.plan || 'Starter'}</p>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
                {tenant?.plan === 'enterprise' ? 'Unlimited companies, branches, employees' :
                  tenant?.plan === 'group' ? 'Up to 5 companies, 50 branches' : 'Up to 1 company, 5 branches, 50 employees'}
              </p>
            </div>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { label: 'White Label', on: tenant?.white_label_enabled },
              { label: 'REST API', on: tenant?.api_enabled },
              { label: 'Advanced Consolidation', on: tenant?.plan !== 'starter' },
              { label: 'BOM / MRP', on: tenant?.plan === 'enterprise' },
            ].map(f => (
              <span key={f.label} style={{
                fontSize: 'var(--text-micro)', padding: '3px 9px', borderRadius: 999,
                background: f.on ? 'var(--success-dim)' : 'rgba(107,114,128,0.1)',
                color: f.on ? 'var(--success)' : '#6b7280'
              }}>{f.on ? '✓' : '✗'} {f.label}</span>
            ))}
          </div>
        </div>

        {/* White-label branding (Enterprise only) */}
        {isExec && isEnterprise && (
          <div className="card">
            <h3 style={{ margin: '0 0 1rem', fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>White-Label Branding</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>App Name</label>
                <input className="input" value={form.app_name} onChange={e => setForm({ ...form, app_name: e.target.value })} placeholder="VELA" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Primary Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input type="color" value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} style={{ width: 44, height: 38, borderRadius: 8, border: '1px solid var(--border)', padding: 2, background: 'transparent', cursor: 'pointer' }} />
                  <input className="input" value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} style={{ flex: 1 }} />
                </div>
              </div>
              {msg && <p style={{ color: 'var(--success)', fontSize: 'var(--text-small)', margin: 0 }}>{msg}</p>}
              <button className="btn-gold" onClick={saveBranding} disabled={saving}>{saving ? 'Saving...' : 'Save Branding'}</button>
            </div>
          </div>
        )}

        {/* Currencies */}
        <div className="card">
          <h3 style={{ margin: '0 0 0.75rem', fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Supported Currencies</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(tenant?.supported_currencies || ['USD']).map((c: string) => (
              <span key={c} style={{ fontSize: 'var(--text-small)', padding: '4px 10px', borderRadius: 999, background: 'var(--gold-soft)', color: 'var(--gold)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{c}</span>
            ))}
          </div>
          <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', marginTop: '0.75rem', marginBottom: 0 }}>
            Base currency: {tenant?.currency_base || 'USD'}. Exchange rates managed in Group Consolidation.
          </p>
        </div>
      </div>
    </Layout>
  )
}
