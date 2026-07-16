'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { en } from './en'
import { ru } from './ru'

export const locales = { ru, en }
export type Locale = keyof typeof locales

// Russian is the default: this is the RU fork, so an untouched install shows
// Russian on first paint (no flash for the common case). English stays one
// click away in the language switcher.
const DEFAULT_LOCALE: Locale = 'ru'
export const LOCALE_STORAGE_KEY = 'panelLocale'

export const localeOrder: Locale[] = ['ru', 'en']
export const localeLabels: Record<Locale, string> = {
  ru: 'Русский',
  en: 'English',
}

type Params = Record<string, string | number>

// Dot-path lookup into a nested catalog; returns undefined if the path is
// missing or resolves to a non-string (i.e. an intermediate object).
function lookup(catalog: unknown, path: string): string | undefined {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, catalog)
  return typeof value === 'string' ? value : undefined
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  )
}

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (path: string, params?: Params) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function isLocale(value: unknown): value is Locale {
  return value === 'ru' || value === 'en'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Initialise to the default so SSR and the first client render agree
  // (no hydration mismatch); the stored preference is applied in an effect.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isLocale(stored) && stored !== DEFAULT_LOCALE) {
      setLocaleState(stored)
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next)
    // Cookie mirror lets the server pick up the locale later (e.g. for <html
    // lang> or metadata) without extra client wiring.
    document.cookie = `${LOCALE_STORAGE_KEY}=${next}; path=/; max-age=31536000; samesite=lax`
  }, [])

  const t = useCallback(
    (path: string, params?: Params) => {
      const primary = lookup(locales[locale], path)
      if (primary !== undefined) return interpolate(primary, params)
      // Fall back to English, then to the raw key, so a missing translation
      // degrades gracefully instead of rendering blank.
      const fallback = lookup(en, path)
      if (fallback !== undefined) return interpolate(fallback, params)
      return path
    },
    [locale],
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useTranslation() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useTranslation must be used within a LocaleProvider')
  }
  return ctx
}
