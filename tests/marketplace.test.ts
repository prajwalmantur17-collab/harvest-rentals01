import { beforeEach, describe, expect, it } from 'vitest'
import { installStorage } from './helpers'
import { signInDemo, signOutDemo, saveRole } from '../src/api/profile'
import {
  blockDate,
  getBusyDates,
  listMyMachines,
  removeMachine,
  saveMachine,
  searchMachines,
  setMachineStatus,
} from '../src/api/machines'
import {
  cancelBooking,
  createBooking,
  listFarmerBookings,
  listNotifications,
  listOwnerBookings,
  respondToBooking,
} from '../src/api/bookings'
import { todayIST } from '../src/utils/format'
import type { MachineFormValues } from '../src/types'

const FUTURE = '2099-03-15'
const FUTURE2 = '2099-03-16'

const machineForm = (over: Partial<MachineFormValues> = {}): MachineFormValues => ({
  machineType: 'combine_harvester',
  modelName: 'JD W70',
  pricePerAcre: '1800',
  crops: ['wheat', 'paddy'],
  village: 'Hirekerur',
  extraVillages: 'Ranebennur, Byadgi',
  district: 'Haveri',
  state: 'Karnataka',
  phone: '9876543210',
  pin: '4821',
  photoPath: 'data:image/jpeg;base64,ZmFrZQ==',
  lat: null,
  lng: null,
  ...over,
})

async function as(name: string, role: 'farmer' | 'owner') {
  const p = signInDemo(name, '', 'en', 'Guest')
  if (!p.role) await saveRole(role)
  return p
}

async function addMachine(owner = 'Owner One', over: Partial<MachineFormValues> = {}) {
  await as(owner, 'owner')
  return saveMachine(null, machineForm(over))
}

const book = (machineId: string, date = FUTURE, requestId = crypto.randomUUID()) =>
  createBooking({
    machineId,
    serviceDate: date,
    fieldVillage: 'Hirekerur',
    acreage: 5,
    crop: 'wheat',
    phone: '9123456780',
    notes: '',
    requestId,
  })

beforeEach(() => installStorage())

describe('demo sign-in', () => {
  it('accepts any input, even nothing', () => {
    expect(signInDemo('', '', 'en', 'Guest').full_name).toBe('Guest')
    expect(signInDemo('  Rámesh  K  ', 'abc', 'kn', 'Guest').full_name).toBe('Rámesh K')
    expect(signInDemo('ರಮೇಶ', '', 'kn', 'Guest').full_name).toBe('ರಮೇಶ')
  })

  it('opens the same account again and keeps the role', async () => {
    const a = signInDemo('Sita', '', 'en', 'Guest')
    await saveRole('farmer')
    signOutDemo()
    const b = signInDemo('sita', '', 'hi', 'Guest')
    expect(b.id).toBe(a.id)
    expect(b.role).toBe('farmer')
    expect(b.language).toBe('hi')
  })

  it('does not allow switching an existing role', async () => {
    signInDemo('Sita', '', 'en', 'Guest')
    await saveRole('farmer')
    await expect(saveRole('owner')).rejects.toThrow('ERR_ROLE_LOCKED')
  })
})

describe('owner listings, count and PIN removal', () => {
  it('counts the machines an owner has listed', async () => {
    const owner = await as('Owner One', 'owner')
    await saveMachine(null, machineForm())
    await saveMachine(null, machineForm({ modelName: 'Second', pin: '1111' }))
    expect((await listMyMachines(owner.id)).length).toBe(2)
  })

  it('requires a 4-digit PIN to add a machine', async () => {
    await as('Owner One', 'owner')
    await expect(saveMachine(null, machineForm({ pin: '12' }))).rejects.toThrow('ERR_INVALID_INPUT')
    await expect(saveMachine(null, machineForm({ pin: 'abcd' }))).rejects.toThrow('ERR_INVALID_INPUT')
  })

  it('removes a machine only with the right PIN', async () => {
    const owner = await as('Owner One', 'owner')
    const id = await saveMachine(null, machineForm())
    await expect(removeMachine(id, '0000')).rejects.toThrow('ERR_WRONG_PIN')
    expect((await listMyMachines(owner.id)).length).toBe(1)
    await removeMachine(id, '4821')
    expect((await listMyMachines(owner.id)).length).toBe(0)
  })

  it('never stores the PIN itself', async () => {
    await addMachine()
    expect(localStorage.getItem('hr_machines')).not.toContain('4821')
  })

  it("another owner cannot remove, edit or pause someone else's machine", async () => {
    const id = await addMachine('Owner One')
    await as('Owner Two', 'owner')
    await expect(removeMachine(id, '4821')).rejects.toThrow('ERR_FORBIDDEN')
    await expect(saveMachine(id, machineForm({ pricePerAcre: '1' }))).rejects.toThrow('ERR_FORBIDDEN')
    await expect(setMachineStatus(id, 'paused')).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('cancels open bookings and tells the farmer when a machine is removed', async () => {
    const id = await addMachine('Owner One')
    const farmer = await as('Farmer One', 'farmer')
    await book(id)
    await as('Owner One', 'owner')
    await removeMachine(id, '4821')
    signInDemo('Farmer One', '', 'en', 'Guest')
    expect((await listFarmerBookings(farmer.id))[0].status).toBe('cancelled')
    expect((await listNotifications(farmer.id)).some((n) => n.type === 'machine_removed')).toBe(true)
  })
})

describe('search', () => {
  it('finds machines by service village, district, crop and type, and ignores paused ones', async () => {
    const id = await addMachine()
    await as('Farmer One', 'farmer')
    expect((await searchMachines({ village: 'ranebennur' })).map((m) => m.id)).toEqual([id])
    expect((await searchMachines({ district: 'haveri', crop: 'paddy' })).length).toBe(1)
    expect((await searchMachines({ village: 'Hirekerur', crop: 'sugarcane' })).length).toBe(0)
    expect((await searchMachines({ type: 'paddy_harvester' })).length).toBe(0)
    expect((await searchMachines({ village: 'Nowhere' })).length).toBe(0)

    await as('Owner One', 'owner')
    await setMachineStatus(id, 'paused')
    await as('Farmer One', 'farmer')
    expect((await searchMachines({})).length).toBe(0)
  })

  it('works without GPS and ranks by distance only when location is given', async () => {
    await addMachine('Owner One', { lat: 14.6, lng: 75.4 })
    await as('Farmer One', 'farmer')
    expect((await searchMachines({}))[0].distanceKm).toBeNull()
    expect((await searchMachines({ lat: 14.6, lng: 75.4 }))[0].distanceKm).toBeCloseTo(0, 1)
  })
})

describe('booking workflow', () => {
  it('goes pending -> confirmed and the farmer sees the result', async () => {
    const id = await addMachine()
    const farmer = await as('Farmer One', 'farmer')
    const bookingId = await book(id)
    expect((await listFarmerBookings(farmer.id))[0].status).toBe('pending')

    await as('Owner One', 'owner')
    expect((await listOwnerBookings()).length).toBe(1)
    expect(await respondToBooking(bookingId, 'accept')).toBe('confirmed')

    signInDemo('Farmer One', '', 'en', 'Guest')
    expect((await listFarmerBookings(farmer.id))[0].status).toBe('confirmed')
    expect((await listNotifications(farmer.id))[0].type).toBe('booking_confirmed')
  })

  it('can be rejected, and cannot be decided twice', async () => {
    const id = await addMachine()
    await as('Farmer One', 'farmer')
    const bookingId = await book(id)
    await as('Owner One', 'owner')
    expect(await respondToBooking(bookingId, 'reject')).toBe('rejected')
    await expect(respondToBooking(bookingId, 'accept')).rejects.toThrow('ERR_INVALID_TRANSITION')
  })

  it('handles a double tap safely (same request id -> one booking)', async () => {
    const id = await addMachine()
    const farmer = await as('Farmer One', 'farmer')
    const rid = crypto.randomUUID()
    const a = await book(id, FUTURE, rid)
    const b = await book(id, FUTURE, rid)
    expect(a).toBe(b)
    expect((await listFarmerBookings(farmer.id)).length).toBe(1)
  })

  it('blocks a second pending request by the same farmer for the same day', async () => {
    const id = await addMachine()
    await as('Farmer One', 'farmer')
    await book(id)
    await expect(book(id)).rejects.toThrow('ERR_DUPLICATE')
  })

  it('never confirms two bookings on the same day', async () => {
    const id = await addMachine()
    await as('Farmer One', 'farmer')
    const b1 = await book(id)
    await as('Farmer Two', 'farmer')
    const b2 = await book(id)
    await as('Owner One', 'owner')
    await respondToBooking(b1, 'accept')
    await expect(respondToBooking(b2, 'accept')).rejects.toThrow('ERR_DATE_TAKEN')
    await as('Farmer Three', 'farmer')
    await expect(book(id)).rejects.toThrow('ERR_DATE_TAKEN')
    expect((await getBusyDates(id)).map((d) => d.date)).toContain(FUTURE)
  })

  it('refuses blocked and past dates', async () => {
    const id = await addMachine()
    await blockDate(id, FUTURE2)
    await as('Farmer One', 'farmer')
    await expect(book(id, FUTURE2)).rejects.toThrow('ERR_DATE_BLOCKED')
    await expect(book(id, '2000-01-01')).rejects.toThrow('ERR_PAST_DATE')
    expect(todayIST() <= FUTURE).toBe(true)
  })

  it('only the machine owner can accept or reject', async () => {
    const id = await addMachine('Owner One')
    await as('Farmer One', 'farmer')
    const bookingId = await book(id)
    await expect(respondToBooking(bookingId, 'accept')).rejects.toThrow('ERR_FORBIDDEN')
    await as('Owner Two', 'owner')
    await expect(respondToBooking(bookingId, 'accept')).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('farmers only, and never on their own machine; others cannot cancel', async () => {
    const id = await addMachine('Owner One')
    await expect(book(id)).rejects.toThrow('ERR_NOT_FARMER')
    await as('Farmer One', 'farmer')
    const bookingId = await book(id)
    await as('Farmer Two', 'farmer')
    await expect(cancelBooking(bookingId)).rejects.toThrow('ERR_FORBIDDEN')
    await as('Farmer One', 'farmer')
    await cancelBooking(bookingId)
    await expect(cancelBooking(bookingId)).rejects.toThrow('ERR_INVALID_TRANSITION')
  })

  it('refuses a paused machine', async () => {
    const id = await addMachine()
    await setMachineStatus(id, 'paused')
    await as('Farmer One', 'farmer')
    await expect(book(id)).rejects.toThrow('ERR_MACHINE_UNAVAILABLE')
  })

  it('notifies the owner of a new request', async () => {
    const id = await addMachine()
    await as('Farmer One', 'farmer')
    await book(id)
    const owner = await as('Owner One', 'owner')
    expect((await listNotifications(owner.id))[0].type).toBe('booking_requested')
  })
})
