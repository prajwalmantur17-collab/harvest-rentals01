import type { TranslationKey } from '../i18n/en'

const CODE_TO_KEY: Record<string, TranslationKey> = {
  ERR_AUTH: 'err.auth',
  ERR_FORBIDDEN: 'err.forbidden',
  ERR_NOT_FOUND: 'err.notFound',
  ERR_DATE_TAKEN: 'err.dateTaken',
  ERR_DATE_BLOCKED: 'err.dateBlocked',
  ERR_PAST_DATE: 'err.pastDate',
  ERR_DUPLICATE: 'err.duplicate',
  ERR_MACHINE_UNAVAILABLE: 'err.machineUnavailable',
  ERR_INVALID_TRANSITION: 'err.invalidTransition',
  ERR_NOT_FARMER: 'err.notFarmer',
  ERR_NOT_OWNER: 'err.notOwner',
  ERR_OWN_MACHINE: 'err.ownMachine',
  ERR_HAS_BOOKING: 'err.hasBooking',
  ERR_ROLE_LOCKED: 'err.roleLocked',
  ERR_AREA_REQUIRED: 'err.areaRequired',
  ERR_CROPS_REQUIRED: 'err.cropsRequired',
  ERR_INVALID_INPUT: 'err.invalidInput',
  ERR_INVALID_ROLE: 'err.invalidInput',
  ERR_UPLOAD: 'err.upload',
  ERR_WRONG_PIN: 'err.wrongPin',
  ERR_STORAGE: 'err.storage',
  ERR_PHOTO_REQUIRED: 'v.photoRequired',
  ERR_SUPABASE_NOT_CONFIGURED: 'err.generic',
}

interface ErrorLike {
  message?: string
  code?: string
  name?: string
  status?: number
}

/** Log technical details for developers only. Never shown to users, never includes secrets. */
export function logError(context: string, err: unknown): void {
  if (import.meta.env.DEV) {
    console.error(`[Harvest Rentals] ${context}`, err)
  }
}

/** Turn any error (database, network, auth) into a translated, human-friendly message key. */
export function errorKey(err: unknown): TranslationKey {
  const e = (err ?? {}) as ErrorLike
  const message = typeof e.message === 'string' ? e.message : String(err ?? '')

  const match = message.match(/ERR_[A-Z_]+/)
  if (match && CODE_TO_KEY[match[0]]) return CODE_TO_KEY[match[0]]

  const lower = message.toLowerCase()
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed') ||
    (typeof navigator !== 'undefined' && navigator.onLine === false)
  ) {
    return 'err.network'
  }
  if (lower.includes('jwt') || e.status === 401 || e.code === 'PGRST301') return 'err.auth'
  if (e.code === '42501' || e.status === 403) return 'err.forbidden'
  if (e.code === '23505') return 'err.duplicate'
  if (e.code === '23514' || e.code === '22P02' || e.code === '22007') return 'err.invalidInput'
  return 'err.generic'
}
