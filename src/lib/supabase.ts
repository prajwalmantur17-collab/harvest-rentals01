import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabaseEnabled = Boolean(url && anonKey && !url.includes('your-project'))
export const demoLoginEnabled = !supabaseEnabled || import.meta.env.VITE_DEMO_LOGIN === 'true'
export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('ERR_SUPABASE_NOT_CONFIGURED')
  return supabase
}

export function throwIfError(error: { message: string; code?: string } | null): void {
  if (!error) return
  const e = new Error(error.message) as Error & { code?: string }
  e.code = error.code
  throw e
}
