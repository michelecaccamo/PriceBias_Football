import { createContext, useContext, useEffect, useState } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'
export type Mode = 'light' | 'dark'

const KEY = 'pricebias-theme'

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* storage unavailable */
  }
  return 'system'
}

function systemMode(): Mode {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useThemeState() {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice)
  const [system, setSystem] = useState<Mode>(systemMode)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const on = () => setSystem(systemMode())
    mq?.addEventListener('change', on)
    return () => mq?.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (choice === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', choice)
    try {
      localStorage.setItem(KEY, choice)
    } catch {
      /* ignore */
    }
  }, [choice])

  const mode: Mode = choice === 'system' ? system : choice
  return { choice, setChoice, mode }
}

export const ModeContext = createContext<Mode>('light')
export const useMode = () => useContext(ModeContext)

/** Resolve a CSS custom property to its current value (for chart libraries). */
export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()
}
