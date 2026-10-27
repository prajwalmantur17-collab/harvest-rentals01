export type Role = 'farmer' | 'owner'
export type Lang = 'en' | 'kn' | 'hi'

export const MACHINE_TYPES = [
  'combine_harvester',
  'paddy_harvester',
  'sugarcane_harvester',
  'maize_harvester',
  'tractor_harvester',
  'other',
] as const
export type MachineType = (typeof MACHINE_TYPES)[number]

export const CROPS = [
  'wheat',
  'paddy',
  'maize',
  'sugarcane',
  'soybean',
  'ragi',
  'jowar',
  'bajra',
  'pulses',
  'mustard',
  'other',
] as const
export type Crop = (typeof CROPS)[number]

export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled'
export type MachineStatus = 'active' | 'paused'

export interface Profile {
  id: string
  full_name: string
  email: string | null
  avatar_url: string | null
  role: Role | null
  language: Lang
  phone: string | null
}

export interface ServiceArea {
  village: string
  district: string
  state: string
}

/** A machine as returned by search_machines (never contains a phone number). */
export interface MachineListing {
  id: string
  ownerId: string
  ownerName: string
  machineType: MachineType
  modelName: string | null
  pricePerAcre: number
  photoPath: string | null
  status: MachineStatus
  crops: Crop[]
  areas: ServiceArea[]
  distanceKm: number | null
  createdAt: string
}

export interface OwnerMachine {
  id: string
  machineType: MachineType
  modelName: string | null
  pricePerAcre: number
  photoPath: string | null
  status: MachineStatus
  currentLat: number | null
  currentLng: number | null
  crops: Crop[]
  areas: ServiceArea[]
  createdAt: string
}

export interface Booking {
  id: string
  machineId: string
  farmerId: string
  farmerName: string
  farmerPhone: string
  serviceDate: string // YYYY-MM-DD
  fieldVillage: string
  acreage: number
  crop: Crop | null
  notes: string | null
  pricePerAcre: number
  status: BookingStatus
  createdAt: string
  machineType: MachineType | null
  modelName: string | null
}

export interface AppNotification {
  id: string
  type: 'booking_requested' | 'booking_confirmed' | 'booking_rejected' | 'booking_cancelled' | 'machine_removed'
  bookingId: string | null
  data: {
    machine_type?: MachineType
    model_name?: string | null
    service_date?: string
    farmer_name?: string
  }
  readAt: string | null
  createdAt: string
}

export interface BusyDate {
  date: string
  reason: 'blocked' | 'booked'
}

export interface SearchParams {
  village?: string
  district?: string
  state?: string
  crop?: string
  type?: string
  lat?: number | null
  lng?: number | null
}

export interface MachineFormValues {
  machineType: MachineType | ''
  modelName: string
  pricePerAcre: string
  crops: Crop[]
  village: string
  extraVillages: string
  district: string
  state: string
  phone: string
  /** 4-digit PIN chosen when adding a machine; needed later to remove it. */
  pin: string
  photoPath: string | null
  lat: number | null
  lng: number | null
}
