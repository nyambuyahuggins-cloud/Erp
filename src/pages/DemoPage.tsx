import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Shield, Building2, Tractor, HardHat, ShoppingCart, Hotel } from 'lucide-react'

const DEMO_ACCOUNTS = {
  enterprise: { email: 'demo@velaerp.app',         password: 'VelaDemo2025!', label: 'Enterprise',   desc: 'Full access · All 4 companies · Analytics · Admin' },
  group:      { email: 'demo-group@velaerp.app',   password: 'VelaDemo2025!', label: 'Group',        desc: 'All 4 companies · Group reports · Consolidation' },
  starter:    { email: 'demo-starter@velaerp.app', password: 'VelaDemo2025!', label: 'Starter',      desc: 'Single company view · Core modules' },
}

const SUBSIDIARIES = [
  { icon: <Tractor size={20}/>,      name: 'AgroStar Zimbabwe',        sector: 'Agriculture',  color: 'var(--success)' },
  { icon: <HardHat size={20}/>,      name: 'BuildRight Construction',  sector: 'Construction', color: '#fb923c' },
  { icon: <ShoppingCart size={20}/>, name: 'StarMart Retail',          sector: 'Retail / FMCG',color: 'var(--info)' },
  { icon: <Hotel size={20}/>,        name: 'Golden Palms Hospitality', sector: 'Hospitality',  color: '#a78bfa' },
]

export default function DemoPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const tier = (params.get('tier') || 'enterprise') as keyof typeof DEMO_ACCOUNTS
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [autostarting, setAutostarting] = useState(false)

  // Auto-login if tier is specified via URL
  useEffect(() => {
    const t = params.get('tier') as keyof typeof DEMO_ACCOUNTS | null
    if (t && DEMO_ACCOUNTS[t]) {
      setAutostarting(true)
      loginAs(t)
    }
  }, [])

  async function loginAs(t: keyof typeof DEMO_ACCOUNTS) {
    setLoading(true)
    setError('')
    const { email, password } = DEMO_ACCOUNTS[t]
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError('Demo is temporarily unavailable. Please try again shortly.')
      setLoading(false)
      setAutostarting(false)
      return
    }
    navigate('/dashboard')
  }

  if (autostarting) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-900)', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ width: 48, height: 48, border: '3px solid var(--gold-ring)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>Loading {DEMO_ACCOUNTS[tier]?.label} demo…</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-900)', padding: '2rem 1rem', overflowY: 'auto' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem', cursor: 'pointer' }} onClick={() => navigate('/')}>
            <Shield size={22} style={{ color: 'var(--gold)' }} />
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-h3)', fontWeight: 700, color: 'var(--gold)' }}>VELA</span>
          </div>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.75rem', margin: '0 0 0.625rem', color: 'var(--text-primary)' }}>
            Explore the Demo
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-body)', margin: 0, lineHeight: 1.6 }}>
            You're about to explore <strong style={{ color: 'var(--text-primary)' }}>Mhofu Holdings Group</strong> — a fictional Zimbabwean holding company with four real subsidiaries and real data. No sign-up needed.
          </p>
        </div>

        {/* The group */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.875rem' }}>
            <Building2 size={16} style={{ color: 'var(--gold)' }} />
            <span style={{ fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>The Group</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
            {SUBSIDIARIES.map(s => (
              <div key={s.name} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', borderLeft: `3px solid ${s.color}` }}>
                <div style={{ color: s.color }}>{s.icon}</div>
                <p style={{ margin: 0, fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</p>
                <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{s.sector}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Access levels */}
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.875rem' }}>Choose your access level</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(Object.entries(DEMO_ACCOUNTS) as [keyof typeof DEMO_ACCOUNTS, typeof DEMO_ACCOUNTS[keyof typeof DEMO_ACCOUNTS]][]).map(([key, acc]) => (
              <button key={key} onClick={() => loginAs(key)} disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '1rem 1.25rem', borderRadius: 12, cursor: loading ? 'not-allowed' : 'pointer',
                  border: `2px solid ${tier === key ? 'var(--gold)' : 'var(--border)'}`,
                  background: tier === key ? 'var(--gold-wash)' : 'var(--bg-850)',
                  textAlign: 'left', transition: 'border-color 0.15s', width: '100%',
                }}
                onMouseEnter={e => { if (tier !== key) e.currentTarget.style.borderColor = 'var(--gold)' }}
                onMouseLeave={e => { if (tier !== key) e.currentTarget.style.borderColor = 'var(--border)' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-body)', color: 'var(--text-primary)' }}>{acc.label} Demo</p>
                  <p style={{ margin: '3px 0 0', fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>{acc.desc}</p>
                </div>
                <div style={{ color: 'var(--gold)', fontSize: 'var(--text-h3)', flexShrink: 0 }}>
                  {loading ? '…' : '→'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem', marginBottom: '1.5rem', fontSize: 'var(--text-small)', color: 'var(--danger)', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Footer note */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            All data is fictional and resets automatically every 24 hours. You can do everything — approve requests, log fleet trips, run payroll.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/register')} className="btn-gold" style={{ fontSize: 'var(--text-small)' }}>
              Start Free →
            </button>
            <button onClick={() => navigate('/')} className="btn-ghost" style={{ fontSize: 'var(--text-small)' }}>
              Back to home
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
