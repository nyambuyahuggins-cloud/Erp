import React, { useEffect, useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'

/* ── Offline Banner ─────────────────────────────────────────── */
export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on  = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  if (!offline) return null
  return (
    <div style={{ background: 'var(--warning-dim)', borderBottom: '1px solid var(--warning-dim)', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-small)', color: 'var(--warning)', flexShrink: 0 }}>
      <WifiOff size={14} />
      <span>You're offline — showing cached data. Changes will sync when connection returns.</span>
    </div>
  )
}

/* ── SW Update Prompt ───────────────────────────────────────── */
export function UpdatePrompt() {
  const [show, setShow] = useState(false)
  const regRef = React.useRef<ServiceWorkerRegistration | null>(null)
  const waitingRef = React.useRef<ServiceWorker | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let reloaded = false

    function trackWaiting(worker: ServiceWorker | null) {
      if (!worker) return
      waitingRef.current = worker
      setShow(true)
    }

    navigator.serviceWorker.ready.then(reg => {
      regRef.current = reg

      // A SW may already be sitting in "waiting" from before this component mounted
      // (e.g. an update was found while the tab was in the background).
      if (reg.waiting) trackWaiting(reg.waiting)

      reg.addEventListener('updatefound', () => {
        const nw = reg.installing
        if (!nw) return
        nw.addEventListener('statechange', () => {
          // 'installed' + an existing controller means this is an update,
          // not the very first install — and with skipWaiting removed from
          // the workbox config, the new worker now genuinely stays in
          // reg.waiting until we tell it to activate.
          if (nw.state === 'installed' && navigator.serviceWorker.controller) trackWaiting(reg.waiting || nw)
        })
      })

      // Passive browser update-checks mostly fire on navigation. Someone who
      // just tabs back to an already-open PWA won't trigger one on their own —
      // so check explicitly right away, and again whenever the tab regains
      // focus/visibility, which is exactly the moment this matters.
      reg.update().catch(() => {})
    })

    const checkNow = () => regRef.current?.update().catch(() => {})
    const onVisible = () => { if (document.visibilityState === 'visible') checkNow() }
    window.addEventListener('focus', checkNow)
    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(checkNow, 10 * 60 * 1000) // safety net every 10 min

    // Once the new SW actually takes control, reload to pick up matching assets.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    })

    return () => {
      window.removeEventListener('focus', checkNow)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [])

  function handleUpdate() {
    waitingRef.current?.postMessage({ type: 'SKIP_WAITING' })
    setShow(false)
  }

  if (!show) return null
  return (
    <div style={{ position: 'fixed', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: 'var(--bg-850)', border: '1px solid var(--gold)', borderRadius: 12, padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', maxWidth: 360, width: 'calc(100% - 2rem)' }}>
      <RefreshCw size={18} style={{ color: 'var(--gold)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text-primary)' }}>Update available</p>
        <p style={{ margin: '2px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>Reload to get the latest version of VELA.</p>
      </div>
      <button className="btn-gold" style={{ fontSize: 'var(--text-micro)', padding: '0.35rem 0.75rem', whiteSpace: 'nowrap' }} onClick={handleUpdate}>Update</button>
    </div>
  )
}

/* ── PWA Install Prompt ─────────────────────────────────────── */
export function InstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setPrompt(e); setShow(true) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!show || !prompt) return null
  return (
    <div style={{ position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 9998, background: 'var(--bg-850)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.875rem 1.25rem', maxWidth: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      <p style={{ margin: '0 0 0.25rem', fontWeight: 600, fontSize: 'var(--text-small)', color: 'var(--text-primary)' }}>Install VELA</p>
      <p style={{ margin: '0 0 0.875rem', fontSize: 'var(--text-small)', color: 'var(--text-muted)', lineHeight: 1.5 }}>Add to home screen for offline access and a faster experience.</p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn-ghost" style={{ fontSize: 'var(--text-micro)' }} onClick={() => setShow(false)}>Later</button>
        <button className="btn-gold" style={{ fontSize: 'var(--text-micro)' }} onClick={async () => { await prompt.prompt(); setShow(false) }}>Install</button>
      </div>
    </div>
  )
}
