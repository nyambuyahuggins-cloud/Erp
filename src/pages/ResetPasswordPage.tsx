import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Shield, Eye, EyeOff, CheckCircle } from 'lucide-react'

// Reached via the link in the password-reset email (see ForgotPasswordPage's
// redirectTo). Supabase parses the recovery token from the URL and fires a
// PASSWORD_RECOVERY auth event, establishing a temporary session — that's
// what authorizes the updateUser() call below, not a normal login.
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let resolved = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') { resolved = true; setReady(true) }
    })
    // Also cover the case where the recovery session was already established
    // by the time this component mounted (event fired before the listener attached).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { resolved = true; setReady(true) }
    })
    const timeout = setTimeout(() => { if (!resolved) setInvalid(true) }, 4000)
    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => navigate('/dashboard'), 1800)
  }

  const shell = (children: React.ReactNode) => (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-900)', padding: '2rem 1rem' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle at 50% 30%, var(--gold-wash) 0%, transparent 65%)' }} />
      <div style={{ width: '100%', maxWidth: 380, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 50, height: 50, borderRadius: '12px', background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))', marginBottom: '0.875rem' }}>
            <Shield size={22} color="#0f0f23" />
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>VELA</h1>
        </div>
        {children}
      </div>
    </div>
  )

  if (invalid) {
    return shell(
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'var(--text-body)', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Link expired or invalid</h2>
        <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          This password reset link is no longer valid. Request a new one to continue.
        </p>
        <button className="btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/forgot-password')}>Request a new link</button>
      </div>
    )
  }

  if (done) {
    return shell(
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: '50%', background: 'var(--success-dim)', marginBottom: '1rem' }}>
          <CheckCircle size={24} style={{ color: 'var(--success)' }} />
        </div>
        <h2 style={{ fontSize: 'var(--text-body)', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Password updated</h2>
        <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>Taking you to your dashboard…</p>
      </div>
    )
  }

  if (!ready) {
    return shell(
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem' }} />
        <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>Verifying your reset link…</p>
      </div>
    )
  }

  return shell(
    <div className="card" style={{ padding: '2rem' }}>
      <h2 style={{ fontSize: 'var(--text-body)', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Choose a new password</h2>

      {error && (
        <div style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger-dim)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', fontSize: 'var(--text-small)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>New Password</label>
          <div style={{ position: 'relative' }}>
            <input type={showPw ? 'text' : 'password'} className="input" placeholder="Min. 8 characters" value={password}
              onChange={e => setPassword(e.target.value)} required autoComplete="new-password" style={{ paddingRight: '2.5rem' }} />
            <button type="button" onClick={() => setShowPw(!showPw)}
              style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Confirm Password</label>
          <input type={showPw ? 'text' : 'password'} className="input" placeholder="Re-enter password" value={confirm}
            onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
        </div>
        <button type="submit" className="btn-gold" disabled={loading}
          style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {loading
            ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#0f0f23', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Updating…</>
            : 'Update password'}
        </button>
      </form>
    </div>
  )
}
