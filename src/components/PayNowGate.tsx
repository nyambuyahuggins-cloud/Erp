import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, SUPABASE_URL } from '../lib/supabase'
import { Shield, AlertTriangle, X } from 'lucide-react'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'
const GRACE_PERIOD_DAYS = 14

export default function PayNowGate({ children }: { children: React.ReactNode }) {
  const { tenant, post } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')

  const isExec = (post?.hierarchy_levels as any)?.rank <= 1

  // No expiry set yet (brand new tenant mid-onboarding, or the demo tenant,
  // which never gets billed) — nothing to enforce.
  if (!tenant?.plan_paid_until || tenant.id === DEMO_TENANT) return <>{children}</>

  const paidUntil = new Date(tenant.plan_paid_until)
  const graceEnd = new Date(paidUntil)
  graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS)

  const now = new Date()
  const isExpired = now > paidUntil
  const isLocked = now > graceEnd
  const daysLeftInGrace = Math.max(0, Math.ceil((graceEnd.getTime() - now.getTime()) / 86400000))

  async function payNow() {
    setPaying(true); setPayError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/paynow-initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ plan: tenant.plan || 'starter' }),
      })
      const result = await res.json()
      if (!res.ok || result.error) { setPayError(result.error || 'Could not start checkout'); setPaying(false); return }
      window.location.href = result.browserurl
    } catch {
      setPayError('Could not reach the payment service. Check your connection and try again.')
      setPaying(false)
    }
  }

  if (isLocked) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'var(--bg-900)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="card" style={{ maxWidth: 420, textAlign: 'center' }}>
          <Shield size={40} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
          <h2 style={{ fontFamily: "'Playfair Display', serif", margin: '0 0 0.75rem' }}>Subscription expired</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)', marginBottom: '1.5rem' }}>
            {isExec
              ? `Your ${GRACE_PERIOD_DAYS}-day grace period has ended. Renew now to restore access for your whole company.`
              : 'Your company\'s VELA subscription has lapsed and the grace period has ended. Please contact your Group Executive to renew.'}
          </p>
          {isExec && (
            <>
              {payError && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)', marginBottom: '0.875rem' }}>{payError}</p>}
              <button className="btn-gold" style={{ width: '100%' }} disabled={paying} onClick={payNow}>
                {paying ? 'Redirecting to PayNow...' : 'Pay Now to Restore Access'}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {isExpired && !dismissed && (
        <div style={{ position: 'fixed', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 9998, background: 'var(--bg-850)', border: '1px solid var(--warning)', borderRadius: 12, padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem', boxShadow: 'var(--shadow-3)', maxWidth: 420, width: 'calc(100% - 2rem)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 'var(--text-small)', fontWeight: 600 }}>Subscription expired</p>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
              {daysLeftInGrace > 0 ? `${daysLeftInGrace} day${daysLeftInGrace === 1 ? '' : 's'} left before access locks.` : 'Access locks today if unpaid.'}
              {payError && <span style={{ color: 'var(--danger)', display: 'block', marginTop: 4 }}>{payError}</span>}
            </p>
          </div>
          {isExec && <button className="btn-gold" style={{ fontSize: 'var(--text-micro)', padding: '0.35rem 0.75rem', whiteSpace: 'nowrap' }} disabled={paying} onClick={payNow}>{paying ? 'Redirecting...' : 'Pay Now'}</button>}
          <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}><X size={16} /></button>
        </div>
      )}
      {children}
    </>
  )
}
