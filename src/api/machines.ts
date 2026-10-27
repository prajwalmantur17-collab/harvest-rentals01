import {
  KEYS,
  hashPin,
  load,
  notify,
  requireUser,
  save,
  type StoredBlocked,
  type StoredBooking,
  type StoredMachine,
} from '../store/db'
import type {
  BusyDate,
  MachineFormValues,
  MachineListing,
  MachineStatus,
  OwnerMachine,
  Profile,
  SearchParams,
  ServiceArea,
} from '../types'
import { todayIST } from '../utils/format'
import { haversineKm } from '../utils/geo'
import { uid } from '../utils/id'
import { isValidPhone, normalizePhone } from '../utils/phone'
import { parseVillageList } from '../validation'
import { requireSupabase, supabaseEnabled, throwIfError } from '../lib/supabase'

const machines = () => load<StoredMachine[]>(KEYS.machines, [])

type RemoteMachine = Record<string, any>
const remoteListing = (m: RemoteMachine, distanceKm: number | null = null): MachineListing => ({
  id: String(m.id), ownerId: String(m.owner_id), ownerName: String(m.owner_name ?? m.owner_profile?.full_name ?? 'Machine owner'),
  machineType: m.machine_type, modelName: m.model_name ?? null, pricePerAcre: Number(m.price_per_acre),
  photoPath: m.photo_path ?? null, status: m.status, crops: m.crops ?? [], areas: m.areas ?? [],
  distanceKm, createdAt: m.created_at,
})
const remoteOwnerMachine = (m: RemoteMachine): OwnerMachine => ({
  id: String(m.id), machineType: m.machine_type, modelName: m.model_name ?? null,
  pricePerAcre: Number(m.price_per_acre), photoPath: m.photo_path ?? null, status: m.status,
  currentLat: m.current_lat == null ? null : Number(m.current_lat), currentLng: m.current_lng == null ? null : Number(m.current_lng),
  crops: m.crops ?? [], areas: m.areas ?? [], createdAt: m.created_at,
})
const remoteAreas = (v: MachineFormValues): ServiceArea[] => {
  const district = v.district.trim(), state = v.state.trim(), seen = new Set<string>(), out: ServiceArea[] = []
  for (const village of [v.village.trim(), ...parseVillageList(v.extraVillages)]) {
    const key = village.toLowerCase()
    if (village && !seen.has(key)) { seen.add(key); out.push({ village, district, state }) }
  }
  return out
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

function ownerName(ownerId: string): string {
  return load<Record<string, Profile>>(KEYS.users, {})[ownerId]?.full_name ?? ''
}

function toListing(m: StoredMachine, distanceKm: number | null): MachineListing {
  return {
    id: m.id,
    ownerId: m.ownerId,
    ownerName: ownerName(m.ownerId),
    machineType: m.machineType,
    modelName: m.modelName,
    pricePerAcre: m.pricePerAcre,
    photoPath: m.photoPath,
    status: m.status,
    crops: m.crops,
    areas: m.areas,
    distanceKm,
    createdAt: m.createdAt,
  }
}

function toOwnerMachine(m: StoredMachine): OwnerMachine {
  return {
    id: m.id,
    machineType: m.machineType,
    modelName: m.modelName,
    pricePerAcre: m.pricePerAcre,
    photoPath: m.photoPath,
    status: m.status,
    currentLat: m.lat,
    currentLng: m.lng,
    crops: m.crops,
    areas: m.areas,
    createdAt: m.createdAt,
  }
}

/** Search by service village / district / state, crop and machine type. Works without GPS or any map service. */
export async function searchMachines(params: SearchParams, limit = 50): Promise<MachineListing[]> {
  requireUser()
  if (supabaseEnabled) {
    const sb = requireSupabase()
    let q = sb.from('machines').select('*').eq('status', 'active')
    if (params.type) q = q.eq('machine_type', params.type)
    if (params.crop) q = q.contains('crops', [params.crop])
    const { data, error } = await q.limit(500)
    throwIfError(error)
    const village = norm(params.village), district = norm(params.district), state = norm(params.state)
    const rows: { listing: MachineListing; exact: boolean }[] = (data ?? []).filter((m: any) => {
      const areas = (m.areas ?? []) as ServiceArea[]
      return (!village && !district && !state) || areas.some(a =>
        (!village || norm(a.village).includes(village)) && (!district || norm(a.district).includes(district)) && (!state || norm(a.state).includes(state)))
    }).map((m: any) => {
      const lat = params.lat, lng = params.lng
      const km = lat != null && lng != null && m.current_lat != null && m.current_lng != null ? haversineKm(lat, lng, Number(m.current_lat), Number(m.current_lng)) : null
      const exact = village ? (m.areas ?? []).some((a: ServiceArea) => norm(a.village) === village) : false
      return { listing: remoteListing(m, km), exact }
    })
    rows.sort((a: { listing: MachineListing; exact: boolean }, b: { listing: MachineListing; exact: boolean }) => a.exact !== b.exact ? (a.exact ? -1 : 1) :
      a.listing.distanceKm != null && b.listing.distanceKm != null ? a.listing.distanceKm - b.listing.distanceKm :
      a.listing.distanceKm != null ? -1 : b.listing.distanceKm != null ? 1 :
      a.listing.pricePerAcre - b.listing.pricePerAcre)
    return rows.slice(0, Math.max(1, Math.min(limit, 100))).map((x: { listing: MachineListing; exact: boolean }) => x.listing)
  }
  const village = norm(params.village)
  const district = norm(params.district)
  const state = norm(params.state)
  const hasPlace = Boolean(village || district || state)

  const rows = machines()
    .filter((m) => m.status === 'active')
    .filter((m) => !params.type || m.machineType === params.type)
    .filter((m) => !params.crop || m.crops.includes(params.crop as StoredMachine['crops'][number]))
    .filter(
      (m) =>
        !hasPlace ||
        m.areas.some(
          (a) =>
            (!village || norm(a.village).includes(village)) &&
            (!district || norm(a.district).includes(district)) &&
            (!state || norm(a.state).includes(state)),
        ),
    )
    .map((m) => {
      const km =
        params.lat != null && params.lng != null && m.lat != null && m.lng != null
          ? haversineKm(params.lat, params.lng, m.lat, m.lng)
          : null
      const exact = village ? m.areas.some((a) => norm(a.village) === village) : false
      return { m, km, exact }
    })

  rows.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1
    if (a.km != null || b.km != null) {
      if (a.km == null) return 1
      if (b.km == null) return -1
      if (a.km !== b.km) return a.km - b.km
    }
    if (a.m.pricePerAcre !== b.m.pricePerAcre) return a.m.pricePerAcre - b.m.pricePerAcre
    return b.m.createdAt.localeCompare(a.m.createdAt)
  })

  return rows.slice(0, Math.max(1, Math.min(limit, 100))).map((r) => toListing(r.m, r.km))
}

export async function getMachine(id: string): Promise<MachineListing | null> {
  const user = requireUser()
  if (supabaseEnabled) {
    const { data, error } = await requireSupabase().from('machines').select('*').eq('id', id).is('removed_at', null).maybeSingle()
    throwIfError(error)
    return data ? remoteListing(data as any) : null
  }
  const m = machines().find((x) => x.id === id)
  if (!m) return null
  const visible =
    m.status === 'active' ||
    m.ownerId === user.id ||
    load<StoredBooking[]>(KEYS.bookings, []).some((b) => b.machineId === id && b.farmerId === user.id)
  return visible ? toListing(m, null) : null
}

export async function getMachinePhone(machineId: string): Promise<string> {
  requireUser()
  if (supabaseEnabled) {
    const { data, error } = await requireSupabase().rpc('get_machine_phone', { p_machine_id: machineId })
    throwIfError(error)
    return String(data)
  }
  const m = machines().find((x) => x.id === machineId)
  if (!m) throw new Error('ERR_NOT_FOUND')
  return m.phone
}

/** Days a farmer cannot book: blocked by the owner or already confirmed (no names exposed). */
export async function getBusyDates(machineId: string): Promise<BusyDate[]> {
  requireUser()
  if (supabaseEnabled) {
    const { data, error } = await requireSupabase().rpc('get_machine_busy_dates', { p_machine_id: machineId })
    throwIfError(error)
    return (data ?? []).map((x: any) => ({ date: String(x.date), reason: x.reason as 'blocked' | 'booked' }))
      .sort((a: BusyDate, b: BusyDate) => a.date.localeCompare(b.date))
  }
  const today = todayIST()
  const out: BusyDate[] = []
  for (const b of load<StoredBlocked[]>(KEYS.blocked, [])) {
    if (b.machineId === machineId && b.date >= today) out.push({ date: b.date, reason: 'blocked' })
  }
  for (const b of load<StoredBooking[]>(KEYS.bookings, [])) {
    if (b.machineId === machineId && b.status === 'confirmed' && b.serviceDate >= today) {
      out.push({ date: b.serviceDate, reason: 'booked' })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

// ---------------------------------------------------------------------------
// Owner: my machines
// ---------------------------------------------------------------------------
export async function listMyMachines(ownerId: string): Promise<OwnerMachine[]> {
  if (supabaseEnabled) {
    const { data, error } = await requireSupabase().from('machines').select('*').eq('owner_id', ownerId).is('removed_at', null).order('created_at', { ascending: false })
    throwIfError(error)
    return (data ?? []).map((m: any) => remoteOwnerMachine(m))
  }
  return machines()
    .filter((m) => m.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toOwnerMachine)
}

export async function getMyMachine(ownerId: string, id: string): Promise<OwnerMachine | null> {
  if (supabaseEnabled) {
    const { data, error } = await requireSupabase().from('machines').select('*').eq('id', id).eq('owner_id', ownerId).is('removed_at', null).maybeSingle()
    throwIfError(error)
    return data ? remoteOwnerMachine(data as any) : null
  }
  const m = machines().find((x) => x.id === id && x.ownerId === ownerId)
  return m ? toOwnerMachine(m) : null
}

function buildAreas(v: MachineFormValues): ServiceArea[] {
  const district = v.district.trim()
  const state = v.state.trim()
  const seen = new Set<string>()
  const areas: ServiceArea[] = []
  for (const village of [v.village.trim(), ...parseVillageList(v.extraVillages)]) {
    const key = village.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    areas.push({ village, district, state })
  }
  return areas
}

/** Create (id = null) or update a machine. A new machine needs a 4-digit PIN, needed later to remove it. */
export async function saveMachine(id: string | null, v: MachineFormValues): Promise<string> {
  const user = requireUser()
  if (user.role !== 'owner') throw new Error('ERR_NOT_OWNER')
  if (!v.village.trim() || !v.district.trim() || !v.state.trim()) throw new Error('ERR_AREA_REQUIRED')
  if (v.crops.length === 0) throw new Error('ERR_CROPS_REQUIRED')
  if (!v.photoPath) throw new Error('ERR_PHOTO_REQUIRED')
  const price = Number(v.pricePerAcre)
  if (!v.machineType || !Number.isFinite(price) || price <= 0 || price > 100000 || !isValidPhone(v.phone)) {
    throw new Error('ERR_INVALID_INPUT')
  }

  const fields = {
    machineType: v.machineType,
    modelName: v.modelName.trim() || null,
    pricePerAcre: price,
    phone: normalizePhone(v.phone),
    photoPath: v.photoPath,
    lat: v.lat,
    lng: v.lng,
    crops: [...new Set(v.crops)],
    areas: buildAreas(v),
  }

  if (supabaseEnabled) {
    if (!v.photoPath) throw new Error('ERR_PHOTO_REQUIRED')
    const sb = requireSupabase()
    const remoteFields = {
      owner_id: user.id, owner_name: user.full_name, machine_type: v.machineType, model_name: v.modelName.trim() || null,
      price_per_acre: price, photo_path: v.photoPath,
      current_lat: v.lat, current_lng: v.lng, crops: [...new Set(v.crops)], areas: remoteAreas(v),
    }
    if (id) {
      const { data: updated, error } = await sb.from('machines').update(remoteFields).eq('id', id).eq('owner_id', user.id).is('removed_at', null).select('id').maybeSingle()
      throwIfError(error)
      if (!updated) throw new Error('ERR_FORBIDDEN')
      const contact = await sb.from('machine_contacts').upsert({ machine_id: id, owner_id: user.id, phone: normalizePhone(v.phone) }, { onConflict: 'machine_id' })
      throwIfError(contact.error)
      return id
    }
    if (!/^\\d{4}$/.test(v.pin)) throw new Error('ERR_INVALID_INPUT')
    const newId = crypto.randomUUID()
    const pinHash = await hashPin(v.pin, newId)
    const { data, error } = await sb.from('machines').insert({ ...remoteFields, id: newId, pin_hash: pinHash, status: 'active' }).select('id').single()
    throwIfError(error)
    const contact = await sb.from('machine_contacts').insert({ machine_id: data.id, owner_id: user.id, phone: normalizePhone(v.phone) })
    if (contact.error) {
      await sb.from('machines').update({ removed_at: new Date().toISOString(), status: 'paused' }).eq('id', data.id)
      throwIfError(contact.error)
    }
    return String(data.id)
  }

  const list = machines()
  if (id) {
    const idx = list.findIndex((m) => m.id === id)
    if (idx < 0 || list[idx].ownerId !== user.id) throw new Error('ERR_FORBIDDEN')
    list[idx] = { ...list[idx], ...fields }
    save(KEYS.machines, list)
    return id
  }

  if (!/^\d{4}$/.test(v.pin)) throw new Error('ERR_INVALID_INPUT')
  const newId = uid()
  list.unshift({
    id: newId,
    ownerId: user.id,
    status: 'active',
    pinHash: await hashPin(v.pin, newId),
    createdAt: new Date().toISOString(),
    ...fields,
  })
  save(KEYS.machines, list)
  return newId
}

export async function setMachineStatus(id: string, status: MachineStatus): Promise<void> {
  const user = requireUser()
  if (supabaseEnabled) {
    const { data, error } = await requireSupabase().from('machines').update({ status }).eq('id', id).eq('owner_id', user.id).is('removed_at', null).select('id').maybeSingle()
    throwIfError(error)
    if (!data) throw new Error('ERR_FORBIDDEN')
    return
  }
  const list = machines()
  const idx = list.findIndex((m) => m.id === id)
  if (idx < 0 || list[idx].ownerId !== user.id) throw new Error('ERR_FORBIDDEN')
  list[idx] = { ...list[idx], status }
  save(KEYS.machines, list)
}

/**
 * Remove a machine. Needs the 4-digit PIN the owner set when adding it.
 * Open bookings (waiting or confirmed) are cancelled and the farmers are told.
 */
export async function removeMachine(id: string, pin: string): Promise<void> {
  const user = requireUser()
  if (supabaseEnabled) {
    const sb = requireSupabase()
    const { data: existing, error: readError } = await sb.from('machines').select('photo_path').eq('id', id).eq('owner_id', user.id).maybeSingle()
    throwIfError(readError)
    const { error } = await sb.rpc('remove_machine', { p_machine_id: id, p_pin: pin.trim() })
    throwIfError(error)
    if (existing?.photo_path) void removeMachinePhoto(existing.photo_path).catch(() => undefined)
    return
  }
  const list = machines()
  const m = list.find((x) => x.id === id)
  if (!m) throw new Error('ERR_NOT_FOUND')
  if (m.ownerId !== user.id) throw new Error('ERR_FORBIDDEN')
  if ((await hashPin(pin.trim(), m.id)) !== m.pinHash) throw new Error('ERR_WRONG_PIN')

  const bookings = load<StoredBooking[]>(KEYS.bookings, [])
  const affected: StoredBooking[] = []
  for (const b of bookings) {
    if (b.machineId === id && (b.status === 'pending' || b.status === 'confirmed')) {
      b.status = 'cancelled'
      affected.push(b)
    }
  }
  save(KEYS.bookings, bookings)
  save(
    KEYS.blocked,
    load<StoredBlocked[]>(KEYS.blocked, []).filter((b) => b.machineId !== id),
  )
  save(
    KEYS.machines,
    list.filter((x) => x.id !== id),
  )
  for (const b of affected) {
    notify(b.farmerId, 'machine_removed', b.id, {
      machine_type: m.machineType,
      model_name: m.modelName,
      service_date: b.serviceDate,
    })
  }
}

// ---------------------------------------------------------------------------
// Owner: blocked dates
// ---------------------------------------------------------------------------
function requireOwned(machineId: string): StoredMachine {
  const user = requireUser()
  const m = machines().find((x) => x.id === machineId)
  if (!m || m.ownerId !== user.id) throw new Error('ERR_FORBIDDEN')
  return m
}

export async function listBlockedDates(machineId: string): Promise<string[]> {
  if (supabaseEnabled) {
    const user = requireUser()
    const sb = requireSupabase()
    const owned = await sb.from('machines').select('id').eq('id', machineId).eq('owner_id', user.id).is('removed_at', null).maybeSingle()
    throwIfError(owned.error)
    if (!owned.data) throw new Error('ERR_FORBIDDEN')
    const { data, error } = await sb.from('blocked_dates').select('date').eq('machine_id', machineId).gte('date', todayIST()).order('date')
    throwIfError(error); return (data ?? []).map((x: any) => x.date)
  }
  requireOwned(machineId)
  const today = todayIST()
  return load<StoredBlocked[]>(KEYS.blocked, [])
    .filter((b) => b.machineId === machineId && b.date >= today)
    .map((b) => b.date)
    .sort()
}

export async function blockDate(machineId: string, date: string): Promise<void> {
  if (supabaseEnabled) {
    const { error } = await requireSupabase().rpc('block_machine_date', { p_machine_id: machineId, p_date: date })
    throwIfError(error); return
  }
  requireOwned(machineId)
  if (!date || date < todayIST()) throw new Error('ERR_PAST_DATE')
  const hasConfirmed = load<StoredBooking[]>(KEYS.bookings, []).some(
    (b) => b.machineId === machineId && b.serviceDate === date && b.status === 'confirmed',
  )
  if (hasConfirmed) throw new Error('ERR_HAS_BOOKING')
  const list = load<StoredBlocked[]>(KEYS.blocked, [])
  if (list.some((b) => b.machineId === machineId && b.date === date)) throw new Error('ERR_DUPLICATE')
  list.push({ machineId, date })
  save(KEYS.blocked, list)
}

export async function unblockDate(machineId: string, date: string): Promise<void> {
  if (supabaseEnabled) {
    const { error } = await requireSupabase().rpc('unblock_machine_date', { p_machine_id: machineId, p_date: date })
    throwIfError(error); return
  }
  requireOwned(machineId)
  save(
    KEYS.blocked,
    load<StoredBlocked[]>(KEYS.blocked, []).filter((b) => !(b.machineId === machineId && b.date === date)),
  )
}

// ---------------------------------------------------------------------------
// Photos: stored inside the browser as small JPEG data URLs
// ---------------------------------------------------------------------------
export function photoUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('data:') || path.startsWith('blob:') || /^https?:\/\//i.test(path)) return path
  if (supabaseEnabled) return requireSupabase().storage.from('machine-photos').getPublicUrl(path).data.publicUrl
  return path
}

/** Shrink phone photos so they fit in browser storage and load quickly on slow connections. */
export async function prepareImage(file: File, maxSide = 900): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.78))
    return blob ?? file
  } catch {
    return file
  }
}

export async function uploadMachinePhoto(
  file: Blob,
  _ownerId: string,
  onProgress: (pct: number) => void,
): Promise<string> {
  if (supabaseEnabled) {
    onProgress(5)
    const owner = _ownerId || requireUser().id
    const contentType = file.type || 'image/jpeg'
    const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
    const path = `${owner}/${crypto.randomUUID()}.${extension}`
    const { error } = await requireSupabase().storage.from('machine-photos').upload(path, file, {
      contentType, upsert: false, cacheControl: '3600',
    })
    throwIfError(error)
    onProgress(100)
    return path
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('ERR_UPLOAD'))
    reader.readAsDataURL(file)
  })
  if (dataUrl.length > 1_500_000) throw new Error('ERR_UPLOAD')
  onProgress(100)
  return dataUrl
}

/** Photos live inside the machine record, so there is nothing separate to delete. */
export async function removeMachinePhoto(_path: string): Promise<void> {
  if (supabaseEnabled && _path && !_path.startsWith('data:')) {
    const { error } = await requireSupabase().storage.from('machine-photos').remove([_path])
    throwIfError(error)
  }
}
