import React, { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
  'input:not([disabled])', 'select:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(', ')

interface FocusTrapProps {
  children: React.ReactNode
  active?: boolean
}

/**
 * Traps Tab/Shift+Tab focus within its children.
 * Auto-focuses the first focusable child on mount.
 */
export default function FocusTrap({ children, active = true }: FocusTrapProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active || !ref.current) return
    const first = ref.current.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
  }, [active])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!active || e.key !== 'Tab' || !ref.current) return
    const focusable = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (!focusable.length) return
    const first = focusable[0], last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus()
    }
  }

  return (
    <div ref={ref} onKeyDown={handleKeyDown} style={{ display: 'contents' }}>
      {children}
    </div>
  )
}
