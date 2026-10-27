import { KEYS, load, notify, requireUser, save, type StoredBlocked, type StoredBooking, type StoredMachine, type StoredNotification } from '../store/db'
import type { AppNotification, Booking, BookingStatus, Crop } from '../types'
import { todayIST } from '../utils/format'
import { isValidPhone, normalizePhone } from '../utils/phone'
import { requireSupabase, supabaseEnabled, throwIfError } from '../lib/supabase'

const bookings = () => load<StoredBooking[]>(KEYS.bookings, [])
const machines = () => load<StoredMachine[]>(KEYS.machines, [])
function remoteBooking(row: Record<string, any>): Booking {
  return {
    id: String(row.id), machineId: String(row.machine_id), farmerId: String(row.farmer_id),
    farmerName: String(row.farmer_name ?? ''), farmerPhone: String(row.farmer_phone ?? ''),
    serviceDate: String(row.service_date), fieldVillage: String(row.field_village),
    acreage: Number(row.acreage), crop: row.crop ?? null, notes: row.notes ?? null,
    pricePerAcre: Number(row.price_per_acre), status: row.status, createdAt: row.created_at,
    machineType: row.machine_type ?? null, modelName: row.model_name ?? null,
  }
}

function toBooking(b: StoredBooking): Booking {
  return {
    id: b.id,
    machineId: b.machineId,
    farmerId: b.farmerId,
    farmerName: b.farmerName,
    farmerPhone: b.farmerPhone,
    serviceDate: b.serviceDate,
    fieldVillage: b.fieldVillage,
    acreage: b.acreage,
    crop: b.crop,
    notes: b.notes,
    pricePerAcre: b.pricePerAcre,
    status: b.status,
    createdAt: b.createdAt,
    machineType: b.machineType,
    modelName: b.modelName,
  }
}

export interface CreateBookingInput {
  machineId: string
  serviceDate: string
  fieldVillage: string
  acreage: number
  crop: string
  phone: string
  notes: string
  /** Stable per form submission: retries and double taps return the same booking. */
  requestId: string
}

export async function createBooking(input: CreateBookingInput): Promise<string> {
  const user = requireUser()
  if (supabaseEnabled) {
    if (user.role !== 'farmer') throw new Error('ERR_NOT_FARMER')
    const { data, error } = await requireSupabase().rpc('create_machine_booking', {
      p_machine_id: input.machineId, p_service_date: input.serviceDate, p_field_village: input.fieldVillage.trim(),
      p_acreage: input.acreage, p_crop: input.crop || null, p_phone: normalizePhone(input.phone),
      p_notes: input.notes.trim() || null, p_request_id: input.requestId,
    })
    throwIfError(error)
    return String(data)
  }
  if (user.role !== 'farmer') throw new Error('ERR_NOT_FARMER')
  if (!input.requestId) throw new Error('ERR_INVALID_INPUT')

  const all = bookings()
  // Double tap / retry safety: the same request id gives back the same booking.
  const same = all.find((b) => b.farmerId === user.id && b.requestId === input.requestId)
  if (same) return same.id

  const m = machines().find((x) => x.id === input.machineId)
  if (!m || m.status !== 'active') throw new Error('ERR_MACHINE_UNAVAILABLE')
  if (m.ownerId === user.id) throw new Error('ERR_OWN_MACHINE')

  const village = input.fieldVillage.trim()
  if (village.length < 2 || !(input.acreage > 0 && input.acreage <= 5000) || !isValidPhone(input.phone)) {
    throw new Error('ERR_INVALID_INPUT')
  }
  if (!input.serviceDate || input.serviceDate < todayIST()) throw new Error('ERR_PAST_DATE')

  const blocked = load<StoredBlocked[]>(KEYS.blocked, []).some(
    (b) => b.machineId === m.id && b.date === input.serviceDate,
  )
  if (blocked) throw new Error('ERR_DATE_BLOCKED')
  if (all.some((b) => b.machineId === m.id && b.serviceDate === input.serviceDate && b.status === 'confirmed')) {
    throw new Error('ERR_DATE_TAKEN')
  }
  if (
    all.some(
      (b) =>
        b.machineId === m.id && b.farmerId === user.id && b.serviceDate === input.serviceDate && b.status === 'pending',
    )
  ) {
    throw new Error('ERR_DUPLICATE')
  }

  const booking: StoredBooking = {
    id: crypto.randomUUID ? crypto.randomUUID() : `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    machineId: m.id,
    machineType: m.machineType,
    modelName: m.modelName,
    ownerId: m.ownerId,
    farmerId: user.id,
    farmerName: user.full_name,
    farmerPhone: normalizePhone(input.phone),
    serviceDate: input.serviceDate,
    fieldVillage: village,
    acreage: input.acreage,
    crop: (input.crop || null) as Crop | null,
    notes: input.notes.trim() || null,
    pricePerAcre: m.pricePerAcre,
    status: 'pending',
    requestId: input.requestId,
    createdAt: new Date().toISOString(),
  }
  all.unshift(booking)
  save(KEYS.bookings, all)

  notify(m.ownerId, 'booking_requested', booking.id, {
    machine_type: m.machineType,
    model_name: m.modelName,
    service_date: booking.serviceDate,
    farmer_name: user.full_name,
  })
  return booking.id
}

export async function listFarmerBookings(farmerId: string): Promise<Booking[]> {
  const user = requireUser()
  if (supabaseEnabled) {
    if (user.id !== farmerId) throw new Error('ERR_FORBIDDEN')
    const { data, error } = await requireSupabase().from('bookings').select('*').eq('farmer_id', farmerId).order('created_at', { ascending: false })
    throwIfError(error); return (data ?? []).map((x: any) => remoteBooking(x))
  }
  if (user.id !== farmerId) throw new Error('ERR_FORBIDDEN')
  return bookings()
    .filter((b) => b.farmerId === farmerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toBooking)
}

/** Bookings on the signed-in owner's own machines. */
export async function listOwnerBookings(): Promise<Booking[]> {
  const user = requireUser()
  if (supabaseEnabled) {
    const { data, error } = await requireSupabase().from('bookings').select('*').eq('owner_id', user.id).order('created_at', { ascending: false })
    throwIfError(error); return (data ?? []).map((x: any) => remoteBooking(x))
  }
  return bookings()
    .filter((b) => b.ownerId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toBooking)
}

export async function respondToBooking(bookingId: string, action: 'accept' | 'reject'): Promise<BookingStatus> {
  const user = requireUser()
  if (supabaseEnabled) {
    const { data, error } = await requireSupabase().rpc('respond_to_machine_booking', { p_booking_id: bookingId, p_action: action })
    throwIfError(error); return data as BookingStatus
  }
  if (action !== 'accept' && action !== 'reject') throw new Error('ERR_INVALID_INPUT')

  const all = bookings()
  const b = all.find((x) => x.id === bookingId)
  if (!b) throw new Error('ERR_NOT_FOUND')
  // Only the owner of this machine may decide.
  if (b.ownerId !== user.id) throw new Error('ERR_FORBIDDEN')
  if (b.status !== 'pending') throw new Error('ERR_INVALID_TRANSITION')

  let next: BookingStatus = 'rejected'
  if (action === 'accept') {
    if (b.serviceDate < todayIST()) throw new Error('ERR_PAST_DATE')
    if (load<StoredBlocked[]>(KEYS.blocked, []).some((x) => x.machineId === b.machineId && x.date === b.serviceDate)) {
      throw new Error('ERR_DATE_BLOCKED')
    }
    if (all.some((x) => x.id !== b.id && x.machineId === b.machineId && x.serviceDate === b.serviceDate && x.status === 'confirmed')) {
      throw new Error('ERR_DATE_TAKEN')
    }
    next = 'confirmed'
  }

  b.status = next
  save(KEYS.bookings, all)
  notify(b.farmerId, next === 'confirmed' ? 'booking_confirmed' : 'booking_rejected', b.id, {
    machine_type: b.machineType ?? undefined,
    model_name: b.modelName,
    service_date: b.serviceDate,
  })
  return next
}

export async function cancelBooking(bookingId: string): Promise<void> {
  const user = requireUser()
  if (supabaseEnabled) {
    const { error } = await requireSupabase().rpc('cancel_machine_booking', { p_booking_id: bookingId })
    throwIfError(error); return
  }
  const all = bookings()
  const b = all.find((x) => x.id === bookingId)
  if (!b) throw new Error('ERR_NOT_FOUND')
  if (b.farmerId !== user.id) throw new Error('ERR_FORBIDDEN')
  if (b.status !== 'pending' && b.status !== 'confirmed') throw new Error('ERR_INVALID_TRANSITION')

  b.status = 'cancelled'
  save(KEYS.bookings, all)
  notify(b.ownerId, 'booking_cancelled', b.id, {
    machine_type: b.machineType ?? undefined,
    model_name: b.modelName,
    service_date: b.serviceDate,
    farmer_name: b.farmerName,
  })
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export async function listNotifications(userId: string, limit = 50): Promise<AppNotification[]> {
  const user = requireUser()
  if (supabaseEnabled) {
    if (user.id !== userId) throw new Error('ERR_FORBIDDEN')
    const { data, error } = await requireSupabase().from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
    throwIfError(error)
    return (data ?? []).map((x: any) => ({ id: x.id, type: x.type, bookingId: x.booking_id, data: x.data ?? {}, readAt: x.read_at, createdAt: x.created_at }))
  }
  if (user.id !== userId) throw new Error('ERR_FORBIDDEN')
  return load<StoredNotification[]>(KEYS.notifs, [])
    .filter((n) => n.userId === userId)
    .slice(0, limit)
    .map(({ userId: _u, ...n }) => n)
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const user = requireUser()
  if (supabaseEnabled) {
    if (user.id !== userId) throw new Error('ERR_FORBIDDEN')
    const { error } = await requireSupabase().from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null)
    throwIfError(error); return
  }
  if (user.id !== userId) throw new Error('ERR_FORBIDDEN')
  const all = load<StoredNotification[]>(KEYS.notifs, [])
  const now = new Date().toISOString()
  let changed = false
  for (const n of all) {
    if (n.userId === userId && !n.readAt) {
      n.readAt = now
      changed = true
    }
  }
  if (changed) save(KEYS.notifs, all)
}
