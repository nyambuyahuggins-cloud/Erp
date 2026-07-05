import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { toSubdomainSlug, isSubdomainAvailable, subdomainUrl, ROOT_DOMAIN } from '../lib/subdomain'
import { Shield, Check, X, ExternalLink, ArrowRight, Loader2 } from 'lucide-react'

export default function SubdomainPage() {
  const { profile, tenant, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [slug, setSlug]           = useState('')
  const [checking, setChecking]   = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Pre-fill slug from tenant name on mount
  useEffect(() => {
    if (tenant?.subdomain) {
      // Already has one — go to dashboard
      navigate('/dashboard', { replace: true })
      return
    }
    if (tenant?.name) setSlug(toSubdomainSlug(tenant.name))
  }, [tenant])

  // Debounced availability check
  useEffect(() => {
    if (!slug || !profile) { setAvailable(null); return }
    if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) { setAvailable(null); return }
    clearTimeout(debounceRef.current)
    setChecking(true)
    debounceRef.current = setTimeout(async () => {
      const ok = await isSubdomainAvailable(slug, profile.tenant_id)
      setAvailable(ok)
      setChecking(false)
    }, 500)
    return () => clearTimeout(debounceRef.current)
  }, [slug, profile])

  function handleSlugChange(raw: string) {
    const clean = raw.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-')
    setSlug(clean)
    setAvailable(null)
    setError('')
  }

  async function confirm() {
    if (!profile || !available) return
    setError('')
    setSaving(true)
    const { error: err } = await supabase
      .from('tenants')
      .update({ subdomain: slug })
      .eq('id', profile.tenant_id)
    setSaving(false)
    if (err) { setError(err.message); return }
    await refreshProfile()
    navigate('/dashboard')
  }

  async function skip() {
    navigate('/dashboard')
  }

  const isValid = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)
  const canConfirm = isValid && available === true && !saving

  return (
    <div style={{
      width: '100%', minHeight: '100vh',
      background: 'var(--bg-900)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--sp-6) var(--sp-4)',
      overflowY: 'auto',
    }}>
      {/* Background glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 60% 50% at 50% 30%, var(--gold-wash) 0%, transparent 70%)' }} />

      <div style={{ width: '100%', maxWidth: 500, position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-8)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)' }}>
            <Shield size={20} style={{ color: 'var(--gold)' }} />
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-lead)', fontWeight: 600, color: 'var(--gold)' }}>VELA</span>
          </div>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-h2)', margin: '0 0 var(--sp-3)', color: 'var(--text-primary)' }}>
            Claim your group's address
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-small)', maxWidth: 380, margin: '0 auto', lineHeight: 1.65 }}>
            Your team will access VELA at this address. You can share it as your branded login link.
          </p>
        </div>

        {/* Slug input card */}
        <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
          <label className="form-label" style={{ marginBottom: 'var(--sp-3)' }}>Your subdomain</label>

          {/* Input with domain suffix */}
          <div style={{
            display: 'flex', alignItems: 'center',
            border: `1px solid ${available === false ? 'var(--danger)' : available === true ? 'var(--success)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)', overflow: 'hidden',
            transition: 'border-color var(--t-base)',
            boxShadow: available === true ? '0 0 0 3px var(--success-dim)' : available === false ? '0 0 0 3px var(--danger-dim)' : 'none',
          }}>
            <input
              value={slug}
              onChange={e => handleSlugChange(e.target.value)}
              placeholder="your-company"
              maxLength={50}
              style={{
                flex: 1, padding: '0.75rem 0.875rem',
                background: 'var(--input-bg)', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: 'var(--text-body)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
            <span style={{
              padding: '0.75rem 0.875rem 0.75rem 0',
              fontSize: 'var(--text-small)', color: 'var(--text-muted)',
              background: 'var(--input-bg)', whiteSpace: 'nowrap',
              fontFamily: "'DM Sans', sans-serif",
            }}>
              .{ROOT_DOMAIN}
            </span>
            {/* Status icon */}
            <div style={{ width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--input-bg)', alignSelf: 'stretch' }}>
              {checking && <Loader2 size={15} style={{ color: 'var(--text-muted)', animation: 'spin 0.7s linear infinite' }} />}
              {!checking && available === true  && <Check size={15} style={{ color: 'var(--success)' }} />}
              {!checking && available === false && <X size={15} style={{ color: 'var(--danger)' }} />}
            </div>
          </div>

          {/* Availability message */}
          <p style={{
            margin: 'var(--sp-2) 0 0',
            fontSize: 'var(--text-micro)',
            color: available === false ? 'var(--danger)' : available === true ? 'var(--success)' : 'var(--text-muted)',
          }}>
            {!isValid && slug.length > 0
              ? 'Must be 3–50 characters, lowercase letters, numbers, and hyphens only.'
              : available === false ? `${slug}.${ROOT_DOMAIN} is already taken.`
              : available === true  ? `✓ ${slug}.${ROOT_DOMAIN} is available!`
              : 'Lowercase letters, numbers and hyphens only.'}
          </p>

          {/* Preview link */}
          {available === true && (
            <div style={{ marginTop: 'var(--sp-4)', padding: 'var(--sp-3) var(--sp-4)', background: 'var(--gold-dim)', border: '1px solid var(--border-gold)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 'var(--text-micro)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your VELA address</p>
                <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: 'var(--text-small)', color: 'var(--gold)', fontWeight: 600 }}>
                  {subdomainUrl(slug)}
                </p>
              </div>
              <ExternalLink size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
            </div>
          )}

          {error && (
            <p style={{ margin: 'var(--sp-3) 0 0', fontSize: 'var(--text-small)', color: 'var(--danger)' }}>{error}</p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <button
            className="btn-gold"
            style={{ width: '100%', justifyContent: 'center', fontSize: 'var(--text-body)', padding: '0.875rem' }}
            onClick={confirm}
            disabled={!canConfirm}>
            {saving
              ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> Claiming…</>
              : <>Claim {slug ? `${slug}.${ROOT_DOMAIN}` : 'subdomain'} <ArrowRight size={16}/></>
            }
          </button>

          <button onClick={skip} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 'var(--text-small)', cursor: 'pointer', padding: 'var(--sp-2)', textDecoration: 'underline' }}>
            Skip for now — set up subdomain from Admin later
          </button>
        </div>

        {/* Info note */}
        <div className="card" style={{ marginTop: 'var(--sp-5)', background: 'var(--surface)', display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-start' }}>
          <Shield size={14} style={{ color: 'var(--gold)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ margin: '0 0 var(--sp-1)', fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text-primary)' }}>What this does</p>
            <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Your team logs in at <strong>{slug || 'yourcompany'}.{ROOT_DOMAIN}</strong> instead of the generic VELA URL. Enterprise plans get white-labeled branding on that page. You can change your subdomain at any time from Admin → Subscription.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
