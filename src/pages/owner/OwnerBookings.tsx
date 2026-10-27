import { useState } from 'react'
import { Check, ClipboardList, Phone, X, MessageCircle, UserRound } from 'lucide-react'
import { listOwnerBookings, respondToBooking } from '../../api/bookings'
import { AppLayout } from '../../components/AppLayout'
import { BookingCard } from '../../components/BookingCard'
import { useMachineTitle } from '../../components/MachineParts'
import { useToast } from '../../components/Toast'
import {
  Alert,
  BackButton,
  Button,
  EmptyState,
  ErrorState,
  ExternalButtonLink,
  PageTitle,
  Spinner,
} from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { useI18n } from '../../i18n'
import type { Booking } from '../../types'
import { errorKey, logError } from '../../utils/errors'
import { toTelHref, toWhatsAppHref } from '../../utils/phone'

function FarmerHeading({ booking }: { booking: Booking }) {
  const { t } = useI18n()
  const title = useMachineTitle()
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-2 text-xl font-bold text-brand-900">
        <UserRound className="h-6 w-6" aria-hidden />
        <span className="sr-only">{t('requests.farmer')}: </span>
        {booking.farmerName || t('notif.aFarmer')}
      </p>
      <p className="text-lg text-muted">{title(booking.machineType, booking.modelName)}</p>
    </div>
  )
}

function Actions({ booking, onChanged }: { booking: Booking; onChanged: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null)
  const [error, setError] = useState<ReturnType<typeof errorKey> | null>(null)

  async function respond(action: 'accept' | 'reject') {
    setBusy(action)
    setError(null)
    try {
      await respondToBooking(booking.id, action)
      toast.success(action === 'accept' ? t('requests.accepted') : t('requests.rejected'))
      onChanged()
    } catch (err) {
      logError('respondToBooking', err)
      // e.g. the date was just confirmed for someone else: tell the owner clearly and show the latest status.
      setError(errorKey(err))
      onChanged()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      {booking.farmerPhone && booking.status !== 'cancelled' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <ExternalButtonLink href={toTelHref(booking.farmerPhone)} variant="secondary" full>
            <Phone className="h-5 w-5" aria-hidden />
            {t('requests.callFarmer')}
          </ExternalButtonLink>
          <ExternalButtonLink
            href={toWhatsAppHref(booking.farmerPhone)}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            full
          >
            <MessageCircle className="h-5 w-5" aria-hidden />
            {t('requests.whatsappFarmer')}
          </ExternalButtonLink>
        </div>
      )}

      {error && <Alert>{t(error)}</Alert>}

      {booking.status === 'pending' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button full onClick={() => respond('accept')} loading={busy === 'accept'} disabled={busy !== null}>
            <Check className="h-5 w-5" aria-hidden />
            {t('requests.accept')}
          </Button>
          <Button variant="danger" full onClick={() => respond('reject')} loading={busy === 'reject'} disabled={busy !== null}>
            <X className="h-5 w-5" aria-hidden />
            {t('requests.reject')}
          </Button>
        </div>
      )}
    </div>
  )
}

export default function OwnerBookings() {
  const { t } = useI18n()
  const bookings = useAsync(() => listOwnerBookings(), [])
  // New requests appear without refreshing the page.
  useRealtimeRefresh('bookings', () => void bookings.reload())

  const all = bookings.data ?? []
  const waiting = all.filter((b) => b.status === 'pending').sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
  const earlier = all.filter((b) => b.status !== 'pending')

  const renderCard = (b: Booking) => (
    <BookingCard key={b.id} booking={b} heading={<FarmerHeading booking={b} />}>
      <Actions booking={b} onChanged={() => void bookings.reload()} />
    </BookingCard>
  )

  return (
    <AppLayout>
      <div className="space-y-5">
        <BackButton to="/owner" />
        <PageTitle>{t('requests.title')}</PageTitle>

        {bookings.loading ? (
          <Spinner />
        ) : bookings.error ? (
          <ErrorState messageKey={bookings.error} onRetry={bookings.reload} />
        ) : all.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-8 w-8" aria-hidden />}
            title={t('requests.empty.title')}
            text={t('requests.empty.text')}
          />
        ) : (
          <>
            {waiting.length > 0 && (
              <section className="space-y-3" aria-labelledby="waiting-title">
                <h2 id="waiting-title" className="text-2xl font-bold text-brand-900">
                  {t('requests.waiting')}
                </h2>
                {waiting.map(renderCard)}
              </section>
            )}
            {earlier.length > 0 && (
              <section className="space-y-3" aria-labelledby="earlier-title">
                <h2 id="earlier-title" className="text-2xl font-bold text-brand-900">
                  {t('requests.earlier')}
                </h2>
                {earlier.map(renderCard)}
              </section>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}
