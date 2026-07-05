import React, { createContext, useContext, useState, useCallback } from 'react'

type NTab = 'notices' | 'compliance'

interface NoticesTrayState {
  isOpen: boolean
  tab: NTab
  openTray: (tab: NTab) => void
  closeTray: () => void
}

const NoticesTrayContext = createContext<NoticesTrayState | null>(null)

export function NoticesTrayProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [tab, setTab] = useState<NTab>('notices')

  const openTray = useCallback((t: NTab) => {
    setTab(t)
    setIsOpen(true)
  }, [])
  const closeTray = useCallback(() => setIsOpen(false), [])

  return (
    <NoticesTrayContext.Provider value={{ isOpen, tab, openTray, closeTray }}>
      {children}
    </NoticesTrayContext.Provider>
  )
}

export function useNoticesTray() {
  const ctx = useContext(NoticesTrayContext)
  if (!ctx) throw new Error('useNoticesTray must be used within NoticesTrayProvider')
  return ctx
}
