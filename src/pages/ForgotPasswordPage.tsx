import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Shield, ArrowLeft, Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, {
      // Must be added to Supabase Auth → URL Configuration → Redirect URLs,
      // same as the signup confirmation redirect in RegisterPage.
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    // Always show the same confirmation regardless of whether the email
    // exists — avoids leaking which addresses have accounts.
    setSent(true)
  }

  if (sent) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-900)', padding: '2rem 1rem' }}>
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle at 50% 30%, var(--gold-wash) 0%, transparent 65%)' }} />
        <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', background: 'var(--gold-soft)', marginBottom: '1.25rem' }}>
            <Mail size={26} style={{ color: 'var(--gold)' }} />
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-h2)', margin: '0 0 0.75rem', color: 'var(--text-primary)' }}>Check your email</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-body)', lineHeight: 1.6, marginBottom: '1.75rem' }}>
            If an account exists for <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>, a password reset link is on its way. Click it to choose a new password.
          </p>
          <button onClick={() => navigate('/login')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '0 auto', background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 'var(--text-small)' }}>
            <ArrowLeft size={14} /> Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-900)', padding: '2rem 1rem', overflowY: 'auto' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle at 50% 30%, var(--gold-wash) 0%, transparent 65%)' }} />
      <div style={{ width: '100%', maxWidth: 380, position: 'relative', zIndex: 1 }}>
        <button onClick={() => navigate('/login')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 'var(--text-small)', marginBottom: '1.5rem', padding: 0 }}>
          <ArrowLeft size={14} /> Back to sign in
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 50, height: 50, borderRadius: '12px', background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))', marginBottom: '0.875rem' }}>
            <Shield size={22} color="#0f0f23" />
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>VELA</h1>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: 'var(--text-body)', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Reset your password</h2>
          <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            Enter the email on your account and we'll send you a link to choose a new password.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Email</label>
              <input type="email" className="input" placeholder="you@company.co.zw" value={email}
                onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <button type="submit" className="btn-gold" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {loading
                ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#0f0f23', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Sending…</>
                : 'Send reset link'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
