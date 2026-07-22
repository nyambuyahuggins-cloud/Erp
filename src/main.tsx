import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext.tsx'
import { applyCachedBranding } from './lib/branding.ts'
import './index.css'

// Apply saved theme before render to avoid flash
const saved = (() => { try { return localStorage.getItem('vela-theme') || 'dark' } catch { return 'dark' } })()
document.documentElement.setAttribute('data-theme', saved)

// Same idea for branding: paint with whatever colors were last resolved for
// this device, before AuthContext's Supabase fetch has a chance to run.
// Without this, the loading spinner shown on every cold start rendered
// against the hardcoded default navy background regardless of what a
// tenant had actually configured, then "jumped" to the real color once
// branding loaded a moment later.
applyCachedBranding()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)

// Register service worker explicitly with error handling.
// vite-plugin-pwa (autoUpdate) also does this, but we add our own
// handler to catch registration failures gracefully.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        // Check for updates on visibility change (catches mobile return-from-background)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update().catch(() => {/* silent — offline or mobile data issue */})
          }
        })
      })
      .catch(err => {
        // SW registration failed — app still works, just won't be offline-capable
        console.warn('[VELA] Service worker registration failed:', err)
      })
  })
}
