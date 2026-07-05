import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface BackButtonProps {
  to?: string
  label?: string
}

export default function BackButton({ to, label = 'Back' }: BackButtonProps) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => to ? navigate(to) : navigate(-1 as any)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-muted)', fontSize: 'var(--text-small)',
        fontFamily: "'DM Sans', sans-serif", padding: '0.25rem 0',
        transition: 'color var(--t-base)',
      }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
    >
      <ArrowLeft size={15} />
      {label}
    </button>
  )
}
