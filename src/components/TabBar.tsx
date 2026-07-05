import React, { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Drop-in replacement for `<div className="tab-bar">`.
 * Adds left/right chevron buttons that appear only when the tab strip
 * overflows, and scroll it into view on click.
 */
export default function TabBar({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    const hasOverflow = el.scrollWidth > el.clientWidth + 2
    setOverflowing(hasOverflow)
    setShowLeft(hasOverflow && el.scrollLeft > 2)
    setShowRight(hasOverflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [])

  useEffect(() => {
    update()
    const el = ref.current
    if (!el) return
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, update])

  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 140, behavior: 'smooth' })

  return (
    <div style={{ position: 'relative', minWidth: 0, ...(overflowing ? { padding: '0 18px' } : {}), ...style }}>
      {showLeft && (
        <button onClick={() => scroll(-1)} className="tab-bar-arrow tab-bar-arrow-left" aria-label="Scroll tabs left">
          <ChevronLeft size={13} />
        </button>
      )}
      <div className="tab-bar" ref={ref}>{children}</div>
      {showRight && (
        <button onClick={() => scroll(1)} className="tab-bar-arrow tab-bar-arrow-right" aria-label="Scroll tabs right">
          <ChevronRight size={13} />
        </button>
      )}
    </div>
  )
}
