import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ThemeMode } from '../../../shared/types'
import { applyTheme, getStoredTheme, setStoredTheme } from '../lib/theme'

interface ThemeContextValue {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [theme, setThemeState] = useState<ThemeMode>(() => getStoredTheme())

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next)
    applyTheme(next)
    setStoredTheme(next)
    window.api.reportTheme(next)
  }, [])

  // Let the app menu know the current theme once on startup so its radio checkmarks match.
  useEffect(() => {
    window.api.reportTheme(theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return window.api.onThemeSet((next) => {
      setThemeState(next)
      applyTheme(next)
      setStoredTheme(next)
    })
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
