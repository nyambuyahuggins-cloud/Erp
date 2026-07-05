import React, { lazy, Suspense } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { OversightPage, HierarchyPage } from './MiscPages'

const ConsolidationPage = lazy(() => import('./ConsolidationPage'))
const Spin = () => <div style={{ display:'flex', justifyContent:'center', padding:'3rem' }}><div className="spinner" /></div>

export default function GroupPage() {
  const { post } = useAuth()
  const location  = useLocation()
  const navigate  = useNavigate()
  const level     = post?.hierarchy_levels
  const isExec    = level && level.rank <= 1
  const isManager = level && level.rank <= 2

  if (!isManager) return (
    <Layout title="Group">
      <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>Manager access required.</div>
    </Layout>
  )

  const hash = location.hash || '#oversight'
  const tabs = [
    { key: '#oversight',     label: 'Oversight',     show: true },
    { key: '#hierarchy',     label: 'Hierarchy',     show: isExec },
    { key: '#consolidation', label: 'Consolidation', show: isExec },
  ]

  return (
    <Layout title="Group">
      <div style={{ display:'flex', gap:'0.25rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
        {tabs.filter(t => t.show).map(t => (
          <button key={t.key} className={`tab ${hash === t.key ? 'active' : ''}`}
            onClick={() => navigate(`/group${t.key}`)}>{t.label}</button>
        ))}
      </div>
      <Suspense fallback={<Spin />}>
        {hash === '#hierarchy'     && isExec ? <HierarchyPage embedded /> :
         hash === '#consolidation' && isExec ? <ConsolidationPage embedded /> :
         <OversightPage embedded />}
      </Suspense>
    </Layout>
  )
}
