import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Shield, CheckCircle, ArrowRight, MessageCircle } from 'lucide-react'
import type { Plan } from '../lib/planEnforcement'

const PLAN_DETAILS: { key: Plan; name: string; tagline: string; monthly: number | null; annual: number | null; features: string[]; featured?: boolean }[] = [
  {
    key: 'starter', name: 'Starter', tagline: 'Single company',
    monthly: 49, annual: 499,
    features: ['1 company · 5 branches · 50 employees', 'Requests with default approval routing', 'People: leave, expenses, complaints', 'Tasks & Targets', 'Notices & compliance calendar', 'CSV export', 'Email support'],
  },
  {
    key: 'group', name: 'Group', tagline: 'Multi-company holding group',
    monthly: 199, annual: 1999, featured: true,
    features: ['Everything in Starter', 'Up to 5 companies · 50 branches · Unlimited employees', 'Group oversight dashboard', 'Inter-entity transfer requests', 'Configurable approval thresholds', 'Offline document signing + SMS fallback', 'WhatsApp support'],
  },
  {
    key: 'enterprise', name: 'Enterprise', tagline: 'Full group governance',
    monthly: 399, annual: null,
    features: ['Everything in Group', 'Unlimited companies, branches, employees', 'Visual Insights Dashboard', 'Custom approval rules engine', 'White-label per subsidiary', 'Full API & webhooks (10k calls/mo)', '7-year audit retention', 'Optional add-ons (Power BI, WhatsApp API, OCR, Biometric, Maps)'],
  },
]

export default function PlanSelectPage() {
  const { profile, tenant, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [saving, setSaving] = useState<Plan | null>(null)
  const [error, setError] = useState('')

  async function selectPlan(plan: Plan) {
    if (!profile) return
    setError('')
    setSaving(plan)
    const { error: err } = await supabase
      .from('tenants')
      .update({ plan, plan_confirmed: true })
      .eq('id', profile.tenant_id)
    setSaving(null)
    if (err) { setError(err.message); return }
    await refreshProfile()
    // Go to subdomain allocation — it's the next onboarding step
    navigate('/onboarding/subdomain')
  }

  async function skipToStarter() {
    if (!profile) return
    setSaving('starter')
    await supabase
      .from('tenants')
      .update({ plan: 'starter', plan_confirmed: true })
      .eq('id', profile.tenant_id)
    await refreshProfile()
    navigate('/onboarding/subdomain')
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'var(--bg-900)', padding: '2.5rem 1rem 4rem', overflowY: 'auto' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle at 50% 20%, var(--gold-wash) 0%, transparent 65%)' }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1040, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
            <Shield size={22} style={{ color: 'var(--gold)' }} />
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-h3)', color: 'var(--gold)', fontWeight: 600 }}>VELA</span>
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
            Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} — choose your plan
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-body)', maxWidth: 460, margin: '0 auto' }}>
            Your first month is free on every plan. Switch or cancel anytime from Admin → Subscription.
          </p>

          {/* Billing toggle */}
          <div style={{ display: 'inline-flex', marginTop: '1.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, padding: 3 }}>
            {(['monthly', 'annual'] as const).map(b => (
              <button key={b} onClick={() => setBilling(b)}
                style={{
                  padding: '0.4rem 1.1rem', borderRadius: 999, border: 'none', cursor: 'pointer',
                  fontSize: 'var(--text-small)', fontWeight: 600, textTransform: 'capitalize',
                  background: billing === b ? 'var(--gold)' : 'transparent',
                  color: billing === b ? '#0f0f23' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}>
                {b === 'annual' ? 'Annual (2 months free)' : 'Monthly'}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.5rem', color: 'var(--danger)', fontSize: 'var(--text-small)', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Plan cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: '1.25rem', alignItems: 'stretch' }}>
          {PLAN_DETAILS.map(plan => {
            const isCurrent = tenant?.plan === plan.key
            const price = billing === 'annual' ? plan.annual : plan.monthly
            const period = billing === 'annual' ? '/year' : '/mo'
            return (
              <div key={plan.key} className="card" style={{
                display: 'flex', flexDirection: 'column', padding: '1.75rem',
                border: `1px solid ${plan.featured ? 'var(--gold)' : 'var(--border)'}`,
                background: plan.featured ? 'var(--gold-wash)' : 'var(--surface)',
                position: 'relative', boxShadow: plan.featured ? '0 0 0 1px var(--gold-border)' : 'none',
              }}>
                {plan.featured && (
                  <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: '0.08em', padding: '3px 8px', borderRadius: 999, background: 'var(--gold)', color: '#0f0f23' }}>POPULAR</div>
                )}

                <h3 style={{ margin: '0 0 0.25rem', fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-h3)' }}>{plan.name}</h3>
                <p style={{ margin: '0 0 1rem', fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>{plan.tagline}</p>

                <div style={{ marginBottom: '1.5rem' }}>
                  {price !== null ? (
                    <>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>${price}</span>
                      <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>{period}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>${plan.monthly}</span>
                      <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>/mo base</span>
                      <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>+ optional add-ons, billed separately</p>
                    </>
                  )}
                </div>

                <ul style={{ margin: '0 0 1.5rem', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1 }}>
                  {plan.features.map((f, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 'var(--text-small)' }}>
                      <CheckCircle size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
                      <span style={{ color: 'var(--text-muted)' }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => selectPlan(plan.key)}
                  disabled={saving !== null || isCurrent}
                  style={{
                    width: '100%', padding: '0.8rem', borderRadius: 10, border: plan.featured ? 'none' : '1px solid var(--border)',
                    background: isCurrent ? 'var(--success-dim)' : plan.featured ? 'var(--gold)' : 'transparent',
                    color: isCurrent ? 'var(--success)' : plan.featured ? 'var(--gold-text)' : 'var(--text-primary)',
                    fontWeight: 700, fontSize: 'var(--text-body)', cursor: isCurrent ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                  {isCurrent ? <><CheckCircle size={15} />Current Plan</>
                    : saving === plan.key ? 'Saving…'
                    : <>Select {plan.name} <ArrowRight size={15} /></>}
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
          <button onClick={skipToStarter} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 'var(--text-small)', cursor: 'pointer', textDecoration: 'underline' }}>
            Skip for now — start on Starter
          </button>
          <a href="https://wa.me/263779257769" target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-small)', color: 'var(--text-muted)', textDecoration: 'none' }}>
            <MessageCircle size={14} /> Questions about Enterprise add-ons? Chat with us on WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
