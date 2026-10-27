import type { TranslationKey } from '../i18n/en'
import type { MachineFormValues } from '../types'
import { isValidPhone } from '../utils/phone'

export type Errors<T extends string> = Partial<Record<T, TranslationKey>>

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const textOk = (s: string) => s.trim().length >= 2

export function validatePhoto(file: { type: string; size: number }): TranslationKey | null {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) return 'v.photoType'
  if (file.size > MAX_PHOTO_BYTES) return 'v.photoSize'
  return null
}

export type MachineField = 'machineType' | 'modelName' | 'pricePerAcre' | 'crops' | 'village' | 'district' | 'state' | 'phone' | 'pin' | 'photoPath'

export function validateMachine(v: MachineFormValues, requirePin = true): Errors<MachineField> {
  const e: Errors<MachineField> = {}
  if (requirePin && !/^\d{4}$/.test(v.pin)) e.pin = 'v.pin'
  if (!v.photoPath) e.photoPath = 'v.photoRequired'
  if (!v.machineType) e.machineType = 'v.required'
  if (v.modelName.trim() && v.modelName.trim().length < 2) e.modelName = 'v.minLength'
  const price = Number(v.pricePerAcre)
  if (!v.pricePerAcre.trim() || !Number.isFinite(price) || price <= 0 || price > 100000) e.pricePerAcre = 'v.price'
  if (v.crops.length === 0) e.crops = 'v.crops'
  if (!v.village.trim()) e.village = 'v.required'
  else if (!textOk(v.village)) e.village = 'v.minLength'
  if (!v.district.trim()) e.district = 'v.required'
  else if (!textOk(v.district)) e.district = 'v.minLength'
  if (!v.state.trim()) e.state = 'v.required'
  if (!v.phone.trim() || !isValidPhone(v.phone)) e.phone = 'v.phone'
  return e
}

export interface BookingFormValues {
  date: string
  fieldVillage: string
  acreage: string
  crop: string
  phone: string
}
export type BookingField = keyof BookingFormValues

export function validateBooking(v: BookingFormValues, today: string, requireCrop: boolean): Errors<BookingField> {
  const e: Errors<BookingField> = {}
  if (!v.date || v.date < today) e.date = 'v.date'
  if (!v.fieldVillage.trim()) e.fieldVillage = 'v.required'
  else if (!textOk(v.fieldVillage)) e.fieldVillage = 'v.minLength'
  const acres = Number(v.acreage)
  if (!v.acreage.trim() || !Number.isFinite(acres) || acres <= 0 || acres > 5000) e.acreage = 'v.acreage'
  if (requireCrop && !v.crop) e.crop = 'v.required'
  if (!v.phone.trim() || !isValidPhone(v.phone)) e.phone = 'v.phone'
  return e
}

export function hasErrors(e: object): boolean {
  return Object.keys(e).length > 0
}

/** "Ranebennur, Byadgi ,  Haveri" -> ["Ranebennur", "Byadgi", "Haveri"] (deduplicated, max 20). */
export function parseVillageList(input: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of input.split(/[,\n;]/)) {
    const name = part.trim().replace(/\s+/g, ' ')
    if (name.length < 2 || name.length > 80) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
    if (out.length >= 20) break
  }
  return out
}
