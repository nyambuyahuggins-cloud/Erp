import React from 'react'

interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-900)', padding: '2rem' }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)', marginBottom: '1.5rem' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button className="btn-gold" onClick={() => window.location.reload()}>Reload App</button>
        </div>
      </div>
    )
  }
}
