// Local/demo fallback storage. When Supabase is configured, API modules use the shared backend.
// so the app works with no server and no setup. Every collection is one JSON value.
import type { AppNotification, BookingStatus, Crop, MachineStatus, MachineType, Profile, ServiceArea } from '../types'
import { logError } from '../utils/errors'
import { uid } from '../utils/id'

export const KEYS = {
  session: 'hr_session',
  users: 'hr_users',
  machines: 'hr_machines',
  bookings: 'hr_bookings',
  notifs: 'hr_notifs',
  blocked: 'hr_blocked',
} as const

/** Fired after every write so open pages refresh themselves (other tabs get the native "storage" event). */
export const DB_EVENT = 'hr-db-change'

export interface StoredMachine {
  id: string
  ownerId: string
  machineType: MachineType
  modelName: string | null
  pricePerAcre: number
  phone: string
  /** A small JPEG data URL, or null. */
  photoPath: string | null
  lat: number | null
  lng: number | null
  status: MachineStatus
  crops: Crop[]
  areas: ServiceArea[]
  /** SHA-256 of the owner's 4-digit PIN (salted with the machine id). The PIN itself is never stored. */
  pinHash: string
  createdAt: string
}

export interface StoredBooking {
  id: string
  machineId: string
  machineType: MachineType | null
  modelName: string | null
  ownerId: string
  farmerId: string
  farmerName: string
  farmerPhone: string
  serviceDate: string
  fieldVillage: string
  acreage: number
  crop: Crop | null
  notes: string | null
  pricePerAcre: number
  status: BookingStatus
  requestId: string
  createdAt: string
}

export interface StoredNotification extends AppNotification {
  userId: string
}

export interface StoredBlocked {
  machineId: string
  date: string
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch (err) {
    logError(`load ${key}`, err)
    return fallback
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    logError(`save ${key}`, err)
    throw new Error('ERR_STORAGE')
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DB_EVENT))
}

export function currentUser(): Profile | null {
  const id = load<string | null>(KEYS.session, null)
  if (!id) return null
  return load<Record<string, Profile>>(KEYS.users, {})[id] ?? null
}

export function requireUser(): Profile {
  const user = currentUser()
  if (!user) throw new Error('ERR_AUTH')
  return user
}

export function setSessionUser(id: string | null): void {
  if (id) save(KEYS.session, id)
  else {
    try {
      localStorage.removeItem(KEYS.session)
    } catch {
      /* ignore */
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(DB_EVENT))
  }
}

/** Salted SHA-256 of a PIN. Falls back to a plain marker only where SubtleCrypto is unavailable (insecure http). */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle
  if (subtle) {
    const data = new TextEncoder().encode(`${salt}:${pin}`)
    const buf = await subtle.digest('SHA-256', data)
    return 'sha256:' + Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
  }
  return `plain:${salt}:${pin}`
}

/** In-app notification. A failure here must never undo the booking that caused it. */
export function notify(
  userId: string,
  type: AppNotification['type'],
  bookingId: string | null,
  data: AppNotification['data'],
): void {
  try {
    const list = load<StoredNotification[]>(KEYS.notifs, [])
    list.unshift({ id: uid(), userId, type, bookingId, data, readAt: null, createdAt: new Date().toISOString() })
    save(KEYS.notifs, list.slice(0, 500))
  } catch (err) {
    logError('notify', err)
  }
}
