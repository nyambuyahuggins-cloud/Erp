import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Shield, Eye, EyeOff } from 'lucide-react'
import { detectSubdomain, getTenantBySubdomain } from '../lib/subdomain'

export default function LoginPage() {
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const { signIn, tenant } = useAuth()
  const navigate = useNavigate()

  // Subdomain-aware branding
  const [subdomainInfo, setSubdomainInfo] = useState<{
    name: string; app_name: string; logo_url: string | null; brand_color: string | null; hide_branding: boolean
  } | null>(null)

  useEffect(() => {
    const slug = detectSubdomain()
    if (!slug) return
    getTenantBySubdomain(slug).then(info => {
      if (info) setSubdomainInfo(info)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email, password)
    if (err) {
      setError('Invalid email or password')
      setLoading(false)
    } else {
      navigate('/dashboard')
    }
  }

  const brandColor = subdomainInfo?.brand_color || 'var(--gold)'
  const appName    = subdomainInfo?.hide_branding ? subdomainInfo.app_name
                   : subdomainInfo ? `${subdomainInfo.app_name} · VELA`
                   : 'VELA'

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-900)', padding: '1rem'
    }}>
      {/* Subtle bg grid */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle at 50% 50%, var(--gold-wash) 0%, transparent 70%)'
      }} />

      <div style={{
        width: '100%', maxWidth: 380, position: 'relative', zIndex: 1
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          {subdomainInfo?.logo_url ? (
            <img src={subdomainInfo.logo_url} alt={subdomainInfo.app_name}
              style={{ height: 52, maxWidth: 220, objectFit: 'contain', margin: '0 auto 1rem' }} />
          ) : (
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 52, height: 52, borderRadius: '12px',
              background: subdomainInfo
                ? `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`
                : 'linear-gradient(135deg, var(--gold), var(--gold-dark))',
              marginBottom: '1rem'
            }}>
              <Shield size={24} color="#0f0f23" />
            </div>
          )}
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {subdomainInfo?.hide_branding ? subdomainInfo.app_name : subdomainInfo?.app_name || 'VELA'}
          </h1>
          <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', letterSpacing: '0.12em', marginTop: 4 }}>
            {subdomainInfo && !subdomainInfo.hide_branding
              ? `POWERED BY VELA`
              : 'COMMAND YOUR GROUP'}
          </p>
        </div>

        {/* Form */}
        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: 'var(--text-body)', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
            Sign in to your workspace
          </h2>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '0.75rem', marginBottom: '1rem',
              fontSize: 'var(--text-small)', color: 'var(--danger)'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Email
              </label>
              <input
                type="email"
                className="input"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-gold w-full" disabled={loading} style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {loading ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#0f0f23', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Signing in...</> : 'Sign in'}
            </button>
          </form>

          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <a href="/forgot-password" style={{ fontSize: 'var(--text-small)', color: 'var(--gold)', textDecoration: 'none' }}>
              Forgot password?
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
