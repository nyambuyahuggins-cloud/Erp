import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { audit } from '../lib/audit'
import { formatCurrency, convertCurrency, applyMinorityInterest } from '../lib/currency'
import type { Currency, ExchangeRate } from '../lib/currency'
import { TrendingUp, AlertCircle, CheckCircle, Clock, X, Plus, RefreshCw } from 'lucide-react'
import TabBar from '../components/TabBar'

interface Entity { id: string; name: string; entity_type: string }
interface Closing {
  id: string
  entity_id: string
  period: string
  submitted_pl: boolean
  reconciled_bank: boolean
  confirmed_interco_zero: boolean
  status: 'open' | 'in_progress' | 'submitted' | 'closed'
  notes: string | null
  entities?: { name: string }
}
interface Ownership {
  id: string
  entity_id: string
  group_ownership_pct: number
  minority_pct: number
  effective_from?: string
  entities?: { name: string }
}
interface RateRow {
  id: string
  from_currency: string
  to_currency: string
  rate: number
  rate_date: string
  rate_type: string
}

const CURRENCIES: Currency[] = ['USD', 'ZWG', 'ZAR', 'GBP', 'EUR']

export default function ConsolidationPage({ embedded }: { embedded?: boolean }) {
  const { profile, post } = useAuth()
  const [tab, setTab] = useState<'closing' | 'rates' | 'ownership' | 'elimination'>('closing')
  const [entities, setEntities] = useState<Entity[]>([])
  const [checklists, setChecklists] = useState<Closing[]>([])
  const [ownerships, setOwnerships] = useState<Ownership[]>([])
  const [rates, setRates] = useState<RateRow[]>([])
  const [eliminations, setEliminations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [showRateModal, setShowRateModal] = useState(false)
  const [showOwnershipModal, setShowOwnershipModal] = useState(false)
  const [rateForm, setRateForm] = useState({ from_currency: 'ZWG', rate: '', rate_date: new Date().toISOString().split('T')[0], rate_type: 'daily' })
  const [ownershipForm, setOwnershipForm] = useState({ entity_id: '', group_ownership_pct: '100' })

  const level = post?.hierarchy_levels
  const isExec = level && level.rank <= 1
  if (!isExec) return (
    <Layout title="Group Consolidation">
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Executive access only.</div>
    </Layout>
  )

  useEffect(() => { if (profile) loadAll() }, [profile, tab, period])

  async function loadAll() {
    setLoading(true)
    const tid = profile!.tenant_id
    const [entRes, clRes, owRes, rateRes, elimRes] = await Promise.all([
      supabase.from('entities').select('id,name,entity_type').eq('tenant_id', tid).eq('is_active', true),
      supabase.from('closing_checklists').select('*, entities!entity_id(name)').eq('tenant_id', tid).eq('period', period),
      supabase.from('entity_ownership').select('*, entities!entity_id(name)').eq('tenant_id', tid),
      supabase.from('exchange_rates').select('*').eq('tenant_id', tid).order('rate_date', { ascending: false }).limit(50),
      supabase.from('inter_entity_transactions').select('*, entities!initiating_entity(name)').eq('tenant_id', tid).eq('status', 'approved')
    ])
    setEntities(entRes.data || [])
    setChecklists(clRes.data || [])
    setOwnerships(owRes.data || [])
    setRates(rateRes.data || [])
    setEliminations(elimRes.data || [])
    setLoading(false)
  }

  async function initChecklist(entityId: string) {
    await supabase.from('closing_checklists').upsert({
      tenant_id: profile!.tenant_id,
      entity_id: entityId,
      period,
      status: 'open'
    }, { onConflict: 'tenant_id,entity_id,period' })
    loadAll()
  }

  async function updateChecklist(id: string, field: string, value: boolean | string) {
    const updateData: Record<string, unknown> = { [field]: value }
    if (typeof value === 'boolean' && value) {
      updateData[`${field}_at`] = new Date().toISOString()
      updateData[`${field}_by`] = profile!.id
    }
    // Auto-advance status
    const cl = checklists.find(c => c.id === id)
    if (cl) {
      const allDone = (field === 'submitted_pl' ? value : cl.submitted_pl) &&
        (field === 'reconciled_bank' ? value : cl.reconciled_bank) &&
        (field === 'confirmed_interco_zero' ? value : cl.confirmed_interco_zero)
      if (allDone) updateData.status = 'submitted'
    }
    await supabase.from('closing_checklists').update(updateData).eq('id', id)
    loadAll()
  }

  async function closeEntity(id: string) {
    await supabase.from('closing_checklists').update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: profile!.id
    }).eq('id', id)
    loadAll()
  }

  async function addRate() {
    if (!rateForm.rate) return
    await supabase.from('exchange_rates').upsert({
      tenant_id: profile!.tenant_id,
      from_currency: rateForm.from_currency,
      to_currency: 'USD',
      rate: parseFloat(rateForm.rate),
      rate_date: rateForm.rate_date,
      rate_type: rateForm.rate_type,
      created_by: profile!.id
    }, { onConflict: 'tenant_id,from_currency,to_currency,rate_date,rate_type' })
    setShowRateModal(false)
    loadAll()
  }

  async function saveOwnership() {
    if (!ownershipForm.entity_id) return
    await supabase.from('entity_ownership').upsert({
      tenant_id: profile!.tenant_id,
      entity_id: ownershipForm.entity_id,
      group_ownership_pct: parseFloat(ownershipForm.group_ownership_pct),
      effective_from: new Date().toISOString().split('T')[0]
    }, { onConflict: 'tenant_id,entity_id,effective_from' })
    setShowOwnershipModal(false)
    loadAll()
  }

  async function eliminateTransaction(id: string) {
    await supabase.from('inter_entity_transactions').update({
      is_eliminated: true,
      eliminated_at: new Date().toISOString(),
      eliminated_by: profile!.id
    }).eq('id', id)
    await audit.updated({
      tenant_id: profile!.tenant_id, actor_id: profile!.id,
      entity_type: 'inter_entity_transaction', entity_id: id,
      after_snapshot: { is_eliminated: true }
    })
    loadAll()
  }

  const subsidiaries = entities.filter(e => e.entity_type === 'subsidiary')
  const rateMap: ExchangeRate[] = rates.map(r => ({
    from_currency: r.from_currency, to_currency: r.to_currency,
    rate: r.rate, rate_date: r.rate_date, rate_type: r.rate_type as 'daily' | 'monthly_avg' | 'closing'
  }))

  // Compute consolidation stats
  const totalInterco = eliminations.reduce((s, e) => s + (e.amount_usd || e.amount), 0)
  const eliminated = eliminations.filter(e => e.is_eliminated).reduce((s, e) => s + (e.amount_usd || e.amount), 0)
  const outstanding = totalInterco - eliminated

  const statusConfig = {
    open: { color: 'var(--danger)', bg: 'var(--danger-dim)', label: 'Open' },
    in_progress: { color: 'var(--warning)', bg: 'var(--warning-dim)', label: 'In Progress' },
    submitted: { color: 'var(--info)', bg: 'var(--info-dim)', label: 'Submitted' },
    closed: { color: 'var(--success)', bg: 'var(--success-dim)', label: 'Closed' },
  }

  const inner = (
    <Layout title="Group Consolidation">
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.875rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Subsidiaries', value: subsidiaries.length, color: 'var(--gold)' },
          { label: 'Closed', value: checklists.filter(c => c.status === 'closed').length, color: 'var(--success)' },
          { label: 'Pending Close', value: subsidiaries.length - checklists.filter(c => c.status === 'closed').length, color: '#f97316' },
          { label: 'Interco Outstanding', value: formatCurrency(outstanding, 'USD'), color: 'var(--danger)' },
          { label: 'Eliminated', value: formatCurrency(eliminated, 'USD'), color: 'var(--success)' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <p style={{ fontSize: 'var(--text-h2)', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: s.color, margin: 0 }}>{s.value}</p>
            <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Period</span>
        <input type="month" className="input" style={{ width: 160 }} value={period} onChange={e => setPeriod(e.target.value)} />
      </div>

      {/* Tabs */}
      <TabBar style={{ marginBottom: '1.25rem' }}>
        {(['closing', 'rates', 'ownership', 'elimination'] as const).map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'closing' ? 'Closing Checklist' : t === 'rates' ? 'Exchange Rates' : t === 'ownership' ? 'Ownership' : 'Eliminations'}
          </button>
        ))}
      </TabBar>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}><div className="spinner" /></div>
      ) : (
        <>
          {/* CLOSING CHECKLIST */}
          {tab === 'closing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {subsidiaries.length === 0 && (
                <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No subsidiaries found</div>
              )}
              {subsidiaries.map(entity => {
                const cl = checklists.find(c => c.entity_id === entity.id)
                const status = cl?.status || 'open'
                const cfg = statusConfig[status]
                return (
                  <div key={entity.id} className="card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: 'var(--text-body)', fontWeight: 600 }}>{entity.name}</h4>
                        <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{period}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: 'var(--text-micro)', padding: '3px 9px', borderRadius: 999, background: cfg.bg, color: cfg.color, fontWeight: 600 }}>
                          {cfg.label}
                        </span>
                        {status === 'submitted' && (
                          <button className="btn-gold" style={{ fontSize: 'var(--text-micro)', padding: '0.3rem 0.75rem' }}
                            onClick={() => cl && closeEntity(cl.id)}>
                            Close Period
                          </button>
                        )}
                      </div>
                    </div>
                    {cl ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {[
                          { field: 'submitted_pl', label: 'Submit P&L', value: cl.submitted_pl },
                          { field: 'reconciled_bank', label: 'Reconcile Bank', value: cl.reconciled_bank },
                          { field: 'confirmed_interco_zero', label: 'Confirm Interco Balance = 0', value: cl.confirmed_interco_zero },
                        ].map(item => (
                          <label key={item.field} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: status !== 'closed' ? 'pointer' : 'default', fontSize: 'var(--text-small)' }}>
                            <input
                              type="checkbox"
                              checked={item.value}
                              disabled={status === 'closed'}
                              onChange={e => updateChecklist(cl.id, item.field, e.target.checked)}
                            />
                            <span style={{ color: item.value ? 'var(--success)' : 'var(--text-primary)' }}>{item.label}</span>
                            {item.value && <CheckCircle size={14} style={{ color: 'var(--success)' }} />}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <button className="btn-ghost" style={{ fontSize: 'var(--text-small)' }} onClick={() => initChecklist(entity.id)}>
                        <Plus size={13} style={{ marginRight: 5 }} />Initialize Checklist
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* EXCHANGE RATES */}
          {tab === 'rates' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button className="btn-gold" style={{ fontSize: 'var(--text-small)', display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => setShowRateModal(true)}>
                  <Plus size={14} /> Add Rate
                </button>
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="data-table">
                  <thead><tr><th>Currency</th><th>Rate (to USD)</th><th>Date</th><th>Type</th></tr></thead>
                  <tbody>
                    {rates.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No rates set. USD base assumed for all entities.
                      </td></tr>
                    ) : rates.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600, color: 'var(--gold)' }}>{r.from_currency}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>1 {r.from_currency} = {r.rate} USD</td>
                        <td>{r.rate_date}</td>
                        <td><span className="badge badge-draft">{r.rate_type}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* OWNERSHIP */}
          {tab === 'ownership' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button className="btn-gold" style={{ fontSize: 'var(--text-small)', display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => setShowOwnershipModal(true)}>
                  <Plus size={14} /> Set Ownership
                </button>
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="data-table">
                  <thead><tr><th>Entity</th><th>Group %</th><th>Minority %</th><th>Effective</th></tr></thead>
                  <tbody>
                    {ownerships.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No ownership records. 100% assumed for all subsidiaries.
                      </td></tr>
                    ) : ownerships.map(o => (
                      <tr key={o.id}>
                        <td style={{ fontWeight: 500 }}>{o.entities?.name}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--gold)' }}>{o.group_ownership_pct}%</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", color: o.minority_pct > 0 ? '#f97316' : 'var(--text-muted)' }}>
                          {o.minority_pct}%
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{new Date(o.effective_from || '').toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ELIMINATION VIEW */}
          {tab === 'elimination' && (
            <>
              <div style={{ display: 'flex', gap: '0.875rem', marginBottom: '1.25rem' }}>
                <div className="card" style={{ flex: 1, borderLeft: '3px solid var(--danger)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>Pre-Elimination</p>
                  <p style={{ margin: '4px 0 0', fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-lead)', color: 'var(--danger)' }}>{formatCurrency(totalInterco)}</p>
                </div>
                <div className="card" style={{ flex: 1, borderLeft: '3px solid var(--success)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>Eliminated</p>
                  <p style={{ margin: '4px 0 0', fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-lead)', color: 'var(--success)' }}>{formatCurrency(eliminated)}</p>
                </div>
                <div className="card" style={{ flex: 1, borderLeft: '3px solid var(--gold)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>Outstanding</p>
                  <p style={{ margin: '4px 0 0', fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-lead)', color: 'var(--gold)' }}>{formatCurrency(outstanding)}</p>
                </div>
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="data-table">
                  <thead><tr><th>Ref</th><th>Description</th><th>Amount</th><th>Entity</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {eliminations.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No inter-entity transactions</td></tr>
                    ) : eliminations.map(tx => (
                      <tr key={tx.id}>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-small)', color: 'var(--gold)' }}>{tx.ref}</td>
                        <td style={{ fontSize: 'var(--text-small)' }}>{tx.title}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(tx.amount_usd || tx.amount)}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{tx.entities?.name}</td>
                        <td>
                          <span className={`badge ${tx.is_eliminated ? 'badge-approved' : 'badge-pending'}`}>
                            {tx.is_eliminated ? 'Eliminated' : 'Outstanding'}
                          </span>
                        </td>
                        <td>
                          {!tx.is_eliminated && (
                            <button onClick={() => eliminateTransaction(tx.id)} className="btn-ghost" style={{ fontSize: 'var(--text-micro)', padding: '0.3rem 0.6rem' }}>
                              Eliminate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* Rate Modal */}
      {showRateModal && (
        <div className="modal-backdrop" onClick={() => setShowRateModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1.25rem', fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-body)' }}>Add Exchange Rate</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {[
                { label: 'Currency', el: <select className="input" value={rateForm.from_currency} onChange={e => setRateForm({ ...rateForm, from_currency: e.target.value })}>{CURRENCIES.filter(c => c !== 'USD').map(c => <option key={c} value={c}>{c}</option>)}</select> },
                { label: 'Rate (1 currency = ? USD)', el: <input className="input" type="number" step="0.000001" value={rateForm.rate} onChange={e => setRateForm({ ...rateForm, rate: e.target.value })} placeholder="e.g. 0.00116 for ZWG" /> },
                { label: 'Date', el: <input className="input" type="date" value={rateForm.rate_date} onChange={e => setRateForm({ ...rateForm, rate_date: e.target.value })} /> },
                { label: 'Type', el: <select className="input" value={rateForm.rate_type} onChange={e => setRateForm({ ...rateForm, rate_type: e.target.value })}><option value="daily">Daily</option><option value="monthly_avg">Monthly Average</option><option value="closing">Closing</option></select> },
              ].map(({ label, el }) => (
                <div key={label}>
                  <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
                  {el}
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button className="btn-ghost" onClick={() => setShowRateModal(false)}>Cancel</button>
                <button className="btn-gold" onClick={addRate}>Save Rate</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ownership Modal */}
      {showOwnershipModal && (
        <div className="modal-backdrop" onClick={() => setShowOwnershipModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1.25rem', fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-body)' }}>Set Group Ownership</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Entity</label>
                <select className="input" value={ownershipForm.entity_id} onChange={e => setOwnershipForm({ ...ownershipForm, entity_id: e.target.value })}>
                  <option value="">Select entity...</option>
                  {subsidiaries.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Group Ownership %</label>
                <input className="input" type="number" min="1" max="100" value={ownershipForm.group_ownership_pct} onChange={e => setOwnershipForm({ ...ownershipForm, group_ownership_pct: e.target.value })} />
                <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  Minority: {100 - parseFloat(ownershipForm.group_ownership_pct || '100')}%
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button className="btn-ghost" onClick={() => setShowOwnershipModal(false)}>Cancel</button>
                <button className="btn-gold" onClick={saveOwnership}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
  if (embedded) return <>{(inner as any).props.children}</>
  return inner
}
