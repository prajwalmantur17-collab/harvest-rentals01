import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { listNotifications, markAllNotificationsRead } from '../api/bookings'
import { useAuth } from '../auth/AuthContext'
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'
import { useI18n } from '../i18n'
import { useToast } from '../components/Toast'
import { logError } from '../utils/errors'
import { formatDate } from '../utils/format'
import type { AppNotification } from '../types'

interface NotificationsValue {
  items: AppNotification[]
  unread: number
  loading: boolean
  refresh: () => Promise<void>
  markAllRead: () => Promise<void>
  /** Human-readable, translated sentence for one notification. */
  describe: (n: AppNotification) => string
}

const Ctx = createContext<NotificationsValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const { t, lang } = useI18n()
  const toast = useToast()
  const userId = profile?.role ? profile.id : null

  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const known = useRef<Set<string> | null>(null)

  const describe = useCallback(
    (n: AppNotification) => {
      const machine = n.data.machine_type
        ? [t(`type.${n.data.machine_type}`), n.data.model_name].filter(Boolean).join(' ')
        : t('machine.unnamed')
      return t(`notif.${n.type}`, {
        machine,
        date: n.data.service_date ? formatDate(n.data.service_date, lang) : '',
        farmer: n.data.farmer_name?.trim() || t('notif.aFarmer'),
      })
    },
    [t, lang],
  )

  const refresh = useCallback(async () => {
    if (!userId) return
    try {
      const list = await listNotifications(userId)
      // Show a small message for notifications that arrived while the app was open (not on first load).
      if (known.current) {
        for (const n of list) {
          if (!known.current.has(n.id) && !n.readAt) toast.info(describe(n))
        }
      }
      known.current = new Set(list.map((n) => n.id))
      setItems(list)
    } catch (err) {
      // A notification problem must never block the app. Log it and keep the old list.
      logError('listNotifications', err)
    }
  }, [userId, toast, describe])

  useEffect(() => {
    known.current = null
    setItems([])
    if (!userId) return
    setLoading(true)
    refresh().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useRealtimeRefresh('notifications', () => void refresh(), Boolean(userId))

  const markAllRead = useCallback(async () => {
    if (!userId) return
    try {
      await markAllNotificationsRead(userId)
      const now = new Date().toISOString()
      setItems((list) => list.map((n) => (n.readAt ? n : { ...n, readAt: now })))
    } catch (err) {
      logError('markAllNotificationsRead', err)
    }
  }, [userId])

  const value = useMemo<NotificationsValue>(
    () => ({
      items,
      unread: items.filter((n) => !n.readAt).length,
      loading,
      refresh,
      markAllRead,
      describe,
    }),
    [items, loading, refresh, markAllRead, describe],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useNotifications(): NotificationsValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>')
  return ctx
}
