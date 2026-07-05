import React from 'react'

/** Single shimmer bar */
export function SkeletonLine({ w = '100%', h = 12, style }: { w?: string | number; h?: number; style?: React.CSSProperties }) {
  return (
    <span className="skeleton" style={{ display: 'block', width: w, height: h, borderRadius: 6, ...style }} />
  )
}

/** Shimmer stat card matching .stat-card shape */
export function SkeletonStatCard() {
  return (
    <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <SkeletonLine w={28} h={28} style={{ borderRadius: 8 }} />
      </div>
      <SkeletonLine w="40%" h={22} />
      <SkeletonLine w="60%" h={10} />
    </div>
  )
}

/** Shimmer table row */
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  const widths = ['35%', '20%', '15%', '12%', '10%']
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '0.875rem 1rem' }}>
          <SkeletonLine w={widths[i] || '15%'} />
        </td>
      ))}
    </tr>
  )
}

/** Shimmer card item (notices, compliance, recent requests) */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.625rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonLine w="45%" h={11} />
        <SkeletonLine w="14%" h={17} style={{ borderRadius: 999 }} />
      </div>
      {lines > 1 && <SkeletonLine w="72%" h={9} />}
      {lines > 2 && <SkeletonLine w="35%" h={8} />}
    </div>
  )
}

/** Grid of stat card skeletons */
export function SkeletonStatGrid({ count = 6 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonStatCard key={i} />)}
    </div>
  )
}

/** Table body loading rows */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} cols={cols} />)}
    </>
  )
}
