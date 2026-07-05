import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'
type BaseColor = 'default' | 'black' | 'white'

interface ThemeContextType {
  theme: Theme
  baseColor: BaseColor
  toggleTheme: () => void
  setTheme: (t: Theme) => void
  setThemeColor: (c: BaseColor) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark', baseColor: 'default',
  toggleTheme: () => {}, setTheme: () => {}, setThemeColor: () => {}
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try { return (localStorage.getItem('vela-theme') as Theme) || 'dark' } catch { return 'dark' }
  })

  useEffect(() => {
    apply(theme)
    try { localStorage.setItem('vela-theme', theme) } catch {}
  }, [theme])

  // Apply immediately on first render (before paint)
  useEffect(() => { apply(theme) }, [])

  function apply(t: Theme) {
    document.documentElement.setAttribute('data-theme', t)
  }

  const toggleTheme = () => setThemeState(t => t === 'dark' ? 'light' : 'dark')
  const setTheme = (t: Theme) => setThemeState(t)
  const setThemeColor = (c: BaseColor) => {} // reserved for future per-tenant color overrides

  return (
    <ThemeContext.Provider value={{ theme, baseColor: 'default', toggleTheme, setTheme, setThemeColor }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() { return useContext(ThemeContext) }
