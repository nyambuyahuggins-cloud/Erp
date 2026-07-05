import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import {
  Shield, WifiOff, BarChart2, ArrowRight, CheckCircle,
  Sun, Moon, Menu, X, Zap, Globe, Users, TrendingUp,
  Lock, Smartphone, MessageCircle, ChevronDown, Play,
  UserPlus, Settings2, Rocket,
} from 'lucide-react'

/* ── DATA ─────────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: <WifiOff size={18} />,    title: 'Works Offline',            body: 'Staff in remote areas can clock in, submit requests, and update tasks without internet. Data syncs automatically when connectivity returns.' },
  { icon: <Globe size={18} />,      title: 'Any Phone, Any Data',       body: 'Runs on entry-level Android phones. Optimised for 2G and 3G. Installs to the home screen — no app store, no storage needed.' },
  { icon: <BarChart2 size={18} />,  title: 'Group Oversight',           body: 'Requests, tasks, staff, assets, and compliance across every subsidiary — all visible from one login. Drill down or view the full group.' },
  { icon: <Zap size={18} />,        title: 'Automated Approvals',       body: 'Petty cash, branch purchases, and executive decisions all routed to the right person based on amount and hierarchy. No WhatsApp chains.' },
  { icon: <TrendingUp size={18} />, title: 'Inter-Entity Transfers',    body: 'Move assets or staff between subsidiaries with a full audit trail — who requested it, who approved it, and when.' },
  { icon: <Lock size={18} />,       title: 'Plays Well With Your Books', body: "VELA doesn't replace QuickBooks or your accountant. CSV export on every plan. Enterprise adds a live API to push records into your accounting system." },
]

const STATS = [
  { value: '2G/3G',    label: 'Optimised for' },
  { value: 'Offline',  label: 'Works without data' },
  { value: '256-bit',  label: 'TLS encryption' },
  { value: 'Android',  label: 'Home screen install' },
]

const HOW_IT_WORKS = [
  { icon: <UserPlus  size={20} />, step: '01', title: 'Create your account',       body: 'Sign up in under 2 minutes. No credit card required for Starter. Your group workspace is created instantly.' },
  { icon: <Settings2 size={20} />, step: '02', title: 'Set up your group',         body: 'Add your companies, branches, and staff. Set approval levels and assign roles. Takes about 15 minutes.' },
  { icon: <Rocket    size={20} />, step: '03', title: 'Your team goes live',       body: 'Share the VELA link with your staff. They add it to their home screen and start submitting requests, clocking in, and managing assets.' },
]

const ADDON_CATALOG = [
  { key: 'power_bi',      label: 'Power BI Embedded',    price: 260, unit: '/mo', desc: 'Custom dashboards on your approvals, compliance, tasks, and asset data.' },
  { key: 'whatsapp_api',  label: 'WhatsApp Business API',price: 20,  unit: '/mo', desc: 'Approval alerts, notice broadcasts, and compliance reminders via WhatsApp.' },
  { key: 'email_api',     label: 'Email API (SendGrid)',  price: 20,  unit: '/mo', desc: 'Transactional emails and scheduled PDF report delivery.' },
  { key: 'biometric_api', label: 'Biometric API',         price: 33,  unit: '/mo', desc: 'Fingerprint clock-in/out for Android biometric hardware.' },
  { key: 'ocr_api',       label: 'OCR API',               price: 39,  unit: '/mo', desc: 'Scan receipts for Expense Claims and ID docs for HR onboarding. 500 scans/mo.' },
  { key: 'google_maps',   label: 'Google Maps API',        price: 13,  unit: '/mo', desc: 'Location check-ins for field staff and fleet vehicles.' },
] as const

const CUSTOM_TIERS = [
  { tier: 1, price: 45,  powerbi: false, label: 'One-Way Sync',              desc: 'Data from an external system appears as custom fields on existing pages.' },
  { tier: 2, price: 120, powerbi: false, label: 'Two-Way Sync + Page',       desc: 'Bidirectional sync with a dedicated new page, table, filters, and CSV export.' },
  { tier: 3, price: 199, powerbi: true,  label: 'Real-Time + Complex Logic', desc: 'Multiple endpoints, real-time sync. Requires Power BI add-on for dashboards.' },
] as const

const PLANS = [
  {
    name: 'Starter', price: 49, annual: 499,
    tagline: 'Single company',
    limits: '1 company · 5 branches · 50 employees',
    features: ['Requests with default approval routing', 'People: leave, timesheets, expenses, complaints', 'Tasks & Targets', 'Company Property — assets & fleet', 'Notices & compliance calendar', 'CSV export', 'Email support'],
    featured: false,
  },
  {
    name: 'Group', price: 199, annual: 1999,
    tagline: 'Multi-company holding group',
    limits: '5 companies · 50 branches · Unlimited employees',
    features: ['Everything in Starter', 'Group oversight dashboard', 'Inter-entity transfer requests', 'Configurable approval thresholds', 'Offline document signing', 'SMS fallback + WhatsApp support'],
    featured: true,
  },
  {
    name: 'Enterprise', price: 399, annual: null,
    tagline: 'Full group governance',
    limits: 'Unlimited companies, branches & employees',
    features: ['Everything in Group', 'Visual Insights Dashboard', 'Custom approval rules engine', 'White-label per subsidiary', 'Full API & webhooks (10k calls/mo)', '7-year audit retention', 'Optional add-ons'],
    featured: false,
  },
]

const SECTORS = [
  { icon: '🌾', sector: 'Agriculture',       uses: ['Crop input expense claims', 'Farm vehicle fleet & fuel logs', 'Seasonal staff timesheets', 'Equipment asset register'] },
  { icon: '🏗️', sector: 'Construction',      uses: ['Project expense claims', 'Asset & equipment register', 'Site staff timesheets', 'Inter-entity material transfers'] },
  { icon: '🛒', sector: 'Retail & FMCG',     uses: ['Multi-branch leave & scheduling', 'Purchase request approvals', 'Asset register across branches', 'Group-wide oversight'] },
  { icon: '🏨', sector: 'Hospitality',        uses: ['Petty cash requests', 'Staff duty rosters', 'Compliance certificate tracking', 'Notice board for shift updates'] },
  { icon: '🏭', sector: 'Manufacturing',      uses: ['Production expense claims', 'Equipment & vehicle register', 'Site staff timesheets', 'Compliance calendar for inspections'] },
  { icon: '🏦', sector: 'Financial Services', uses: ['Audit trail on all approvals', 'Inter-entity transfer requests', 'Regulatory compliance calendar', 'Executive insights dashboard'] },
]

const FAQ = [
  { q: 'Does VELA work without internet?',                 a: 'Yes. VELA is a Progressive Web App that caches data locally. You can view dashboards, submit requests, and record expenses while offline. Everything syncs when connectivity returns.' },
  { q: 'Which devices does it run on?',                    a: 'Any Android phone or tablet with Chrome — including entry-level devices. Also works on iOS and desktop. No app store needed; just add to home screen.' },
  { q: 'Is my data stored in Zimbabwe?',                   a: 'Data is stored on secure cloud infrastructure with African region servers. All connections are TLS-encrypted. We do not sell your data.' },
  { q: 'Can I manage multiple companies under one login?', a: 'Yes. Group and Enterprise plans support up to 5 or unlimited companies. Switch subsidiaries from the header. Group-level users see requests, tasks, staff, and assets across every entity.' },
  { q: 'How does billing work?',                           a: 'First month free on all plans. Then monthly or annually — annual gives you 2 months free. Upgrade, downgrade, or cancel anytime from Admin → Subscription.' },
  { q: "Does VELA replace my accounting software?",        a: "No. VELA doesn't replace QuickBooks, Sage, or Pastel. It's where approvals, staff records, assets, and compliance live. Every plan includes CSV export. Enterprise adds a live API to sync records into your accounting system automatically." },
]

/* ── PHONE MOCKUP ─────────────────────────────────────────────────── */
function PhoneMockup() {
  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
      {/* Glow behind phone */}
      <div style={{ position: 'absolute', inset: '-20px', background: 'radial-gradient(ellipse 60% 80% at 50% 50%, rgba(212,168,75,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <svg viewBox="0 0 280 560" xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', maxWidth: 280, position: 'relative', filter: 'drop-shadow(0 24px 48px rgba(0,0,0,0.6))' }}>
        {/* Outer phone body */}
        <rect x="2" y="2" width="276" height="556" rx="40" ry="40" fill="#0f0f2a" stroke="#d4a84b" strokeWidth="1.5" strokeOpacity="0.35"/>
        {/* Inner screen bezel */}
        <rect x="10" y="10" width="260" height="540" rx="34" ry="34" fill="#0b0b1e"/>
        {/* Notch */}
        <rect x="106" y="12" width="68" height="20" rx="10" fill="#0f0f2a"/>
        {/* Screen content area */}
        <rect x="10" y="38" width="260" height="490" fill="#0b0b1e" rx="4"/>

        {/* ── App header bar ── */}
        <rect x="10" y="38" width="260" height="44" fill="#0f0f2a"/>
        <text x="24" y="64" fontFamily="Georgia,serif" fontSize="15" fontWeight="700" fill="#f0ead6">Dashboard</text>
        {/* header icons right */}
        <circle cx="240" cy="60" r="12" fill="rgba(212,168,75,0.1)" stroke="rgba(212,168,75,0.3)" strokeWidth="1"/>
        <text x="240" y="64" textAnchor="middle" fontSize="8" fontFamily="sans-serif" fill="#d4a84b" fontWeight="800">HG</text>
        <rect x="218" y="53" width="14" height="14" rx="4" fill="rgba(96,165,250,0.12)"/>
        <line x1="221" y1="57" x2="229" y2="57" stroke="#60a5fa" strokeWidth="1.5"/>
        <line x1="221" y1="60" x2="229" y2="60" stroke="#60a5fa" strokeWidth="1.5"/>
        <line x1="221" y1="63" x2="227" y2="63" stroke="#60a5fa" strokeWidth="1.5"/>

        {/* ── Stat cards row 1 ── */}
        {/* Card: Pending */}
        <rect x="20" y="92" width="114" height="62" rx="10" fill="#141430" stroke="#1e1e44" strokeWidth="1"/>
        <rect x="20" y="92" width="114" height="2" rx="1" fill="#fbbf24" fillOpacity="0.6"/>
        <rect x="30" y="100" width="22" height="22" rx="6" fill="rgba(251,191,36,0.12)"/>
        <text x="41" y="115" textAnchor="middle" fontSize="11" fill="#fbbf24">⏱</text>
        <text x="30" y="140" fontFamily="Georgia,serif" fontSize="22" fontWeight="700" fill="#fbbf24">5</text>
        <text x="30" y="150" fontFamily="sans-serif" fontSize="7" fill="#7a7a96">Pending Requests</text>

        {/* Card: Tasks */}
        <rect x="146" y="92" width="114" height="62" rx="10" fill="#141430" stroke="#1e1e44" strokeWidth="1"/>
        <rect x="146" y="92" width="114" height="2" rx="1" fill="#60a5fa" fillOpacity="0.6"/>
        <rect x="156" y="100" width="22" height="22" rx="6" fill="rgba(96,165,250,0.12)"/>
        <text x="167" y="115" textAnchor="middle" fontSize="11" fill="#60a5fa">✓</text>
        <text x="156" y="140" fontFamily="Georgia,serif" fontSize="22" fontWeight="700" fill="#60a5fa">12</text>
        <text x="156" y="150" fontFamily="sans-serif" fontSize="7" fill="#7a7a96">Open Tasks</text>

        {/* Card row 2 */}
        <rect x="20" y="162" width="114" height="62" rx="10" fill="#141430" stroke="#1e1e44" strokeWidth="1"/>
        <rect x="20" y="162" width="114" height="2" rx="1" fill="#a78bfa" fillOpacity="0.6"/>
        <text x="30" y="204" fontFamily="Georgia,serif" fontSize="22" fontWeight="700" fill="#a78bfa">3</text>
        <text x="30" y="218" fontFamily="sans-serif" fontSize="7" fill="#7a7a96">Leave Pending</text>

        <rect x="146" y="162" width="114" height="62" rx="10" fill="#141430" stroke="#1e1e44" strokeWidth="1"/>
        <rect x="146" y="162" width="114" height="2" rx="1" fill="#f87171" fillOpacity="0.6"/>
        <text x="156" y="204" fontFamily="Georgia,serif" fontSize="22" fontWeight="700" fill="#f87171">1</text>
        <text x="156" y="218" fontFamily="sans-serif" fontSize="7" fill="#7a7a96">Compliance Due</text>

        {/* ── Recent Requests list ── */}
        <text x="20" y="248" fontFamily="Georgia,serif" fontSize="11" fontWeight="600" fill="#c4bfd4">Recent Requests</text>

        {/* Row 1 — pending */}
        <rect x="20" y="256" width="240" height="42" rx="8" fill="#141430" stroke="#1e1e44" strokeWidth="1"/>
        <rect x="20" y="256" width="3" height="42" rx="1.5" fill="#fbbf24"/>
        <text x="32" y="273" fontFamily="sans-serif" fontSize="9.5" fontWeight="600" fill="#f0ead6">Petty Cash · BuildRight</text>
        <text x="32" y="287" fontFamily="monospace" fontSize="8" fill="#7a7a96">REQ-2024-087 · $45.00</text>
        <rect x="194" y="263" width="56" height="17" rx="8" fill="rgba(251,191,36,0.12)" stroke="rgba(251,191,36,0.2)" strokeWidth="0.5"/>
        <text x="222" y="275" textAnchor="middle" fontFamily="sans-serif" fontSize="6.5" fontWeight="800" fill="#fbbf24">PENDING</text>

        {/* Row 2 — approved */}
        <rect x="20" y="305" width="240" height="42" rx="8" fill="#141430" stroke="#1e1e44" strokeWidth="1"/>
        <rect x="20" y="305" width="3" height="42" rx="1.5" fill="#4ade80"/>
        <text x="32" y="322" fontFamily="sans-serif" fontSize="9.5" fontWeight="600" fill="#f0ead6">Leave · Farai Mutendi</text>
        <text x="32" y="336" fontFamily="monospace" fontSize="8" fill="#7a7a96">REQ-2024-085 · 3 days</text>
        <rect x="190" y="312" width="62" height="17" rx="8" fill="rgba(74,222,128,0.12)" stroke="rgba(74,222,128,0.2)" strokeWidth="0.5"/>
        <text x="221" y="324" textAnchor="middle" fontFamily="sans-serif" fontSize="6.5" fontWeight="800" fill="#4ade80">APPROVED</text>

        {/* Row 3 — pending */}
        <rect x="20" y="354" width="240" height="42" rx="8" fill="#141430" stroke="#1e1e44" strokeWidth="1"/>
        <rect x="20" y="354" width="3" height="42" rx="1.5" fill="#60a5fa"/>
        <text x="32" y="371" fontFamily="sans-serif" fontSize="9.5" fontWeight="600" fill="#f0ead6">Asset Transfer · AgroStar</text>
        <text x="32" y="385" fontFamily="monospace" fontSize="8" fill="#7a7a96">REQ-2024-082 · Tractor #04</text>
        <rect x="196" y="361" width="56" height="17" rx="8" fill="rgba(96,165,250,0.12)" stroke="rgba(96,165,250,0.2)" strokeWidth="0.5"/>
        <text x="224" y="373" textAnchor="middle" fontFamily="sans-serif" fontSize="6.5" fontWeight="800" fill="#60a5fa">REVIEW</text>

        {/* ── Bottom nav bar ── */}
        <rect x="10" y="490" width="260" height="48" fill="#0f0f2a"/>
        <line x1="10" y1="490" x2="270" y2="490" stroke="#1e1e44" strokeWidth="1"/>
        {/* Active tab top bar */}
        <rect x="39" y="490" width="36" height="2" rx="1" fill="#d4a84b"/>

        <text x="57" y="510" textAnchor="middle" fontSize="16" fill="#d4a84b">⊞</text>
        <text x="57" y="524" textAnchor="middle" fontFamily="sans-serif" fontSize="6.5" fontWeight="700" fill="#d4a84b">Home</text>

        <text x="114" y="510" textAnchor="middle" fontSize="16" fill="#4a4460">📋</text>
        <text x="114" y="524" textAnchor="middle" fontFamily="sans-serif" fontSize="6.5" fill="#4a4460">Requests</text>

        <text x="171" y="510" textAnchor="middle" fontSize="16" fill="#4a4460">👥</text>
        <text x="171" y="524" textAnchor="middle" fontFamily="sans-serif" fontSize="6.5" fill="#4a4460">People</text>

        <text x="228" y="510" textAnchor="middle" fontSize="16" fill="#4a4460">…</text>
        <text x="228" y="524" textAnchor="middle" fontFamily="sans-serif" fontSize="6.5" fill="#4a4460">More</text>

        {/* Home indicator */}
        <rect x="120" y="544" width="40" height="4" rx="2" fill="#3a3a5a"/>
      </svg>
    </div>
  )
}

/* ── VIDEO SECTION ────────────────────────────────────────────────── */
// Replace VELA_VIDEO_ID with your YouTube video ID when ready
const VELA_VIDEO_ID = ''

function VideoSection() {
  const [playing, setPlaying] = useState(false)
  return (
    <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', position: 'relative', aspectRatio: '16/9', background: '#0b0b1e' }}>
      {!playing || !VELA_VIDEO_ID ? (
        /* Poster / play button */
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-4)', background: 'linear-gradient(135deg, #0f0f2a 0%, #0b0b1e 60%, #1a1030 100%)' }}>
          {/* Decorative grid lines */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06 }} viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice">
            {Array.from({ length: 9 }).map((_, i) => <line key={`h${i}`} x1="0" y1={i * 56} x2="800" y2={i * 56} stroke="#d4a84b" strokeWidth="0.5"/>)}
            {Array.from({ length: 17 }).map((_, i) => <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2="450" stroke="#d4a84b" strokeWidth="0.5"/>)}
          </svg>
          {/* VELA watermark */}
          <p style={{ position: 'absolute', top: 'var(--sp-4)', left: 'var(--sp-5)', fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-lead)', color: 'rgba(212,168,75,0.18)', fontWeight: 700, margin: 0 }}>VELA</p>
          {/* Play button */}
          <button
            onClick={() => VELA_VIDEO_ID ? setPlaying(true) : window.open('https://wa.me/263779257769?text=Hi%2C%20Id%20like%20to%20see%20a%20VELA%20demo', '_blank')}
            style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--gold)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform var(--t-base), box-shadow var(--t-base)', boxShadow: '0 0 0 8px rgba(212,168,75,0.12)' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 0 0 14px rgba(212,168,75,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 0 0 8px rgba(212,168,75,0.12)' }}>
            <Play size={28} fill="#0b0b1e" color="#0b0b1e" style={{ marginLeft: 3 }} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body)', margin: '0 0 var(--sp-1)', fontWeight: 600 }}>
              {VELA_VIDEO_ID ? 'Watch the 2-minute walkthrough' : 'Video walkthrough coming soon'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)', margin: 0 }}>
              {VELA_VIDEO_ID ? 'See VELA working offline on an Android phone' : 'Click to request a live demo via WhatsApp'}
            </p>
          </div>
        </div>
      ) : (
        <iframe
          src={`https://www.youtube.com/embed/${VELA_VIDEO_ID}?autoplay=1&rel=0`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="VELA walkthrough"
        />
      )}
    </div>
  )
}

/* ── FAQ ──────────────────────────────────────────────────────────── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: 'var(--sp-5) 0' }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-4)', textAlign: 'left', padding: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--text-body)', color: 'var(--text-primary)', lineHeight: 1.4 }}>{q}</span>
        <ChevronDown size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--t-base)' }} />
      </button>
      {open && <p style={{ margin: 'var(--sp-3) 0 0', fontSize: 'var(--text-small)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{a}</p>}
    </div>
  )
}

/* ── ADDON CONFIGURATOR ───────────────────────────────────────────── */
function AddonConfigurator({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggle = (key: string) => setSelected(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })
  const addonsTotal = ADDON_CATALOG.filter(a => selected.has(a.key)).reduce((s, a) => s + a.price, 0)
  const monthly = 399 + addonsTotal
  const annual  = monthly * 10

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px,1fr))', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
        {ADDON_CATALOG.map(addon => {
          const isOn = selected.has(addon.key)
          return (
            <div key={addon.key} onClick={() => toggle(addon.key)} className="card card-interactive"
              style={{ borderColor: isOn ? 'var(--gold)' : 'var(--border)', background: isOn ? 'var(--gold-dim)' : 'var(--surface)', display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-start' }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2, border: `2px solid ${isOn ? 'var(--gold)' : 'var(--border)'}`, background: isOn ? 'var(--gold)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all var(--t-fast)' }}>
                {isOn && <svg width="10" height="10" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" stroke="#0b0b1e" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-2)', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-small)', color: 'var(--text-primary)' }}>{addon.label}</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 'var(--text-small)', color: 'var(--gold)', flexShrink: 0 }}>
                    ${addon.price}<span style={{ fontWeight: 400, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{addon.unit}</span>
                  </span>
                </div>
                <p style={{ margin: 'var(--sp-1) 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)', lineHeight: 1.5 }}>{addon.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--sp-4)', borderColor: 'var(--border-gold)', background: 'var(--gold-dim)' }}>
        <div>
          <p style={{ margin: '0 0 var(--sp-1)', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>Your Enterprise plan total</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 'var(--text-h2)', fontWeight: 700, color: 'var(--gold)' }}>${monthly.toLocaleString()}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>/mo</span>
            {addonsTotal > 0 && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>= $399 base + ${addonsTotal} add-ons</span>}
          </div>
          <p style={{ margin: 'var(--sp-1) 0 0', fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
            Annual: <strong style={{ color: 'var(--text-primary)' }}>${annual.toLocaleString()}/yr</strong> — saves ${(monthly * 2).toLocaleString()}
          </p>
        </div>
        <button className="btn-gold" style={{ fontSize: 'var(--text-body)', padding: '0.875rem 1.75rem' }} onClick={() => navigate('/demo?tier=enterprise')}>
          Start with this plan <ArrowRight size={16}/>
        </button>
      </div>
      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-micro)', marginTop: 'var(--sp-3)' }}>
        First month free · Add or remove add-ons anytime after signup
      </p>
    </div>
  )
}

/* ── MAIN ─────────────────────────────────────────────────────────── */
export default function MarketingPage() {
  const navigate  = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ background: 'var(--bg-900)', minHeight: '100vh', color: 'var(--text-primary)', fontFamily: "'DM Sans', sans-serif", overflowX: 'hidden' }}>

      {/* Responsive nav CSS — avoids Tailwind/inline-style specificity clash */}
      <style>{`
        .mkt-nav-desktop { display: flex; align-items: center; gap: var(--sp-6); }
        .mkt-nav-mobile  { display: none; align-items: center; gap: var(--sp-3); }
        @media (max-width: 768px) {
          .mkt-nav-desktop { display: none !important; }
          .mkt-nav-mobile  { display: flex !important; }
        }
      `}</style>

      {/* ── FIXED HEADER ──────────────────────────────────────────── */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height: 60, background: theme === 'dark' ? 'rgba(11,11,30,0.92)' : 'rgba(245,243,239,0.94)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', padding: '0 var(--sp-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <Shield size={20} style={{ color: 'var(--gold)', flexShrink: 0 }}/>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-lead)', fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.02em' }}>VELA</span>
        </div>

        {/* Desktop nav */}
        <nav className="mkt-nav-desktop">
          {['Features','Pricing','About'].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`} style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', textDecoration: 'none', transition: 'color var(--t-base)' }}
              onMouseEnter={e => (e.target as HTMLElement).style.color = 'var(--text-primary)'}
              onMouseLeave={e => (e.target as HTMLElement).style.color = 'var(--text-muted)'}>{item}</a>
          ))}
          <a href="/login" style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', textDecoration: 'none' }}>Sign in</a>
          <button onClick={toggleTheme} aria-label="Toggle theme" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 'var(--sp-1)' }}>{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}</button>
          <button className="btn-gold" style={{ padding: '0.45rem 1.1rem', minHeight: 'unset', fontSize: 'var(--text-small)' }} onClick={() => navigate('/register')}>Get Started</button>
        </nav>

        {/* Mobile nav */}
        <div className="mkt-nav-mobile">
          <button className="btn-gold" style={{ padding: '0.375rem 0.875rem', minHeight: 'unset', fontSize: 'var(--text-micro)' }} onClick={() => navigate('/register')}>Get Started</button>
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex' }}>{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
        </div>
      </header>

      {menuOpen && (
        <div style={{ position: 'fixed', top: 60, left: 0, right: 0, zIndex: 99, background: 'var(--bg-850)', borderBottom: '1px solid var(--border)', padding: 'var(--sp-4) var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {['Features','Pricing','About'].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setMenuOpen(false)} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--text-body)', fontWeight: 500 }}>{item}</a>
          ))}
          <a href="/login" onClick={() => setMenuOpen(false)} style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 'var(--text-small)' }}>Sign in</a>
          <button onClick={() => { toggleTheme(); setMenuOpen(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 'var(--text-small)', padding: 0 }}>
            {theme === 'dark' ? <Sun size={15}/> : <Moon size={15}/>} {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      )}

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '6rem var(--sp-6) 4rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 'var(--sp-16)', alignItems: 'center', position: 'relative' }}>
        {/* Radial glow */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 70% 60% at 30% 50%, rgba(212,168,75,0.07) 0%, transparent 65%)' }}/>
        {/* Left: copy + CTAs */}
        <div style={{ position: 'relative' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)', padding: '4px 14px', borderRadius: 'var(--radius-pill)', background: 'var(--gold-dim)', border: '1px solid var(--border-gold)', fontSize: 'var(--text-micro)', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 'var(--sp-6)' }}>
            Built for Zimbabwean holding companies
          </span>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(2rem,5vw,3.25rem)', fontWeight: 700, lineHeight: 1.12, margin: '0 0 var(--sp-5)', color: 'var(--text-primary)' }}>
            Command your group.<br/>
            <span style={{ color: 'var(--gold)' }}>Even without internet.</span>
          </h1>
          <p style={{ fontSize: 'var(--text-lead)', color: 'var(--text-secondary)', maxWidth: 480, margin: '0 0 var(--sp-8)', lineHeight: 1.7 }}>
            Approvals, people, assets, tasks, and compliance — across every subsidiary, on any Android phone, even on 2G.
          </p>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
            <button className="btn-gold" style={{ fontSize: 'var(--text-body)', padding: '0.875rem 1.875rem' }} onClick={() => navigate('/register')}>
              Start Free <ArrowRight size={16}/>
            </button>
            <button className="btn-ghost" style={{ fontSize: 'var(--text-body)', padding: '0.875rem 1.5rem' }} onClick={() => navigate('/demo')}>
              Try Demo
            </button>
          </div>
          <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', marginTop: 'var(--sp-4)' }}>First month free · No credit card required for Starter</p>
        </div>
        {/* Right: phone mockup */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <PhoneMockup/>
        </div>
      </section>

      {/* ── STATS STRIP ───────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-850)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--sp-5) var(--sp-6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 'var(--sp-4)' }}>
          {STATS.map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 var(--sp-1)', fontFamily: "'JetBrains Mono',monospace", fontSize: 'var(--text-lead)', fontWeight: 700, color: 'var(--gold)' }}>{s.value}</p>
              <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── VIDEO ─────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--sp-16) var(--sp-6) 0' }}>
        <VideoSection/>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-micro)', marginTop: 'var(--sp-3)' }}>Works on 2G · Offline-first · Installs to home screen · No app store</p>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────── */}
      <section id="features" style={{ maxWidth: 1000, margin: '0 auto', padding: 'var(--sp-16) var(--sp-6)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-10)' }}>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-h2)', margin: '0 0 var(--sp-3)' }}>Everything a holding company needs</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', fontSize: 'var(--text-small)', lineHeight: 1.7 }}>Designed for markets where internet is unreliable and users are on affordable Android phones.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 'var(--sp-4)' }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              <div className="icon-wrap" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>{f.icon}</div>
              <div>
                <h3 style={{ fontFamily: "'Playfair Display',serif", margin: '0 0 var(--sp-2)', fontSize: 'var(--text-lead)' }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: 'var(--text-small)', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────── */}
      <section style={{ background: 'var(--bg-850)', padding: 'var(--sp-16) var(--sp-6)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--sp-10)' }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-h2)', margin: '0 0 var(--sp-3)' }}>Up and running in under an hour</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto', fontSize: 'var(--text-small)' }}>No IT consultant required. No lengthy implementation project.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 'var(--sp-5)', position: 'relative' }}>
            {/* Connecting line (desktop) */}
            <div style={{ position: 'absolute', top: 30, left: '18%', right: '18%', height: 1, background: 'linear-gradient(90deg, transparent, var(--border-gold), transparent)', display: 'none' }} className="hidden md:block"/>
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--sp-4)' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--border-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>
                    {step.icon}
                  </div>
                  <span style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, color: '#0b0b1e', fontFamily: "'JetBrains Mono',monospace" }}>
                    {step.step}
                  </span>
                </div>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-h3)', margin: 0 }}>{step.title}</h3>
                <p style={{ margin: 0, fontSize: 'var(--text-small)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{step.body}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 'var(--sp-10)' }}>
            <button className="btn-gold" style={{ fontSize: 'var(--text-body)', padding: '0.875rem 2rem' }} onClick={() => navigate('/register')}>
              Get started free <ArrowRight size={16}/>
            </button>
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ───────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: 'var(--sp-5) var(--sp-6)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-8)', flexWrap: 'wrap' }}>
          {[
            { label: 'CSV Export',    desc: 'Every plan' },
            { label: 'WhatsApp',      desc: 'Alerts & support' },
            { label: 'Audit Trail',   desc: 'Every approval' },
            { label: 'SSL / TLS',     desc: 'Encrypted' },
            { label: 'PWA',           desc: 'Works offline' },
            { label: '2G / 3G',       desc: 'Optimised' },
          ].map(t => (
            <div key={t.label} style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-small)', color: 'var(--text-primary)' }}>{t.label}</p>
              <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── PRICING ───────────────────────────────────────────────── */}
      <section id="pricing" style={{ maxWidth: 1040, margin: '0 auto', padding: 'var(--sp-16) var(--sp-6)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-10)' }}>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-h2)', margin: '0 0 var(--sp-3)' }}>Simple, honest pricing</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0 auto', maxWidth: 440, fontSize: 'var(--text-small)' }}>First month free on every plan. Prices shown at sign-up, not here.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 'var(--sp-5)', alignItems: 'stretch' }}>
          {PLANS.map(plan => (
            <div key={plan.name} className={`pricing-card${plan.featured ? ' featured' : ''}`} style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {plan.featured && (
                <>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--gold), transparent)' }}/>
                  <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--gold)', color: '#0b0b1e' }}>Popular</span>
                </>
              )}
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-h3)', margin: '0 0 var(--sp-1)' }}>{plan.name}</h3>
              <p style={{ margin: '0 0 var(--sp-5)', fontSize: 'var(--text-micro)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{plan.tagline}</p>
              <p style={{ margin: '0 0 var(--sp-5)', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{plan.limits}</p>
              <ul style={{ margin: '0 0 var(--sp-8)', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', flex: 1 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-2)', fontSize: 'var(--text-small)' }}>
                    <CheckCircle size={14} style={{ color: 'var(--gold)', flexShrink: 0, marginTop: 3 }}/>
                    <span style={{ color: 'var(--text-secondary)' }}>{f}</span>
                  </li>
                ))}
              </ul>
              <button className={plan.featured ? 'btn-gold' : 'btn-ghost'} style={{ width: '100%', justifyContent: 'center', fontSize: 'var(--text-body)' }}
                onClick={() => navigate(`/demo?tier=${plan.name.toLowerCase()}`)}>
                Try {plan.name} Demo
              </button>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-micro)', marginTop: 'var(--sp-6)' }}>
          First month free · Cancel anytime · No credit card for Starter
        </p>
      </section>

      {/* ── ENTERPRISE ADD-ONS ────────────────────────────────────── */}
      <section id="addons" style={{ maxWidth: 1040, margin: '0 auto', padding: '0 var(--sp-6) var(--sp-16)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-10)' }}>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-h2)', margin: '0 0 var(--sp-3)' }}>Enterprise add-ons</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto', fontSize: 'var(--text-small)' }}>Available on Enterprise only. Build your exact stack.</p>
        </div>
        <AddonConfigurator navigate={navigate}/>
      </section>

      {/* ── CUSTOM INTEGRATIONS ───────────────────────────────────── */}
      <section style={{ background: 'var(--bg-850)', padding: 'var(--sp-16) var(--sp-6)', marginBottom: 'var(--sp-16)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--sp-10)' }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-h2)', margin: '0 0 var(--sp-3)' }}>Custom API integrations</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto', fontSize: 'var(--text-small)' }}>Enterprise only. One-time development fee — you own the integration.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 'var(--sp-5)' }}>
            {CUSTOM_TIERS.map(t => (
              <div key={t.tier} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                <span style={{ display: 'inline-flex', width: 'fit-content', padding: '2px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--gold-dim)', border: '1px solid var(--border-gold)', fontSize: 'var(--text-micro)', fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tier {t.tier}</span>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-small)' }}>{t.label}</p>
                <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1 }}>{t.desc}</p>
                {t.powerbi && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--gold)', padding: '3px 8px', background: 'var(--gold-dim)', borderRadius: 'var(--radius-sm)', width: 'fit-content' }}>Requires Power BI add-on</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT ─────────────────────────────────────────────────── */}
      <section id="about" style={{ maxWidth: 960, margin: '0 auto', padding: '0 var(--sp-6) var(--sp-16)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-10)' }}>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-h2)', margin: '0 0 var(--sp-3)' }}>About VELA</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto', fontSize: 'var(--text-small)', lineHeight: 1.7 }}>Built by a team that understands Zimbabwean business realities — load-shedding, unreliable data, and the complexity of managing a holding group.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 'var(--sp-5)' }}>
          {[
            { icon: <Smartphone size={18}/>, title: 'Made for Mobile',     body: 'Designed from day one for Android phones. Your field managers, branch staff, drivers — everyone on the same system.' },
            { icon: <Globe size={18}/>,       title: 'Zimbabwe-First',      body: 'USD/ZWG on requests, WhatsApp notifications, CSV exports straight into QuickBooks or Sage. Not adapted for Zimbabwe — built for it.' },
            { icon: <Lock size={18}/>,        title: 'Enterprise Security', body: 'Role-based access, dual approval workflows, full audit trail, session management, and row-level security on every table.' },
            { icon: <Users size={18}/>,       title: 'Group Aware',         body: 'One login spans all subsidiaries. Group oversight dashboard, inter-entity transfers, entity-level branding — the whole group in one place.' },
          ].map(item => (
            <div key={item.title} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              <div className="icon-wrap" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>{item.icon}</div>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-h3)', margin: 0 }}>{item.title}</h3>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--text-small)', lineHeight: 1.65 }}>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTORS ───────────────────────────────────────────────── */}
      <section style={{ background: 'var(--bg-850)', padding: 'var(--sp-16) var(--sp-6)', marginBottom: 'var(--sp-16)' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--sp-10)' }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-h2)', margin: '0 0 var(--sp-3)' }}>Built for every sector</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto', fontSize: 'var(--text-small)' }}>One platform, different workflows.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 'var(--sp-4)' }}>
            {SECTORS.map(s => (
              <div key={s.sector} className="card">
                <div style={{ fontSize: '1.5rem', marginBottom: 'var(--sp-3)' }}>{s.icon}</div>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-small)', fontWeight: 600, margin: '0 0 var(--sp-3)' }}>{s.sector}</h3>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  {s.uses.map(u => (
                    <li key={u} style={{ display: 'flex', gap: 'var(--sp-2)', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--gold)', flexShrink: 0 }}>›</span>{u}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 680, margin: '0 auto', padding: '0 var(--sp-6) var(--sp-16)' }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-h2)', textAlign: 'center', margin: '0 0 var(--sp-6)' }}>Frequently asked questions</h2>
        {FAQ.map(({ q, a }) => <FAQItem key={q} q={q} a={a}/>)}
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section style={{ textAlign: 'center', padding: 'var(--sp-16) var(--sp-6)', background: 'var(--bg-850)' }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-h2)', margin: '0 0 var(--sp-4)' }}>Ready to command your group?</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto var(--sp-8)', fontSize: 'var(--text-small)', lineHeight: 1.7 }}>Most ERP solutions start at $500–$1,000/month and assume reliable internet. VELA starts at $49/month and works on 2G.</p>
        <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn-gold" style={{ fontSize: 'var(--text-body)', padding: '0.9rem 2rem' }} onClick={() => navigate('/register')}>Start Free Trial <ArrowRight size={16}/></button>
          <button className="btn-ghost" style={{ fontSize: 'var(--text-body)', padding: '0.9rem 1.5rem' }} onClick={() => navigate('/demo')}>Try Demo First</button>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: 'var(--sp-8) var(--sp-6)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <Shield size={17} style={{ color: 'var(--gold)' }}/><span style={{ fontFamily: "'Playfair Display',serif", color: 'var(--gold)', fontWeight: 600 }}>VELA</span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-5)', flexWrap: 'wrap' }}>
              {[['Terms','/tos'],['Privacy','/privacy'],['Sign in','/login'],['Register','/register']].map(([label, path]) => (
                <a key={label} href={path} style={{ color: 'var(--text-muted)', fontSize: 'var(--text-micro)', textDecoration: 'none', transition: 'color var(--t-base)' }}
                  onMouseEnter={e => (e.target as HTMLElement).style.color = 'var(--text-primary)'}
                  onMouseLeave={e => (e.target as HTMLElement).style.color = 'var(--text-muted)'}>{label}</a>
              ))}
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-micro)', margin: 0, textAlign: 'center' }}>© {new Date().getFullYear()} VELA ERP · A Sola Digital product · Built for Zimbabwean holding companies</p>
        </div>
      </footer>

      {/* ── WHATSAPP FLOAT ────────────────────────────────────────── */}
      <a href="https://wa.me/263779257769?text=Hi%2C%20Id%20like%20to%20learn%20more%20about%20VELA%20ERP" target="_blank" rel="noopener noreferrer" title="Chat on WhatsApp"
        style={{ position: 'fixed', bottom: 'var(--sp-6)', right: 'var(--sp-6)', zIndex: 9000, width: 50, height: 50, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(37,211,102,0.4)', textDecoration: 'none', transition: 'transform var(--t-base) var(--ease-out)' }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
        <MessageCircle size={24} color="white" fill="white"/>
      </a>
    </div>
  )
}
