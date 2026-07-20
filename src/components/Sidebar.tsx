import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  LayoutDashboard, FileText, Users, ClipboardList,
  Menu, X, Shield, Settings, Building2, DollarSign,
} from 'lucide-react'

interface NavItem { icon: React.ReactNode; label: string; path: string; badge?: number }

export default function Sidebar() {
  const { profile, post, tenant, branding } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const level = post?.hierarchy_levels
  const isExec       = level && level.rank <= 1
  const isManager    = level && level.rank <= 2
  const isITAdmin    = level?.is_it_admin || isExec
  const isAccounting = level?.can_see_budgets || level?.is_accounting || isExec

  useEffect(() => {
    if (!profile) return
    const load = async () => {
      const { count } = await supabase.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id).eq('is_read', false)
      setUnreadCount(count || 0)
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [profile])

  const mainNav: NavItem[] = [
    { icon: <LayoutDashboard size={16} />, label: 'Dashboard',        path: '/dashboard', badge: unreadCount },
    { icon: <FileText        size={16} />, label: 'Requests',         path: '/requests' },
    { icon: <Users           size={16} />, label: 'People',           path: '/hr' },
    { icon: <ClipboardList   size={16} />, label: 'Tasks & Targets',  path: '/work' },
    ...(isAccounting ? [{ icon: <DollarSign size={16} />, label: 'Finance', path: '/finance' }] : []),
    ...(isManager ? [{ icon: <Building2 size={16} />, label: 'Group', path: '/group' }] : []),
    ...(isITAdmin ? [{ icon: <Shield    size={16} />, label: 'Admin', path: '/admin' }] : []),
  ]

  const isActive = (path: string) => {
    if (path === '/work')      return ['/tasks', '/targets', '/work'].includes(location.pathname)
    if (path === '/group')     return ['/consolidation', '/hierarchy', '/group', '/oversight'].includes(location.pathname)
    if (path === '/hr')        return ['/hr', '/oversight'].includes(location.pathname)
    if (path === '/admin')     return ['/admin', '/api-keys', '/api-settings', '/integrations', '/reports'].includes(location.pathname)
    return location.pathname === path
  }

  const NavLink = ({ item }: { item: NavItem }) => (
    <button
      className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
      onClick={() => { navigate(item.path); setMobileOpen(false) }}
    >
      {item.icon}
      <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
      {item.badge && item.badge > 0 ? (
        <span style={{ minWidth: 18, height: 18, borderRadius: 999, background: 'var(--danger)', color: '#fff', fontSize: 'var(--text-micro)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
          {item.badge > 9 ? '9+' : item.badge}
        </span>
      ) : null}
    </button>
  )

  const appName = branding?.hide_vela_branding ? (branding?.app_name || '') : (branding?.app_name || 'VELA')
  const tagline  = branding?.hide_vela_branding ? (branding?.tagline  || '') : (branding?.tagline  || 'COMMAND YOUR GROUP')
  const logoUrl  = branding?.logo_url

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* LOGO */}
      <div style={{ padding: '1.125rem 1rem 1rem', borderBottom: '1px solid var(--sidebar-border)', flexShrink: 0 }}>
        {logoUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={logoUrl} alt={appName} style={{ height: 28, maxWidth: 120, objectFit: 'contain' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={20} style={{ color: 'var(--gold)', flexShrink: 0 }} />
            {appName && <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-lead)', color: 'var(--gold)', fontWeight: 600, letterSpacing: '0.03em' }}>{appName}</span>}
          </div>
        )}
        {tagline && !branding?.hide_vela_branding && (
          <p style={{ fontSize: 'var(--text-micro)', color: 'var(--sidebar-text-muted)', marginTop: '2px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{tagline}</p>
        )}
      </div>

      {/* MAIN NAV */}
      <div className="scroll-area" style={{ flex: 1, padding: '0.625rem 0.5rem' }}>
        {mainNav.map(item => <NavLink key={item.path} item={item} />)}
      </div>

      {/* BOTTOM: settings + avatar */}
      <div style={{ padding: '0.5rem', borderTop: '1px solid var(--sidebar-border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <NavLink item={{ icon: <Settings size={16} />, label: 'Settings', path: '/settings' }} />
        <button
          className={`nav-item ${location.pathname === '/profile' ? 'active' : ''}`}
          onClick={() => { navigate('/profile'); setMobileOpen(false) }}
          style={{ marginTop: 2 }}
        >
          <div style={{
            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--text-micro)', fontWeight: 700, color: 'var(--accent-color, #0f0f23)',
          }}>
            {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <p style={{ margin: 0, fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--sidebar-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.full_name}
            </p>
            <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--sidebar-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {post?.title || 'Staff'}
            </p>
          </div>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* ── DESKTOP: always visible ──────────────────────────────── */}
      <aside className="desktop-sidebar" style={{
        width: 216, flexShrink: 0, height: '100%',
        background: 'var(--bg-850)', borderRight: '1px solid var(--sidebar-border)',
        display: 'flex', flexDirection: 'column',
      }}>
        <SidebarContent />
      </aside>

      {/* ── MOBILE: hamburger + drawer ────────────────────────────── */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
        style={{
          display: 'none',
          position: 'fixed', top: 10, left: 10, zIndex: 40,
          background: 'var(--bg-850)', border: '1px solid var(--sidebar-border)',
          borderRadius: 8, padding: '0.45rem', color: 'var(--sidebar-text)', cursor: 'pointer',
        }}
        className="mobile-hamburger"
      >
        <Menu size={18} />
      </button>

      {mobileOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 45 }} onClick={() => setMobileOpen(false)} />
          <aside style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 230, zIndex: 50, background: 'var(--bg-850)', borderRight: '1px solid var(--sidebar-border)' }}>
            <button onClick={() => setMobileOpen(false)} aria-label="Close navigation menu" style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: 'var(--sidebar-text-muted)', cursor: 'pointer' }}>
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  )
}

