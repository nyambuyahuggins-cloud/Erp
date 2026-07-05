import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronDown, Loader2 } from 'lucide-react'
import type { Plan } from '../lib/planEnforcement'

export const DEMO_PERSONAS = [
  // Executives (HoldCo)
  { email: 'tatenda@mhofu.co.zw',      password: 'NoLogin!x99', name: 'Tatenda Mhofu',      title: 'Executive Director', entity: 'HoldCo',    rank: 1, color: 'var(--gold)' },
  { email: 'rudo@mhofu.co.zw',         password: 'NoLogin!x99', name: 'Rudo Chivaura',       title: 'CFO',                entity: 'HoldCo',    rank: 1, color: 'var(--gold)' },
  // General Managers
  { email: 'farai@agrostar.co.zw',     password: 'NoLogin!x99', name: 'Farai Mutendi',       title: 'General Manager',    entity: 'AgroStar',  rank: 2, color: 'var(--success)' },
  { email: 'blessing@buildright.co.zw',password: 'NoLogin!x99', name: 'Blessing Chirinda',   title: 'General Manager',    entity: 'BuildRight',rank: 2, color: '#fb923c' },
  { email: 'tapiwa@starmart.co.zw',    password: 'NoLogin!x99', name: 'Tapiwa Makoni',       title: 'General Manager',    entity: 'StarMart',  rank: 2, color: 'var(--info)' },
  { email: 'nyasha@goldenpalms.co.zw', password: 'NoLogin!x99', name: 'Nyasha Dube',         title: 'General Manager',    entity: 'G. Palms',  rank: 2, color: '#a78bfa' },
  // Managers
  { email: 'tendai@agrostar.co.zw',    password: 'NoLogin!x99', name: 'Tendai Ncube',        title: 'Finance Manager',    entity: 'AgroStar',  rank: 3, color: 'var(--success)' },
  { email: 'simba@buildright.co.zw',   password: 'NoLogin!x99', name: 'Simba Moyo',          title: 'Site Engineer',      entity: 'BuildRight',rank: 3, color: '#fb923c' },
  { email: 'grace@starmart.co.zw',     password: 'NoLogin!x99', name: 'Grace Zimba',         title: 'Stock Controller',   entity: 'StarMart',  rank: 3, color: 'var(--info)' },
  { email: 'chipo@goldenpalms.co.zw',  password: 'NoLogin!x99', name: 'Chipo Mutasa',        title: 'Front Office Mgr',   entity: 'G. Palms',  rank: 3, color: '#a78bfa' },
  // Staff
  { email: 'kuda@agrostar.co.zw',      password: 'NoLogin!x99', name: 'Kudakwashe Sibanda',  title: 'Field Officer',      entity: 'AgroStar',  rank: 5, color: 'var(--success)' },
  { email: 'primrose@starmart.co.zw',  password: 'NoLogin!x99', name: 'Primrose Mwale',      title: 'Cashier',            entity: 'StarMart',  rank: 5, color: 'var(--info)' },
  { email: 'tafa@goldenpalms.co.zw',   password: 'NoLogin!x99', name: 'Tafadzwa Banda',      title: 'Chef',               entity: 'G. Palms',  rank: 5, color: '#a78bfa' },
]

const DEMO_EMAILS = [
  'demo@velaerp.app', 'demo-group@velaerp.app', 'demo-starter@velaerp.app',
  ...DEMO_PERSONAS.map(p => p.email),
]

export function isDemoSession(email?: string | null) {
  return !!email && DEMO_EMAILS.includes(email)
}

// Starter plan: show only one company (StarMart Retail) so the demo feels
// like a genuine single-company SME rather than a holding group.
const STARTER_ENTITY = 'StarMart'

function visiblePersonasForTier(tier: Plan | string | undefined) {
  if (tier === 'starter') return DEMO_PERSONAS.filter(p => p.entity === STARTER_ENTITY)
  return DEMO_PERSONAS  // group + enterprise: full org
}

export default function DemoPersonaSwitcher({
  currentEmail,
  effectivePlan,
}: {
  currentEmail?: string | null
  effectivePlan?: Plan | string
}) {
  const [open, setOpen]           = useState(false)
  const [switching, setSwitching] = useState(false)
  const [switchingTo, setSwitchingTo] = useState('')

  if (!isDemoSession(currentEmail)) return null

  const current   = DEMO_PERSONAS.find(p => p.email === currentEmail)
  const isStarter = effectivePlan === 'starter'

  const label = current
    ? `${current.name.split(' ')[0]} · ${current.title}`
    : currentEmail?.includes('demo@')    ? 'Demo Executive'
    : currentEmail?.includes('group')    ? 'Demo GM'
    : currentEmail?.includes('starter')  ? 'StarMart Demo'
    : 'Demo User'

  async function switchTo(persona: typeof DEMO_PERSONAS[0]) {
    if (persona.email === currentEmail) { setOpen(false); return }
    // Persist the current tier so effectivePlan survives the persona change
    if (effectivePlan && typeof window !== 'undefined') {
      sessionStorage.setItem('vela_demo_tier', effectivePlan as string)
    }
    setSwitching(true)
    setSwitchingTo(persona.name)
    setOpen(false)
    const { error } = await supabase.auth.signInWithPassword({
      email: persona.email, password: persona.password,
    })
    if (error) { setSwitching(false); alert('Could not switch user: ' + error.message); return }
    window.location.href = '/dashboard'
  }

  const personas = visiblePersonasForTier(effectivePlan)
  const groups = [
    { label: 'Executives',      personas: personas.filter(p => p.rank === 1) },
    { label: 'General Managers',personas: personas.filter(p => p.rank === 2) },
    { label: 'Managers',        personas: personas.filter(p => p.rank === 3) },
    { label: 'Staff',           personas: personas.filter(p => p.rank === 5) },
  ].filter(g => g.personas.length > 0)

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--gold-soft)', border: '1px solid var(--gold-border)',
          borderRadius: 8, padding: '0.3rem 0.625rem', cursor: 'pointer',
          fontSize: 'var(--text-micro)', color: 'var(--gold)', fontWeight: 600,
          maxWidth: 200, minWidth: 120,
        }}
      >
        {switching
          ? <><Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />{switchingTo.split(' ')[0]}…</>
          : <>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>{label}</span>
              <ChevronDown size={12} style={{ flexShrink: 0 }} />
            </>
        }
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 999,
            background: 'var(--bg-850)', border: '1px solid var(--border)',
            borderRadius: 12, width: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '0.625rem 0.875rem', borderBottom: '1px solid var(--border)' }}>
              <p style={{ margin: 0, fontSize: 'var(--text-micro)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Switch Demo User</p>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
                {isStarter
                  ? 'StarMart Retail — single company view'
                  : 'See how each role experiences VELA'}
              </p>
            </div>

            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {groups.map(group => (
                <div key={group.label}>
                  <p style={{ margin: 0, padding: '0.5rem 0.875rem 0.25rem', fontSize: 'var(--text-micro)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {group.label}
                  </p>
                  {group.personas.map(p => (
                    <button key={p.email} onClick={() => switchTo(p)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.625rem',
                        width: '100%', padding: '0.5rem 0.875rem',
                        background: p.email === currentEmail ? 'var(--gold-dim)' : 'none',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (p.email !== currentEmail) e.currentTarget.style.background = 'var(--surface)' }}
                      onMouseLeave={e => { if (p.email !== currentEmail) e.currentTarget.style.background = 'none' }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: p.color + '22', border: `2px solid ${p.color}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 'var(--text-micro)', fontWeight: 700, color: p.color,
                      }}>
                        {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 'var(--text-small)', fontWeight: p.email === currentEmail ? 700 : 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name} {p.email === currentEmail && '✓'}
                        </p>
                        <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
                          {p.title} · {p.entity}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ padding: '0.5rem 0.875rem', borderBottom: '1px solid var(--border)' }}>
              <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
                {isStarter
                  ? 'Starter plan shows one company. Try the Group or Enterprise demo for the full holding group view.'
                  : 'Each user has different permissions, entities and approval authority.'}
              </p>
            </div>

            {isStarter && (
              <div style={{ padding: '0.5rem 0.875rem' }}>
                <a
                  href="/demo?tier=group"
                  style={{ fontSize: 'var(--text-micro)', color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}
                >
                  Switch to Group demo →
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
