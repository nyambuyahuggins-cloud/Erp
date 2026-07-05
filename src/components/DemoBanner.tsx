import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import DemoPersonaSwitcher, { isDemoSession } from './DemoPersonaSwitcher'

const RESET_HOUR_UTC = 2

function msUntilReset(): number {
  const now = new Date()
  const next = new Date(now)
  next.setUTCHours(RESET_HOUR_UTC, 0, 0, 0)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  return next.getTime() - now.getTime()
}

function formatCountdown(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function DemoBanner() {
  const { user, effectivePlan } = useAuth()
  const navigate = useNavigate()
  const [countdown, setCountdown] = useState(msUntilReset())

  const isDemo = isDemoSession(user?.email)

  useEffect(() => {
    if (!isDemo) return
    const tick = setInterval(() => setCountdown(msUntilReset()), 60_000)
    return () => clearInterval(tick)
  }, [isDemo])

  if (!isDemo) return null

  return (
    <div style={{
      background: 'linear-gradient(90deg, var(--gold-ring), var(--gold-dim))',
      borderBottom: '1px solid var(--gold-border)',
      padding: '0.375rem 1rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '0.75rem', flexWrap: 'wrap', flexShrink: 0,
    }}>
      {/* Left: persona switcher */}
      <DemoPersonaSwitcher currentEmail={user?.email} effectivePlan={effectivePlan} />

      {/* Right: reset countdown + CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
        <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          Resets in <strong style={{ color: 'var(--gold)' }}>{formatCountdown(countdown)}</strong>
        </span>
        <button
          onClick={() => navigate('/register')}
          style={{
            background: 'var(--gold)', color: '#0f0f23', fontWeight: 700, border: 'none',
            borderRadius: 6, padding: '0.3rem 0.875rem', cursor: 'pointer',
            fontSize: 'var(--text-micro)', whiteSpace: 'nowrap',
          }}
        >
          Start Free →
        </button>
      </div>
    </div>
  )
}
