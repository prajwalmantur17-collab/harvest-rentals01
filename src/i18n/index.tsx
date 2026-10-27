import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Lang } from '../types'
import { en, type Dictionary, type TranslationKey } from './en'
import { kn } from './kn'
import { hi } from './hi'

export const DICTIONARIES: Record<Lang, Dictionary> = { en, kn, hi }

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'hi', label: 'हिन्दी' },
]

const STORAGE_KEY = 'hr_lang'
const CHOSEN_KEY = 'hr_lang_chosen'

export function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'kn' || v === 'hi'
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage can be blocked (private mode); the language still works for this visit */
  }
}
function safeRemove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

function initialLang(): Lang {
  const saved = safeGet(STORAGE_KEY)
  if (isLang(saved)) return saved
  if (typeof navigator !== 'undefined') {
    const nav = navigator.language?.toLowerCase() ?? ''
    if (nav.startsWith('kn')) return 'kn'
    if (nav.startsWith('hi')) return 'hi'
  }
  return 'en'
}

export function translate(lang: Lang, key: TranslationKey, params?: Record<string, string | number>): string {
  let text: string = DICTIONARIES[lang][key] ?? en[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.split(`{${k}}`).join(String(v))
    }
  }
  return text
}

interface I18nValue {
  lang: Lang
  /** Change the language. `explicit` = the user picked it (remembered as their choice on this device). */
  setLang: (lang: Lang, explicit?: boolean) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
  /** True if the user picked a language on this device since the last sign-out. */
  hasExplicitChoice: () => boolean
  clearExplicitChoice: () => void
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang, explicit = true) => {
    setLangState(next)
    safeSet(STORAGE_KEY, next)
    if (explicit) safeSet(CHOSEN_KEY, '1')
  }, [])

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (key, params) => translate(lang, key, params),
      hasExplicitChoice: () => safeGet(CHOSEN_KEY) === '1',
      clearExplicitChoice: () => safeRemove(CHOSEN_KEY),
    }),
    [lang, setLang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}
