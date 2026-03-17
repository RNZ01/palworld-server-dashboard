'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type GridTheme = 'tron' | 'ares' | 'clu' | 'athena' | 'aphrodite' | 'poseidon'

interface ThemeOption {
  value: GridTheme
  label: string
  accent: string
}

interface ThemeContextValue {
  theme: GridTheme
  setTheme: (theme: GridTheme) => void
  themes: ThemeOption[]
}

const THEME_STORAGE_KEY = 'grid-theme'

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'tron', label: 'Tron', accent: '#00D4FF' },
  { value: 'ares', label: 'Ares', accent: '#FF3333' },
  { value: 'clu', label: 'Clu', accent: '#FF6600' },
  { value: 'athena', label: 'Athena', accent: '#FFD700' },
  { value: 'aphrodite', label: 'Aphrodite', accent: '#FF1493' },
  { value: 'poseidon', label: 'Poseidon', accent: '#0066FF' },
]

const ThemeContext = createContext<ThemeContextValue | null>(null)

function isGridTheme(value: string | null): value is GridTheme {
  return THEME_OPTIONS.some((theme) => theme.value === value)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<GridTheme>('tron')

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    if (isGridTheme(storedTheme)) {
      setThemeState(storedTheme)
      document.documentElement.dataset.gridTheme = storedTheme
      return
    }

    document.documentElement.dataset.gridTheme = 'tron'
  }, [])

  const setTheme = (nextTheme: GridTheme) => {
    setThemeState(nextTheme)
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    document.documentElement.dataset.gridTheme = nextTheme
  }

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme,
    themes: THEME_OPTIONS,
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}
