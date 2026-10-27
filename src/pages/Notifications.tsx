import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { homeFor } from '../auth/guards'
import { AppLayout } from '../components/AppLayout'
import { BackButton, EmptyState, PageTitle, Spinner } from '../components/ui'
import { useI18n } from '../i18n'
import { useNotifications } from '../notifications/NotificationsContext'
import { formatDate } from '../utils/format'

export default function Notifications() {
  const { t, lang } = useI18n()
  const { profile } = useAuth()
  const { items, loading, markAllRead, describe } = useNotifications()
  const target = profile?.role === 'owner' ? '/owner/bookings' : '/farmer/bookings'
  const hasUnread = items.some((n) => !n.readAt)

  // Opening the page counts as reading. The unread highlight stays until the next visit's refresh.
  useEffect(() => {
    if (!hasUnread) return
    const id = window.setTimeout(() => void markAllRead(), 1500)
    return () => window.clearTimeout(id)
  }, [hasUnread, markAllRead])

  return (
    <AppLayout>
      <div className="space-y-5">
        <BackButton to={homeFor(profile?.role)} />
        <PageTitle>{t('notif.title')}</PageTitle>

        {loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState icon={<Bell className="h-8 w-8" aria-hidden />} title={t('notif.empty')} />
        ) : (
          <ul className="space-y-3">
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  to={target}
                  className={`block rounded-2xl border-2 p-4 text-lg ${
                    n.readAt ? 'border-line bg-white' : 'border-brand-700 bg-brand-50'
                  }`}
                >
                  <p className={n.readAt ? '' : 'font-semibold'}>{describe(n)}</p>
                  <p className="mt-1 text-base text-muted">{formatDate(n.createdAt, lang)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  )
}
