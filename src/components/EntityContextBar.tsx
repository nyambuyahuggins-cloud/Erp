import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { ChevronDown, Megaphone, CalendarClock } from 'lucide-react'
import SyncStatusBadge from './SyncStatusBadge'
import DemoPersonaSwitcher, { isDemoSession } from './DemoPersonaSwitcher'
import { useNoticesTray } from '../contexts/NoticesTrayContext'

const PLAN_COLORS: Record<string, string> = {
  enterprise: 'var(--gold)',
  group:      'var(--info)',
  starter:    '#9ca3af',
}

const RESET_HOUR_UTC = 2
function msUntilReset(): number {
  const now = new Date(), next = new Date(now)
  next.setUTCHours(RESET_HOUR_UTC, 0, 0, 0)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  return next.getTime() - now.getTime()
}
function fmt(ms: number) {
  const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function EntityContextBar() {
  const { profile, tenant, activeEntityId, switchEntity, post, effectivePlan, user } = useAuth()
  const navigate = useNavigate()
  const { openTray } = useNoticesTray()

  const [entities,     setEntities]     = useState<{ id: string; name: string; entity_type: string }[]>([])
  const [activeEntity, setActiveEntity] = useState<{ name: string } | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [noticeCount,  setNoticeCount]  = useState(0)
  const [complianceDot,setComplianceDot]= useState<'overdue' | 'upcoming' | null>(null)
  const [countdown,    setCountdown]    = useState(msUntilReset())

  const level  = post?.hierarchy_levels
  const isExec = level && level.rank <= 1
  const isDemo = isDemoSession(user?.email)

  const loadEntities = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase.from('entities')
      .select('id, name, entity_type')
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true).order('entity_type')
    setEntities(data || [])
  }, [profile])

  const loadCounts = useCallback(async () => {
    if (!profile) return
    const tid = profile.tenant_id
    const since = new Date(Date.now() - 7 * 86400000).toISOString()

    // Fetch notices posted in last 7 days, then subtract ones this user has already read
    const { data: recentNotices } = await supabase.from('notice_board_posts')
      .select('id')
      .eq('tenant_id', tid).is('deleted_at', null).gte('created_at', since)
    const recentIds = (recentNotices || []).map(n => n.id)

    if (recentIds.length === 0) {
      setNoticeCount(0)
    } else {
      const { data: reads } = await supabase.from('notice_reads')
        .select('notice_id').eq('user_id', profile.id).in('notice_id', recentIds)
      const readSet = new Set((reads || []).map(r => r.notice_id))
      setNoticeCount(recentIds.filter(id => !readSet.has(id)).length)
    }

    const now  = new Date().toISOString().split('T')[0]
    const soon = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
    const { data: ci } = await supabase.from('compliance_items')
      .select('status, due_date').eq('tenant_id', tid)
      .is('deleted_at', null).neq('status', 'completed').neq('status', 'waived')
    const hasOverdue  = (ci || []).some(c => c.due_date < now)
    const hasUpcoming = (ci || []).some(c => c.due_date >= now && c.due_date <= soon)
    setComplianceDot(hasOverdue ? 'overdue' : hasUpcoming ? 'upcoming' : null)
  }, [profile])

  useEffect(() => {
    if (!profile) return
    loadEntities(); loadCounts()
    const ci = setInterval(loadCounts, 5 * 60 * 1000)
    return () => clearInterval(ci)
  }, [profile, loadEntities, loadCounts])

  useEffect(() => {
    if (!isDemo) return
    const t = setInterval(() => setCountdown(msUntilReset()), 60_000)
    return () => clearInterval(t)
  }, [isDemo])

  useEffect(() => {
    if (activeEntityId && entities.length > 0)
      setActiveEntity(entities.find(e => e.id === activeEntityId) || null)
  }, [activeEntityId, entities])

  if (!profile) return null

  const displayName = activeEntity?.name || tenant?.name || ''
  const canSwitch   = !!(isExec && entities.length > 1)
  const planColor   = PLAN_COLORS[effectivePlan] || 'var(--text-muted)'

  return (
    <div style={{
      flexShrink: 0,
      background: 'var(--bg-850)',
      // Single subtle shadow instead of a hard border — no industrial lines
      boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
    }}>

      {/* ── DEMO STRIP (merged — no separate DemoBanner bar) ──────── */}
      {isDemo && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.25rem 1rem 0.25rem 1.25rem',
          borderBottom: '1px solid var(--gold-ring)',
          gap: '0.5rem', flexWrap: 'wrap',
          background: 'linear-gradient(90deg, var(--gold-dim), var(--gold-wash))',
        }}>
          <DemoPersonaSwitcher currentEmail={user?.email} effectivePlan={effectivePlan} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
            <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
              Resets in <strong style={{ color: 'var(--gold)' }}>{fmt(countdown)}</strong>
            </span>
            <button onClick={() => navigate('/register')}
              style={{ background: 'var(--gold)', color: '#0f0f23', fontWeight: 700, border: 'none', borderRadius: 6, padding: '0.25rem 0.75rem', cursor: 'pointer', fontSize: 'var(--text-micro)' }}>
              Start Free →
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN HEADER ROW ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        height: 52,
        padding: '0 0.75rem 0 1.25rem',
        paddingLeft: 'max(1.25rem, env(safe-area-inset-left))',
        gap: '0.75rem',
      }}>

        {/* LEFT — Entity name as the hero, like WhatsApp's "Chats" */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          {/* Entity name — prominent, not labelled */}
          <div style={{ position: 'relative', minWidth: 0 }}>
            <button
              onClick={() => canSwitch && setShowDropdown(!showDropdown)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', padding: '0.25rem 0.375rem',
                cursor: canSwitch ? 'pointer' : 'default',
                borderRadius: 8, transition: 'background var(--t-base)',
              }}
              onMouseEnter={e => { if (canSwitch) e.currentTarget.style.background = 'var(--surface-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              <span style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 'var(--text-body)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '40vw',
              }}>
                {displayName}
              </span>
              {canSwitch && (
                <ChevronDown size={14} style={{
                  color: 'var(--text-muted)', flexShrink: 0,
                  transform: showDropdown ? 'rotate(180deg)' : 'none',
                  transition: 'transform var(--t-base)',
                }} />
              )}
            </button>

            {/* Entity switcher dropdown */}
            {showDropdown && canSwitch && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setShowDropdown(false)} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 31,
                  background: 'var(--bg-850)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)', padding: 'var(--sp-2)',
                  minWidth: 240, boxShadow: 'var(--shadow-3)',
                  animation: 'fadeInUp 0.15s var(--ease-out) both',
                }}>
                  <p style={{ margin: '0.25rem 0.75rem 0.5rem', fontSize: 'var(--text-micro)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Switch entity</p>
                  {entities.map(e => (
                    <button key={e.id}
                      onClick={() => { switchEntity(e.id); setShowDropdown(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.625rem',
                        width: '100%', padding: '0.6rem 0.75rem',
                        background: e.id === activeEntityId ? 'var(--gold-dim)' : 'none',
                        border: 'none', borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer', textAlign: 'left',
                        color: e.id === activeEntityId ? 'var(--gold)' : 'var(--text-primary)',
                        fontSize: 'var(--text-small)', transition: 'background var(--t-base)',
                      }}
                      onMouseEnter={e2 => { if (e.id !== activeEntityId) e2.currentTarget.style.background = 'var(--surface-hover)' }}
                      onMouseLeave={e2 => { if (e.id !== activeEntityId) e2.currentTarget.style.background = 'none' }}
                    >
                      <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 48 }}>{e.entity_type}</span>
                      {e.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Plan badge — tiny, unobtrusive */}
          {tenant && (
            <span style={{
              fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.07em',
              textTransform: 'uppercase', padding: '2px 6px',
              borderRadius: 'var(--radius-pill)',
              background: `${planColor}12`,
              color: planColor,
              border: `1px solid ${planColor}22`,
              flexShrink: 0,
            }}>
              {effectivePlan}
            </span>
          )}
        </div>

        {/* RIGHT — notification icons: big, unmissable */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.125rem', flexShrink: 0 }}>
          <SyncStatusBadge />

          {/* Notices — icon turns gold + background tints when there are new notices */}
          <NotifIconBtn
            icon={<Megaphone size={20} />}
            label="Notice Board"
            active={noticeCount > 0}
            count={noticeCount}
            dotColor="var(--info)"
            activeColor="var(--info-dim)"
            onClick={() => openTray('notices')}
          />

          {/* Compliance — background tints red/amber based on urgency */}
          <NotifIconBtn
            icon={<CalendarClock size={20} />}
            label="Compliance"
            active={!!complianceDot}
            dotColor={complianceDot === 'overdue' ? 'var(--danger)' : 'var(--warning)'}
            activeColor={complianceDot === 'overdue' ? 'var(--danger-dim)' : 'var(--warning-dim)'}
            onClick={() => openTray('compliance')}
          />
        </div>
      </div>
    </div>
  )
}

/* ── Notification icon button ────────────────────────────────────── */
function NotifIconBtn({
  icon, label, active, count, dotColor, activeColor, onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  count?: number
  dotColor: string
  activeColor: string
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)

  return (
    <button
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 40, height: 40,
        borderRadius: 'var(--radius-md)',
        // Active state: background tint tells you something needs attention
        background: active ? activeColor : hover ? 'var(--surface-hover)' : 'transparent',
        border: 'none', cursor: 'pointer',
        color: active ? dotColor : hover ? 'var(--text-primary)' : 'var(--text-muted)',
        transition: 'background var(--t-base), color var(--t-base)',
        transform: hover ? 'scale(1.05)' : 'scale(1)',
        flexShrink: 0,
      }}
    >
      {icon}

      {/* Notification dot — 10px, strong ring for legibility */}
      {active && (
        <span style={{
          position: 'absolute',
          top: 7, right: 7,
          width: count && count > 9 ? 'auto' : 10,
          minWidth: 10, height: 10,
          borderRadius: 'var(--radius-pill)',
          background: dotColor,
          border: '2.5px solid var(--bg-850)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: count && count > 1 ? '0 3px' : 0,
          fontSize: '0.45rem', fontWeight: 800,
          color: dotColor === 'var(--warning)' ? '#0f0f23' : '#fff',
          lineHeight: 1, boxSizing: 'border-box',
          boxShadow: `0 0 0 1px var(--bg-850)`,
        }}>
          {count && count > 1 ? (count > 9 ? '9+' : count) : ''}
        </span>
      )}
    </button>
  )
}
