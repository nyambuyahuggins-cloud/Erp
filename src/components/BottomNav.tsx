import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, FileText, Users, ClipboardList,
  Warehouse, Building2, Shield, Settings, User,
  MoreHorizontal, X,
} from 'lucide-react'

const PRIMARY = [
  { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' },
  { icon: <FileText size={20} />,        label: 'Requests',  path: '/requests' },
  { icon: <Users size={20} />,           label: 'People',    path: '/hr' },
  { icon: <ClipboardList size={20} />,   label: 'Tasks',     path: '/work' },
]

export default function BottomNav() {
  const { profile, post } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sheetOpen, setSheetOpen] = useState(false)

  const level = post?.hierarchy_levels
  const isManager  = level && level.rank <= 2
  const isITAdmin  = level?.is_it_admin || (level && level.rank <= 1)

  if (!profile) return null

  const SECONDARY = [
    { icon: <Warehouse  size={18} />, label: 'Company Property', path: '/inventory' },
    ...(isManager  ? [{ icon: <Building2 size={18} />, label: 'Group',    path: '/group'    }] : []),
    ...(isITAdmin  ? [{ icon: <Shield    size={18} />, label: 'Admin',    path: '/admin'    }] : []),
    { icon: <Settings   size={18} />, label: 'Settings',          path: '/settings' },
    { icon: <User       size={18} />, label: 'Profile',           path: '/profile'  },
  ]

  function isActive(path: string) {
    if (path === '/work') return ['/work', '/tasks', '/targets'].includes(location.pathname)
    if (path === '/hr')   return ['/hr'].includes(location.pathname)
    return location.pathname === path
  }

  function go(path: string) {
    navigate(path)
    setSheetOpen(false)
  }

  return (
    <>
      {/* Bottom nav bar */}
      <nav data-bottomnav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        background: 'var(--bg-850)',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'stretch',
        height: 60,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {PRIMARY.map(item => {
          const active = isActive(item.path)
          return (
            <button key={item.path} onClick={() => go(item.path)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, background: 'none', border: 'none',
                cursor: 'pointer', padding: '6px 0',
                color: active ? 'var(--gold)' : 'var(--text-muted)',
                transition: 'color var(--t-base)',
                position: 'relative',
              }}>
              {/* Active gold indicator bar */}
              {active && (
                <span style={{
                  position: 'absolute', top: 0, left: '20%', right: '20%',
                  height: 2, background: 'var(--gold)',
                  borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
                }} />
              )}
              {item.icon}
              <span style={{ fontSize: '0.6rem', fontWeight: active ? 700 : 500 }}>{item.label}</span>
            </button>
          )
        })}

        {/* More button */}
        <button onClick={() => setSheetOpen(true)}
          aria-label="More navigation options"
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 3, background: 'none', border: 'none',
            cursor: 'pointer', padding: '6px 0',
            color: sheetOpen ? 'var(--gold)' : 'var(--text-muted)',
            transition: 'color var(--t-base)',
          }}>
          <MoreHorizontal size={20} />
          <span style={{ fontSize: '0.6rem', fontWeight: 500 }}>More</span>
        </button>
      </nav>

      {/* Overflow sheet */}
      {sheetOpen && (
        <>
          <div onClick={() => setSheetOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 45, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
          <div style={{
            position: 'fixed', bottom: 60, left: 0, right: 0, zIndex: 50,
            background: 'var(--bg-850)', borderTop: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            padding: 'var(--sp-5)',
            animation: 'slideUp 0.2s var(--ease-out) both',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
              <p style={{ margin: 0, fontSize: 'var(--text-micro)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>More</p>
              <button onClick={() => setSheetOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 'var(--sp-1)', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-2)' }}>
              {SECONDARY.map(item => {
                const active = isActive(item.path)
                return (
                  <button key={item.path} onClick={() => go(item.path)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 'var(--sp-2)', padding: 'var(--sp-4) var(--sp-2)',
                      background: active ? 'var(--gold-dim)' : 'var(--surface)',
                      border: `1px solid ${active ? 'var(--border-gold)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      color: active ? 'var(--gold)' : 'var(--text-secondary)',
                      transition: 'all var(--t-base)',
                    }}>
                    {item.icon}
                    <span style={{ fontSize: 'var(--text-micro)', fontWeight: active ? 700 : 500, textAlign: 'center' }}>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}
