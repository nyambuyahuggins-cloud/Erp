import React, { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { NoticesTrayProvider } from './contexts/NoticesTrayContext'
import ErrorBoundary from './components/ErrorBoundary'
import NoticesTray from './components/notices/NoticesTray'
import { OfflineBanner, UpdatePrompt, InstallPrompt } from './components/AppPrompts'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PlanSelectPage from './pages/PlanSelectPage'
import SubdomainPage from './pages/SubdomainPage'
import { ToastProvider } from './components/ui/Toast'
import DemoPage from './pages/DemoPage'
import DashboardPage from './pages/DashboardPage'
import RequestsPage from './pages/RequestsPage'
import WorkPage from './pages/WorkPage'
import HRPage from './pages/HRPage'
import DocumentsPage from './pages/DocumentsPage'
import SettingsPage from './pages/SettingsPage'
import AdminPage from './pages/AdminPage'
import MarketingPage from './pages/MarketingPage'
import { ProfilePage, AuditPage, NotFoundPage, ToSPage, PrivacyPage } from './pages/MiscPages'

const AccountingPage   = lazy(() => import('./pages/AccountingPage'))
const AnalyticsPage    = lazy(() => import('./pages/AnalyticsPage'))
const InventoryPage    = lazy(() => import('./pages/InventoryPage'))
const GroupPage        = lazy(() => import('./pages/GroupPage'))
const FinancePage      = lazy(() => import('./pages/FinancePage'))
const NoticesPage      = lazy(() => import('./pages/NoticesPage'))

// Pages that need body scroll enabled (standalone full-page layouts, not the app shell)
const PUBLIC_PATHS = ['/', '/login', '/register', '/demo', '/tos', '/privacy', '/onboarding/plan', '/onboarding/subdomain']

const Spin = () => (
  <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-900)' }}>
    <div className="spinner" />
  </div>
)

function ScrollManager() {
  const location = useLocation()
  useEffect(() => {
    const isPublic = PUBLIC_PATHS.includes(location.pathname)
    document.body.classList.toggle('public-layout', isPublic)
    document.body.classList.toggle('app-layout', !isPublic)
  }, [location.pathname])
  return null
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, tenant } = useAuth()
  const location = useLocation()
  if (loading) return <Spin />
  if (!session) return <Navigate to="/login" replace />
  // Exempt the demo tenant — it has plan_confirmed=false intentionally
  const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'
  const onPlanPage  = location.pathname === '/onboarding/plan'
  const onSubdomain = location.pathname === '/onboarding/subdomain'
  if (!onPlanPage && !onSubdomain && tenant?.id !== DEMO_TENANT && tenant && !tenant.plan_confirmed) {
    return <Navigate to="/onboarding/plan" replace />
  }
  return <Suspense fallback={<Spin />}>{children}</Suspense>
}

function AppRoutes() {
  const { session, loading, tenant } = useAuth()
  if (loading) return <Spin />

  // After login: skip plan gate for demo tenant
  const DEMO_TENANT  = '00000000-0000-0000-0000-000000000001'
  const postAuthDest = session && tenant && !tenant.plan_confirmed && tenant.id !== DEMO_TENANT
    ? '/onboarding/plan'
    : '/dashboard'

  return (
    <>
      <ScrollManager />
      <Routes>
        {/* Public */}
        <Route path="/"         element={<MarketingPage />} />
        <Route path="/login"    element={session ? <Navigate to={postAuthDest} replace /> : <LoginPage />} />
        <Route path="/register" element={session ? <Navigate to={postAuthDest} replace /> : <RegisterPage />} />
        <Route path="/demo"     element={<DemoPage />} />
        <Route path="/tos"      element={<ToSPage />} />
        <Route path="/privacy"  element={<PrivacyPage />} />

        {/* App */}
        <Route path="/dashboard"  element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        {/* Hidden — reached only via post-signup redirect, not linked from marketing nav */}
        <Route path="/onboarding/plan"      element={<ProtectedRoute><PlanSelectPage /></ProtectedRoute>} />
        <Route path="/onboarding/subdomain" element={<ProtectedRoute><SubdomainPage /></ProtectedRoute>} />
        <Route path="/requests"   element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
        <Route path="/work"       element={<ProtectedRoute><WorkPage /></ProtectedRoute>} />
        <Route path="/tasks"      element={<Navigate to="/work" replace />} />
        <Route path="/targets"    element={<Navigate to="/work" replace />} />
        <Route path="/hr"         element={<ProtectedRoute><HRPage /></ProtectedRoute>} />
        <Route path="/oversight"  element={<Navigate to="/group#oversight" replace />} />
        <Route path="/notices"    element={<ProtectedRoute><Suspense fallback={<Spin/>}><NoticesPage /></Suspense></ProtectedRoute>} />
        <Route path="/finance"    element={<Navigate to="/requests" replace />} />
        <Route path="/accounting" element={<Navigate to="/requests" replace />} />
        <Route path="/analytics"  element={<Navigate to="/dashboard" replace />} />
        <Route path="/group"      element={<ProtectedRoute><GroupPage /></ProtectedRoute>} />
        <Route path="/hierarchy"  element={<Navigate to="/group#hierarchy" replace />} />
        <Route path="/consolidation" element={<Navigate to="/group#consolidation" replace />} />
        <Route path="/documents"  element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
        <Route path="/profile"    element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/audit"      element={<ProtectedRoute><AuditPage /></ProtectedRoute>} />
        <Route path="/settings"   element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/admin"      element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="/inventory"  element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
        <Route path="/api-keys"   element={<Navigate to="/settings" replace />} />
        <Route path="/api-settings" element={<Navigate to="/settings" replace />} />
        <Route path="/integrations" element={<Navigate to="/settings" replace />} />
        <Route path="/reports"    element={<Navigate to="/settings" replace />} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
        <AuthProvider>
          <NoticesTrayProvider>
          <BrowserRouter>
            <UpdatePrompt />
            <InstallPrompt />
            <AppRoutes />
            <NoticesTray />
          </BrowserRouter>
          </NoticesTrayProvider>
        </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
