import React, { useEffect, useState } from 'react'
import { syncEngine, SyncStatus } from '../lib/syncEngine'
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

export default function SyncStatusBadge() {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [pending, setPending] = useState(0)

  useEffect(() => {
    const unsub = syncEngine.subscribe((s, p) => {
      setStatus(s)
      setPending(p)
    })
    syncEngine.getPendingCount().then(setPending)
    return () => { unsub() }
  }, [])

  if (status === 'idle' && pending === 0) return null

  const configs = {
    offline: { icon: <WifiOff size={12} />, label: pending > 0 ? `${pending} queued` : 'Offline', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
    syncing: { icon: <RefreshCw size={12} style={{ animation: 'spin 0.8s linear infinite' }} />, label: 'Syncing...', color: 'var(--info)', bg: 'var(--info-dim)' },
    error:   { icon: <AlertCircle size={12} />, label: `${pending} failed`, color: 'var(--danger)', bg: 'var(--danger-dim)' },
    idle:    { icon: <CheckCircle size={12} />, label: 'All synced', color: 'var(--success)', bg: 'var(--success-dim)' },
  }

  const cfg = configs[status]

  return (
    <div
      title={status === 'offline' ? `${pending} operations queued — will sync when online` : undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 8px', borderRadius: 999,
        background: cfg.bg, color: cfg.color,
        fontSize: 'var(--text-micro)', fontWeight: 600, letterSpacing: '0.03em',
        cursor: status === 'error' ? 'pointer' : 'default',
        transition: 'all 0.2s'
      }}
      onClick={() => status === 'error' && syncEngine.sync()}
    >
      {cfg.icon}
      <span>{cfg.label}</span>
    </div>
  )
}
