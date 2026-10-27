import type { Lang } from '../types'

const LOCALES: Record<Lang, string> = { en: 'en-IN', kn: 'kn-IN', hi: 'hi-IN' }

/** Today's date (YYYY-MM-DD) in Indian Standard Time, matching the database's today_ist(). */
export function todayIST(now: number = Date.now()): string {
  return new Date(now + 5.5 * 3600 * 1000).toISOString().slice(0, 10)
}

export function formatInr(amount: number, lang: Lang): string {
  return new Intl.NumberFormat(LOCALES[lang], {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}

/** Format a YYYY-MM-DD string without any timezone shift. */
export function formatDate(iso: string, lang: Lang): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Intl.DateTimeFormat(LOCALES[lang], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(y, m - 1, d))
}

export function formatNumber(n: number, lang: Lang): string {
  return new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: 1 }).format(n)
}
