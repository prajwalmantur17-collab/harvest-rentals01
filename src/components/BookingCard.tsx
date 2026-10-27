import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, MapPin, Ruler, Sprout } from 'lucide-react'
import { useI18n } from '../i18n'
import type { Booking } from '../types'
import { formatDate, formatInr } from '../utils/format'
import { useMachineTitle } from './MachineParts'
import { Card, StatusBadge } from './ui'

/** Shared by the farmer's "My Bookings" and the owner's "Booking Requests". */
export function BookingCard({ booking, heading, children }: { booking: Booking; heading?: ReactNode; children?: ReactNode }) {
  const { t, lang } = useI18n()
  const title = useMachineTitle()
  const total = booking.acreage * booking.pricePerAcre

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {heading ?? (
            <Link to={`/machine/${booking.machineId}`} className="text-xl font-bold text-brand-900 underline-offset-2 hover:underline">
              {title(booking.machineType, booking.modelName)}
            </Link>
          )}
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <dl className="grid gap-2 text-lg sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 shrink-0 text-brand-700" aria-hidden />
          <dt className="sr-only">{t('bookings.date')}</dt>
          <dd className="font-semibold">{formatDate(booking.serviceDate, lang)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 shrink-0 text-brand-700" aria-hidden />
          <dt className="sr-only">{t('bookings.village')}</dt>
          <dd>{booking.fieldVillage}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Ruler className="h-5 w-5 shrink-0 text-brand-700" aria-hidden />
          <dt className="sr-only">{t('book.acreage')}</dt>
          <dd>{t('bookings.acres', { n: booking.acreage })}</dd>
        </div>
        {booking.crop && (
          <div className="flex items-center gap-2">
            <Sprout className="h-5 w-5 shrink-0 text-brand-700" aria-hidden />
            <dt className="sr-only">{t('book.crop')}</dt>
            <dd>{t(`crop.${booking.crop}`)}</dd>
          </div>
        )}
      </dl>

      <p className="text-lg">
        <span className="text-muted">{t('book.estimate')}: </span>
        <strong className="text-xl text-brand-900">{formatInr(total, lang)}</strong>
      </p>

      {booking.notes && (
        <p className="rounded-xl bg-cream-100 p-3 text-lg">
          <span className="font-semibold">{t('requests.message')}: </span>
          {booking.notes}
        </p>
      )}

      {children}
    </Card>
  )
}
