import type { ThemeMode } from '../../../shared/types'

const THEME_STORAGE_KEY = 'md-reader-theme'

export function getStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

export function setStoredTheme(theme: ThemeMode): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}

export function applyTheme(theme: ThemeMode): void {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
}
