import React, { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  body?: string
}

interface ToastContextValue {
  toast: (type: ToastType, title: string, body?: string) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />,
  error:   <XCircle      size={16} style={{ color: 'var(--danger)',  flexShrink: 0 }} />,
  info:    <Info         size={16} style={{ color: 'var(--info)',    flexShrink: 0 }} />,
}

const BORDER: Record<ToastType, string> = {
  success: 'var(--success-dim)',
  error:   'var(--danger-dim)',
  info:    'var(--info-dim)',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((type: ToastType, title: string, body?: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, title, body }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999,
          display: 'flex', flexDirection: 'column', gap: '0.625rem',
          pointerEvents: 'none',
        }}>
          {toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type}`}
              style={{ pointerEvents: 'all', borderColor: BORDER[t.type] }}>
              {ICONS[t.type]}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="toast-title">{t.title}</p>
                {t.body && <p className="toast-body">{t.body}</p>}
              </div>
              <button onClick={() => dismiss(t.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}
