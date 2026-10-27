import { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { cancelBooking, listFarmerBookings } from '../../api/bookings'
import { getMachinePhone } from '../../api/machines'
import { useAuth } from '../../auth/AuthContext'
import { AppLayout } from '../../components/AppLayout'
import { BookingCard } from '../../components/BookingCard'
import { ContactButtons } from '../../components/MachineParts'
import { useToast } from '../../components/Toast'
import { Alert, BackButton, Button, ButtonLink, EmptyState, ErrorState, PageTitle, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { useI18n } from '../../i18n'
import type { Booking } from '../../types'
import { errorKey, logError } from '../../utils/errors'

function OwnerContact({ machineId }: { machineId: string }) {
  const { t } = useI18n()
  const phone = useAsync(() => getMachinePhone(machineId), [machineId])
  if (!phone.data) return null
  return (
    <ContactButtons
      phone={phone.data}
      callLabel={t('machine.call')}
      whatsappLabel={t('machine.whatsapp')}
      whatsappText={t('machine.whatsappText')}
    />
  )
}

function BookingActions({ booking, onChanged }: { booking: Booking; onChanged: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ReturnType<typeof errorKey> | null>(null)

  async function doCancel() {
    setBusy(true)
    setError(null)
    try {
      await cancelBooking(booking.id)
      toast.success(t('bookings.cancelled'))
      setAsking(false)
      onChanged()
    } catch (err) {
      logError('cancelBooking', err)
      setError(errorKey(err))
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {booking.status === 'pending' && <p className="text-lg text-muted">{t('bookings.pendingHint')}</p>}
      {booking.status === 'confirmed' && (
        <>
          <Alert kind="success">{t('bookings.confirmedHint')}</Alert>
          <OwnerContact machineId={booking.machineId} />
        </>
      )}
      {booking.status === 'rejected' && <p className="text-lg text-muted">{t('bookings.rejectedHint')}</p>}

      {error && <Alert>{t(error)}</Alert>}

      {(booking.status === 'pending' || booking.status === 'confirmed') &&
        (asking ? (
          <div className="space-y-2 rounded-xl border-2 border-red-300 bg-red-50 p-3">
            <p className="text-lg font-semibold text-red-900">{t('bookings.cancelAsk')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="danger" onClick={doCancel} loading={busy}>
                {t('bookings.cancelYes')}
              </Button>
              <Button variant="secondary" onClick={() => setAsking(false)} disabled={busy}>
                {t('bookings.cancelNo')}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" full onClick={() => setAsking(true)}>
            {t('bookings.cancel')}
          </Button>
        ))}
    </div>
  )
}

export default function MyBookings() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const userId = profile?.id ?? ''
  const bookings = useAsync(() => listFarmerBookings(userId), [userId], Boolean(userId))

  // The owner's reply appears here by itself, without refreshing the page.
  useRealtimeRefresh('bookings', () => void bookings.reload(), Boolean(userId))

  return (
    <AppLayout>
      <div className="space-y-5">
        <BackButton to="/farmer" />
        <PageTitle>{t('bookings.title')}</PageTitle>

        {bookings.loading ? (
          <Spinner />
        ) : bookings.error ? (
          <ErrorState messageKey={bookings.error} onRetry={bookings.reload} />
        ) : bookings.data && bookings.data.length > 0 ? (
          <div className="space-y-4">
            {bookings.data.map((b) => (
              <BookingCard key={b.id} booking={b}>
                <BookingActions booking={b} onChanged={() => void bookings.reload()} />
              </BookingCard>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<ClipboardList className="h-8 w-8" aria-hidden />}
            title={t('bookings.empty.title')}
            text={t('bookings.empty.text')}
            action={
              <ButtonLink to="/farmer" full>
                {t('bookings.find')}
              </ButtonLink>
            }
          />
        )}
      </div>
    </AppLayout>
  )
}
