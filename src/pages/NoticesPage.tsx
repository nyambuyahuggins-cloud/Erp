import React, { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { Megaphone, CalendarClock } from 'lucide-react'
import TabBar from '../components/TabBar'
import NoticeBoardSection from '../components/notices/NoticeBoardSection'
import ComplianceSection from '../components/notices/ComplianceSection'

type NTab = 'notices' | 'compliance'

// Full-page view — reachable directly via /notices#notices or /notices#compliance
// (deep links, refresh, bookmarks). Day-to-day access from inside the app goes
// through the NoticesTray instead — see components/notices/NoticesTray.tsx.
export default function NoticesPage() {
  const { profile, post } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const level = post?.hierarchy_levels
  const isAdmin = !!(level && (level.rank <= 1 || (level as any).is_it_admin))
  const [tab, setTab] = useState<NTab>(location.hash === '#compliance' ? 'compliance' : 'notices')

  useEffect(() => {
    if (location.hash === '#compliance') setTab('compliance')
    else if (location.hash === '#notices' || location.hash === '') setTab('notices')
  }, [location.hash])

  function switchTab(t: NTab) {
    setTab(t)
    navigate(`/notices#${t}`, { replace: true })
  }

  return (
    <Layout title="Notices">
      <TabBar style={{ marginBottom: '1.25rem' }}>
        <button className={`tab ${tab === 'notices' ? 'active' : ''}`}
          onClick={() => switchTab('notices')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Megaphone size={13} /> Notice Board
        </button>
        <button className={`tab ${tab === 'compliance' ? 'active' : ''}`}
          onClick={() => switchTab('compliance')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CalendarClock size={13} /> Compliance
        </button>
      </TabBar>

      {tab === 'notices'    && <NoticeBoardSection profile={profile} isAdmin={isAdmin} />}
      {tab === 'compliance' && <ComplianceSection  profile={profile} isAdmin={isAdmin} />}
    </Layout>
  )
}
