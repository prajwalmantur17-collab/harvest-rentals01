import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchProfile, requestPhoneOtp, saveLanguage, saveRole, signInDemo, signInRemote, signOutDemo, updateProfile as apiUpdateProfile, verifyPhoneOtp } from '../api/profile'
import { translate, useI18n } from '../i18n'
import { DB_EVENT, currentUser, setSessionUser } from '../store/db'
import type { Lang, Profile, Role } from '../types'
import { logError } from '../utils/errors'
import { demoLoginEnabled, requireSupabase, supabaseEnabled } from '../lib/supabase'

interface AuthValue {
  session: { userId: string } | null
  profile: Profile | null
  loading: boolean
  /** Demo sign-in: any name (or none) is accepted. */
  signIn: (name: string, phone: string) => Promise<void>
  requestOtp: (phone: string) => Promise<void>
  verifyOtp: (name: string, phone: string, token: string) => Promise<void>
  signOut: () => Promise<void>
  chooseRole: (role: Role) => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (patch: Partial<Pick<Profile, 'full_name' | 'phone'>>) => Promise<void>
  /** Change language everywhere and remember it on the user's profile. */
  changeLanguage: (lang: Lang) => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { lang, setLang } = useI18n()
  const [profile, setProfile] = useState<Profile | null>(() => currentUser())
  const [loading, setLoading] = useState(supabaseEnabled)

  const sync = useCallback(() => setProfile(currentUser()), [])

  // Restore the saved language of a returning user once, and follow changes made in other tabs.
  useEffect(() => {
    const p = currentUser()
    if (p) setLang(p.language, false)
    window.addEventListener(DB_EVENT, sync)
    window.addEventListener('storage', sync)
    let alive = true
    if (supabaseEnabled) {
      void (async () => {
        try {
          const { data } = await requireSupabase().auth.getSession()
          if (data.session?.user && alive) {
            const remoteProfile = await fetchProfile(data.session.user.id)
            if (alive) {
              if (!remoteProfile) setSessionUser(null)
              else setLang(remoteProfile.language, false)
              setProfile(remoteProfile)
            }
          } else if (alive) {
            setSessionUser(null)
            setProfile(null)
          }
        } catch (err) {
          logError('restore backend session', err)
        } finally {
          if (alive) setLoading(false)
        }
      })()
    }
    return () => {
      alive = false
      window.removeEventListener(DB_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signIn = useCallback(
    async (name: string, phone: string) => {
      setLoading(true)
      try {
        if (supabaseEnabled && !demoLoginEnabled) throw new Error('Use phone OTP sign-in.')
        const p = supabaseEnabled
          ? await signInRemote(name, phone, lang, translate(lang, 'login.guest'))
          : signInDemo(name, phone, lang, translate(lang, 'login.guest'))
        setProfile(p)
      } finally {
        setLoading(false)
      }
    },
    [lang],
  )

  const requestOtp = useCallback(async (phone: string) => {
    if (!supabaseEnabled || demoLoginEnabled) throw new Error('Phone OTP is available in production sign-in mode only.')
    await requestPhoneOtp(phone)
  }, [])

  const verifyOtp = useCallback(async (name: string, phone: string, token: string) => {
    setLoading(true)
    try {
      const p = await verifyPhoneOtp(name, phone, token, lang, translate(lang, 'login.guest'))
      setProfile(p)
    } finally {
      setLoading(false)
    }
  }, [lang])

  const signOut = useCallback(async () => {
    await signOutDemo()
    setProfile(null)
  }, [])

  const chooseRole = useCallback(
    async (role: Role) => {
      await saveRole(role)
      sync()
    },
    [sync],
  )

  const updateProfile = useCallback(
    async (patch: Partial<Pick<Profile, 'full_name' | 'phone'>>) => {
      const p = currentUser()
      if (!p) throw new Error('ERR_AUTH')
      await apiUpdateProfile(p.id, patch)
      sync()
    },
    [sync],
  )

  const changeLanguage = useCallback(
    (next: Lang) => {
      setLang(next, true)
      const p = currentUser()
      if (p) {
        saveLanguage(p.id, next)
          .then(sync)
          .catch((err) => logError('saveLanguage', err))
      }
    },
    [setLang, sync],
  )

  const value = useMemo<AuthValue>(
    () => ({
      session: profile ? { userId: profile.id } : null,
      profile,
      loading,
      signIn,
      requestOtp,
      verifyOtp,
      signOut,
      chooseRole,
      refreshProfile: async () => sync(),
      updateProfile,
      changeLanguage,
    }),
    [profile, loading, signIn, requestOtp, verifyOtp, signOut, chooseRole, sync, updateProfile, changeLanguage],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
