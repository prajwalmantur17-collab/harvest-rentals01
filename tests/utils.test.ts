import { describe, expect, it } from 'vitest'
import { en } from '../src/i18n/en'
import { kn } from '../src/i18n/kn'
import { hi } from '../src/i18n/hi'
import { translate } from '../src/i18n'
import { errorKey } from '../src/utils/errors'
import { formatInr, todayIST } from '../src/utils/format'
import { isValidPhone, normalizePhone, toTelHref, toWhatsAppHref } from '../src/utils/phone'
import { parseVillageList, validateBooking, validateMachine, validatePhoto } from '../src/validation'

describe('translations', () => {
  it('Kannada and Hindi have every English key with real (non-English) text', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(kn[key], `kn ${key}`).toBeTruthy()
      expect(hi[key], `hi ${key}`).toBeTruthy()
    }
    expect(Object.keys(kn).length).toBe(Object.keys(en).length)
    expect(Object.keys(hi).length).toBe(Object.keys(en).length)
    expect(translate('kn', 'role.farmer.title')).toBe('ನಾನು ರೈತ')
    expect(translate('hi', 'role.farmer.title')).toBe('मैं किसान हूँ')
  })

  it('fills in {placeholders}', () => {
    expect(translate('en', 'bookings.acres', { n: 5 })).toBe('5 acres')
  })
})

describe('phone helpers', () => {
  it('validates and builds call / WhatsApp links', () => {
    expect(isValidPhone('98765 43210')).toBe(true)
    expect(isValidPhone('123')).toBe(false)
    expect(normalizePhone('098765-43210')).toBe('9876543210')
    expect(toTelHref('9876543210')).toBe('tel:+919876543210')
    expect(toWhatsAppHref('9876543210')).toBe('https://wa.me/919876543210')
  })
})

describe('validation', () => {
  it('validates a booking', () => {
    const ok = { date: '2099-01-01', fieldVillage: 'Hirekerur', acreage: '5', crop: 'wheat', phone: '9876543210' }
    expect(validateBooking(ok, todayIST(), true)).toEqual({})
    expect(validateBooking({ ...ok, acreage: '0' }, todayIST(), true).acreage).toBe('v.acreage')
    expect(validateBooking({ ...ok, date: '2000-01-01' }, todayIST(), true).date).toBe('v.date')
  })

  it('validates a machine including the PIN', () => {
    const base = {
      machineType: 'combine_harvester' as const, modelName: '', pricePerAcre: '1500', crops: ['wheat' as const],
      village: 'Hirekerur', extraVillages: '', district: 'Haveri', state: 'Karnataka', phone: '9876543210',
      pin: '4821', photoPath: 'data:image/jpeg;base64,ZmFrZQ==', lat: null, lng: null,
    }
    expect(validateMachine(base)).toEqual({})
    expect(validateMachine({ ...base, pin: '12' }).pin).toBe('v.pin')
    expect(validateMachine({ ...base, pin: '' }, false).pin).toBeUndefined()
    expect(validateMachine({ ...base, crops: [] }).crops).toBe('v.crops')
  })

  it('checks photo type and size', () => {
    expect(validatePhoto({ type: 'image/png', size: 1000 })).toBeNull()
    expect(validatePhoto({ type: 'application/pdf', size: 1000 })).toBe('v.photoType')
    expect(validatePhoto({ type: 'image/jpeg', size: 6 * 1024 * 1024 })).toBe('v.photoSize')
  })

  it('parses a village list', () => {
    expect(parseVillageList('Ranebennur, byadgi ,Ranebennur;;')).toEqual(['Ranebennur', 'byadgi'])
  })
})

describe('formatting and errors', () => {
  it('formats rupees', () => {
    expect(formatInr(1800, 'en')).toContain('1,800')
  })
  it('maps error codes to friendly keys', () => {
    expect(errorKey(new Error('ERR_WRONG_PIN'))).toBe('err.wrongPin')
    expect(errorKey(new Error('ERR_DATE_TAKEN'))).toBe('err.dateTaken')
    expect(errorKey(new Error('something raw'))).toBe('err.generic')
  })
})
