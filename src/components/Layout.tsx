import React from 'react'
import Sidebar from './Sidebar'
import EntityContextBar from './EntityContextBar'
import BottomNav from './BottomNav'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

// Pages that are top-level — don't show a back button on these
const ROOT_PATHS = ['/dashboard', '/requests', '/hr', '/group', '/admin', '/settings', '/profile', '/work', '/notices', '/finance']

interface LayoutProps {
  children: React.ReactNode
  title?: string
  action?: React.ReactNode
}

export default function Layout({ children, title, action }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isRoot = ROOT_PATHS.includes(location.pathname)

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <EntityContextBar />
        {title && (
          <header style={{
            padding: '0.875rem 1.5rem',
            background: 'var(--bg-900)',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '0.75rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
              {!isRoot && (
                <button
                  onClick={() => navigate(-1)}
                  title="Go back"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: '0.25rem', flexShrink: 0,
                    borderRadius: 6, transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <h1 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 'var(--text-h3)', fontWeight: 600,
                color: 'var(--text-primary)', margin: 0, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {title}
              </h1>
            </div>
            {action && <div style={{ flexShrink: 0 }}>{action}</div>}
          </header>
        )}
        <div className="scroll-area" style={{ flex: 1, padding: '1.5rem', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
          id="page-content">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
