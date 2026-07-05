import { useEffect } from 'react'

/** Calls handler when Escape is pressed. Auto-cleaned up on unmount. */
export function useEscapeKey(handler: () => void, active = true) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); handler() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handler, active])
}
