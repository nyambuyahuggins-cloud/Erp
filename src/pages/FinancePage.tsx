import React, { lazy, Suspense } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import TabBar from '../components/TabBar'

// Lazy load — embedded=true skips the nested <Layout> wrapper inside each page
const AccountingPage = lazy(() => import('./AccountingPage'))
const AnalyticsPage  = lazy(() => import('./AnalyticsPage'))

const Spin = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
    <div className="spinner" />
  </div>
)

export default function FinancePage() {
  const { post } = useAuth()
  const location  = useLocation()
  const navigate  = useNavigate()

  const level    = post?.hierarchy_levels
  const isExec   = level && level.rank <= 1

  const hash = location.hash || '#accounting'

  return (
    <Layout title="Finance">
      <TabBar style={{ marginBottom: '1.25rem' }}>
        <button
          className={`tab ${hash === '#accounting' ? 'active' : ''}`}
          onClick={() => navigate('/finance#accounting')}
        >Accounting</button>
        {isExec && (
          <button
            className={`tab ${hash === '#analytics' ? 'active' : ''}`}
            onClick={() => navigate('/finance#analytics')}
          >Analytics</button>
        )}
      </TabBar>

      <Suspense fallback={<Spin />}>
        {hash === '#analytics' && isExec
          ? <AnalyticsPage embedded />
          : <AccountingPage embedded />}
      </Suspense>
    </Layout>
  )
}
