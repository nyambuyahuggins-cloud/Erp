import React from 'react'
import { Megaphone, CalendarClock, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useNoticesTray } from '../../contexts/NoticesTrayContext'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import FocusTrap from '../FocusTrap'
import TabBar from '../TabBar'
import NoticeBoardSection from './NoticeBoardSection'
import ComplianceSection from './ComplianceSection'

// Global slide-in tray for Notices + Compliance, opened from the header icons
// (and Dashboard "View all" links) instead of navigating to /notices.
// The full page at /notices still exists for direct links, refresh, bookmarks.
export default function NoticesTray() {
  const { isOpen, tab, openTray, closeTray } = useNoticesTray()
  const { profile, post } = useAuth()
  const level = post?.hierarchy_levels
  const isAdmin = !!(level && (level.rank <= 1 || (level as any).is_it_admin))

  useEscapeKey(closeTray, isOpen)

  if (!isOpen) return null

  return (
    <div className="tray-backdrop" onClick={closeTray}>
      <FocusTrap active={isOpen}>
        <div
          className="tray-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Notices and compliance"
          onClick={e => e.stopPropagation()}
        >
          <div className="tray-header">
            <TabBar style={{ flex: 1, minWidth: 0 }}>
              <button className={`tab ${tab === 'notices' ? 'active' : ''}`}
                onClick={() => openTray('notices')}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Megaphone size={13} /> Notice Board
              </button>
              <button className={`tab ${tab === 'compliance' ? 'active' : ''}`}
                onClick={() => openTray('compliance')}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CalendarClock size={13} /> Compliance
              </button>
            </TabBar>
            <button
              onClick={closeTray}
              aria-label="Close"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', flexShrink: 0 }}
            >
              <X size={20} />
            </button>
          </div>

          <div className="tray-body">
            {tab === 'notices'    && <NoticeBoardSection profile={profile} isAdmin={isAdmin} />}
            {tab === 'compliance' && <ComplianceSection  profile={profile} isAdmin={isAdmin} />}
          </div>
        </div>
      </FocusTrap>
    </div>
  )
}
