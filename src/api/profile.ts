import { KEYS, load, requireUser, save, setSessionUser } from '../store/db'
import type { Lang, Profile, Role } from '../types'
import { requireSupabase, supabaseEnabled, throwIfError } from '../lib/supabase'

const users = () => load<Record<string, Profile>>(KEYS.users, {})

function localProfile(profile: Profile): void {
  const all = users()
  all[profile.id] = profile
  save(KEYS.users, all)
  setSessionUser(profile.id)
}

function fromRow(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    full_name: String(row.full_name ?? 'Guest'),
    email: (row.email as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    role: (row.role as Role | null) ?? null,
    language: ((row.language as Lang) || 'en'),
    phone: (row.phone as string | null) ?? null,
  }
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (supabaseEnabled) {
    const sb = requireSupabase()
    const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle()
    throwIfError(error)
    if (data) {
      const profile = fromRow(data as Record<string, unknown>)
      localProfile(profile)
      return profile
    }
  }
  return users()[userId] ?? null
}

/** Judge/demo mode: no password and browser-local data. */
export function signInDemo(name: string, phone: string, language: Lang, guestName: string): Profile {
  const cleanName = name.trim().replace(/\s+/g, ' ').slice(0, 80)
  const cleanPhone = phone.trim().slice(0, 20)
  const digits = cleanPhone.replace(/\D/g, '')
  const key = digits || cleanName.toLowerCase() || 'guest'
  const id = `user_${encodeURIComponent(key)}`
  const all = users()
  const existing = all[id]
  const profile: Profile = existing
    ? { ...existing, full_name: cleanName || existing.full_name, phone: cleanPhone || existing.phone, language }
    : { id, full_name: cleanName || guestName, email: null, avatar_url: null, role: null, language, phone: cleanPhone || null }
  localProfile(profile)
  return profile
}

/** Shared backend mode: anonymous Supabase Auth identity; data is stored online and RLS is applied. */
export async function signInRemote(name: string, phone: string, language: Lang, guestName: string): Promise<Profile> {
  const sb = requireSupabase()
  const { data: sessionData, error: sessionError } = await sb.auth.getSession()
  if (sessionError) throw sessionError
  let session = sessionData.session
  if (!session) {
    const result = await sb.auth.signInAnonymously()
    if (result.error) throw result.error
    session = result.data.session
  }
  const user = session?.user
  if (!user) throw new Error('ERR_AUTH')
  const cleanName = name.trim().replace(/\s+/g, ' ').slice(0, 80) || guestName
  const cleanPhone = phone.trim().slice(0, 20) || null
  const { data, error } = await sb.from('profiles').upsert({
    id: user.id,
    full_name: cleanName,
    phone: cleanPhone,
    language,
    email: user.email ?? null,
    avatar_url: null,
  }, { onConflict: 'id' }).select('*').single()
  throwIfError(error)
  const profile = fromRow(data as Record<string, unknown>)
  localProfile(profile)
  return profile
}


function authPhone(phone: string): string {
  const cleaned = phone.trim().replace(/[\s()-]/g, '')
  if (cleaned.startsWith('+')) return cleaned
  const digits = cleaned.replace(/\D/g, '')
  if (digits.length === 10) return `+91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
  return `+${digits}`
}

export async function requestPhoneOtp(phone: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.auth.signInWithOtp({ phone: authPhone(phone), options: { shouldCreateUser: true } })
  throwIfError(error)
}

export async function verifyPhoneOtp(
  name: string, phone: string, token: string, language: Lang, guestName: string,
): Promise<Profile> {
  const sb = requireSupabase()
  const formattedPhone = authPhone(phone)
  const { data, error } = await sb.auth.verifyOtp({ phone: formattedPhone, token: token.trim(), type: 'sms' })
  throwIfError(error)
  if (!data.user) throw new Error('ERR_AUTH')
  const cleanName = name.trim().replace(/\s+/g, ' ').slice(0, 80) || guestName
  const { data: row, error: profileError } = await sb.from('profiles').upsert({
    id: data.user.id, full_name: cleanName, phone: formattedPhone, language,
    email: data.user.email ?? null, avatar_url: null,
  }, { onConflict: 'id' }).select('*').single()
  throwIfError(profileError)
  const profile = fromRow(row as Record<string, unknown>)
  localProfile(profile)
  return profile
}

export async function signOutDemo(): Promise<void> {
  if (supabaseEnabled) {
    const { error } = await requireSupabase().auth.signOut()
    throwIfError(error)
  }
  setSessionUser(null)
}

export async function saveRole(role: Role): Promise<void> {
  const user = requireUser()
  if (role !== 'farmer' && role !== 'owner') throw new Error('ERR_INVALID_ROLE')
  if (user.role && user.role !== role) throw new Error('ERR_ROLE_LOCKED')
  if (supabaseEnabled) {
    const { error } = await requireSupabase().from('profiles').update({ role }).eq('id', user.id)
    throwIfError(error)
  }
  const all = users()
  all[user.id] = { ...user, role }
  save(KEYS.users, all)
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'full_name' | 'phone' | 'language'>>,
): Promise<void> {
  const user = requireUser()
  if (user.id !== userId) throw new Error('ERR_FORBIDDEN')
  if (supabaseEnabled) {
    const sb = requireSupabase()
    const { error } = await sb.from('profiles').update(patch).eq('id', userId)
    throwIfError(error)
    if (patch.full_name) {
      const { error: machineError } = await sb.from('machines').update({ owner_name: patch.full_name }).eq('owner_id', userId).is('removed_at', null)
      throwIfError(machineError)
    }
  }
  const all = users()
  all[userId] = { ...user, ...patch }
  save(KEYS.users, all)
}

export async function saveLanguage(userId: string, language: Lang): Promise<void> {
  await updateProfile(userId, { language })
}
