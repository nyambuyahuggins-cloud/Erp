import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Shield, Eye, EyeOff, ArrowLeft, Mail } from 'lucide-react'

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600,
  color: 'var(--text-muted)', marginBottom: '0.4rem',
  letterSpacing: '0.06em', textTransform: 'uppercase',
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', company: '', password: '', confirm: '',
  })
  const [agreed, setAgreed] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (!agreed) { setError('Please agree to the Terms of Service and Privacy Policy to continue'); return }
    if (!form.company.trim()) { setError('Holding company name is required'); return }
    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.full_name, phone: form.phone, company_name: form.company },
        // Where Supabase sends the user after they click the confirmation link.
        // Must be added to Supabase Auth → URL Configuration → Redirect URLs.
        emailRedirectTo: `${window.location.origin}/onboarding/plan`,
      },
    })
    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }
    if (data.session) {
      // Email confirmation disabled — session is active immediately
      navigate('/onboarding/plan')
    } else {
      // Email confirmation required — show "check your email" screen
      setLoading(false)
      setCheckEmail(true)
    }
  }

  if (checkEmail) {
    return (
      <div style={{
        width: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg-900)', padding: '2rem 1rem',
      }}>
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle at 50% 30%, var(--gold-wash) 0%, transparent 65%)' }} />
        <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', background: 'var(--gold-soft)', marginBottom: '1.25rem' }}>
            <Mail size={26} style={{ color: 'var(--gold)' }} />
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-h2)', margin: '0 0 0.75rem', color: 'var(--text-primary)' }}>Check your email</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-body)', lineHeight: 1.6, marginBottom: '1.75rem' }}>
            We've sent a confirmation link to <strong style={{ color: 'var(--text-primary)' }}>{form.email}</strong>.
            Click it to verify your account — you'll be taken straight to plan selection.
          </p>
          <button onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '0 auto', background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 'var(--text-small)' }}>
            <ArrowLeft size={14} /> Back to home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      width: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg-900)', padding: '2rem 1rem', overflowY: 'auto',
    }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle at 50% 30%, var(--gold-wash) 0%, transparent 65%)' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Back to home */}
        <button onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 'var(--text-small)', marginBottom: '1.5rem', padding: 0 }}>
          <ArrowLeft size={14} /> Back to home
        </button>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 50, height: 50, borderRadius: '12px', background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))', marginBottom: '0.875rem' }}>
            <Shield size={22} color="#0f0f23" />
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>VELA</h1>
          <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', letterSpacing: '0.12em', marginTop: 3 }}>COMMAND YOUR GROUP</p>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: 'var(--text-body)', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
            Create your workspace
          </h2>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', fontSize: 'var(--text-small)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Full Name</label>
              <input className="input" placeholder="John Doe" value={form.full_name}
                onChange={e => set('full_name', e.target.value)} required autoComplete="name" />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Work Email</label>
              <input type="email" className="input" placeholder="you@company.co.zw"
                value={form.email} onChange={e => set('email', e.target.value)} required autoComplete="email" />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Mobile Number</label>
              <input type="tel" className="input" placeholder="+263 77 123 4567"
                value={form.phone} onChange={e => set('phone', e.target.value)} required autoComplete="tel" />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Holding Company Name</label>
              <input className="input" placeholder="e.g. Helikon Group"
                value={form.company} onChange={e => set('company', e.target.value)} required />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} className="input" placeholder="Min. 8 characters"
                  value={form.password} onChange={e => set('password', e.target.value)} required
                  autoComplete="new-password" style={{ paddingRight: '2.5rem' }} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showConfirm ? 'text' : 'password'} className="input" placeholder="Re-enter password"
                  value={form.confirm} onChange={e => set('confirm', e.target.value)} required
                  autoComplete="new-password" style={{ paddingRight: '2.5rem' }} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                  style={{ marginTop: '0.15rem', accentColor: 'var(--gold)', flexShrink: 0, width: 16, height: 16 }} />
                <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  I agree to the{' '}
                  <a href="/tos" target="_blank" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Terms of Service</a>
                  {' '}and{' '}
                  <a href="/privacy" target="_blank" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Privacy Policy</a>.
                  First month is free, no credit card required for Starter.
                </span>
              </label>
            </div>

            <button type="submit" className="btn-gold" disabled={loading || !agreed}
              style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {loading
                ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#0f0f23', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Creating workspace...</>
                : 'Sign Up — Choose Your Plan →'}
            </button>
          </form>

          <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Sign in</a>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 'var(--text-micro)', color: 'var(--text-muted)', marginTop: '1.25rem' }}>
          First month free · No credit card required for Starter
        </p>
      </div>
    </div>
  )
}
