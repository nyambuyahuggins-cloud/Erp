import React from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  onFilter?: () => void            // if provided, shows filter icon
  filterActive?: boolean           // highlights filter icon when filters are applied
  style?: React.CSSProperties
}

export default function SearchInput({
  value, onChange, placeholder = 'Search…',
  onFilter, filterActive, style,
}: SearchInputProps) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', ...style }}>
      <Search
        size={14}
        style={{
          position: 'absolute', left: '0.75rem',
          color: 'var(--text-muted)', pointerEvents: 'none', flexShrink: 0,
        }}
      />
      <input
        className="input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          paddingLeft: '2.25rem',
          paddingRight: onFilter ? '2.5rem' : '0.875rem',
          fontSize: 'var(--text-small)',
        }}
      />
      {onFilter && (
        <button
          onClick={onFilter}
          title="Filters"
          style={{
            position: 'absolute', right: '0.625rem',
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
            color: filterActive ? 'var(--gold)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center',
            transition: 'color var(--t-base)',
          }}
          onMouseEnter={e => { if (!filterActive) e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { if (!filterActive) e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <SlidersHorizontal size={14} />
        </button>
      )}
    </div>
  )
}
