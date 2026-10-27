import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, ImageOff, MapPin, Phone, MessageCircle, Navigation, Tractor, UserRound } from 'lucide-react'
import { photoUrl } from '../api/machines'
import { useI18n } from '../i18n'
import type { MachineListing, MachineType, ServiceArea } from '../types'
import { formatInr, formatNumber } from '../utils/format'
import { toTelHref, toWhatsAppHref } from '../utils/phone'
import { ButtonLink, Chip, ExternalButtonLink } from './ui'

export function useMachineTitle() {
  const { t } = useI18n()
  return (type: MachineType | null | undefined, model: string | null | undefined) => {
    const typeLabel = type ? t(`type.${type}`) : t('machine.unnamed')
    return model?.trim() ? `${typeLabel} – ${model.trim()}` : typeLabel
  }
}

/** Real owner photo when there is one, a neutral placeholder otherwise. Never a fake photograph. */
export function MachineImage({ path, className = '' }: { path: string | null; className?: string }) {
  const { t } = useI18n()
  const [failed, setFailed] = useState(false)
  const url = photoUrl(path)
  if (!url || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-cream-100 text-muted ${className}`}
        role="img"
        aria-label={t('machine.noPhoto')}
      >
        {url ? <ImageOff className="h-10 w-10" aria-hidden /> : <Tractor className="h-12 w-12" aria-hidden />}
        <span className="text-base">{t('machine.noPhoto')}</span>
      </div>
    )
  }
  return <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />
}

export function areaLabel(a: ServiceArea): string {
  return `${a.village}, ${a.district}`
}

export function Price({ amount, large }: { amount: number; large?: boolean }) {
  const { t, lang } = useI18n()
  return (
    <p className="flex items-baseline gap-1.5">
      <span className={`${large ? 'text-4xl' : 'text-3xl'} font-extrabold text-brand-900`}>{formatInr(amount, lang)}</span>
      <span className="text-lg font-medium text-muted">{t('machine.perAcre')}</span>
    </p>
  )
}

export function MachineCard({ machine, canBook }: { machine: MachineListing; canBook: boolean }) {
  const { t, lang } = useI18n()
  const title = useMachineTitle()
  const firstAreas = machine.areas.slice(0, 2)
  const more = machine.areas.length - firstAreas.length

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <Link to={`/machine/${machine.id}`} aria-label={`${t('machine.details')}: ${title(machine.machineType, machine.modelName)}`}>
        <MachineImage path={machine.photoPath} className="h-52 w-full sm:h-56" />
      </Link>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-xl font-bold leading-snug text-brand-900">{title(machine.machineType, machine.modelName)}</h3>
          <p className="mt-1 flex items-center gap-2 text-lg text-muted">
            <UserRound className="h-5 w-5 shrink-0" aria-hidden />
            {machine.ownerName || t('machine.owner')}
          </p>
        </div>

        <Price amount={machine.pricePerAcre} />

        <div className="space-y-1 text-lg">
          {firstAreas.map((a) => (
            <p key={`${a.village}-${a.district}`} className="flex items-start gap-2">
              <MapPin className="mt-1 h-5 w-5 shrink-0 text-brand-700" aria-hidden />
              <span>{areaLabel(a)}</span>
            </p>
          ))}
          {more > 0 && <p className="pl-7 text-base text-muted">+{more}</p>}
          {machine.distanceKm != null && (
            <p className="flex items-center gap-2 text-brand-800">
              <Navigation className="h-5 w-5 shrink-0" aria-hidden />
              {t('machine.away', { km: formatNumber(machine.distanceKm, lang) })}
            </p>
          )}
        </div>

        {machine.crops.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {machine.crops.slice(0, 5).map((c) => (
              <Chip key={c}>{t(`crop.${c}`)}</Chip>
            ))}
            {machine.crops.length > 5 && <Chip tone="gray">+{machine.crops.length - 5}</Chip>}
          </div>
        )}

        <p className="flex items-center gap-2 text-lg font-medium text-brand-800">
          <CalendarCheck className="h-5 w-5" aria-hidden />
          {machine.status === 'active' ? t('machine.available') : t('machine.paused')}
        </p>

        <div className={`grid gap-2 ${canBook ? 'sm:grid-cols-2' : ''}`}>
          <ButtonLink to={`/machine/${machine.id}`} variant="secondary" full>
            {t('machine.details')}
          </ButtonLink>
          {canBook && machine.status === 'active' && (
            <ButtonLink to={`/machine/${machine.id}#book`} full>
              {t('machine.book')}
            </ButtonLink>
          )}
        </div>
      </div>
    </article>
  )
}

export function ContactButtons({
  phone,
  callLabel,
  whatsappLabel,
  whatsappText,
}: {
  phone: string
  callLabel: string
  whatsappLabel: string
  whatsappText?: string
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <ExternalButtonLink href={toTelHref(phone)} variant="primary" full>
        <Phone className="h-5 w-5" aria-hidden />
        {callLabel}
      </ExternalButtonLink>
      <ExternalButtonLink
        href={toWhatsAppHref(phone, whatsappText)}
        target="_blank"
        rel="noopener noreferrer"
        variant="whatsapp"
        full
      >
        <MessageCircle className="h-5 w-5" aria-hidden />
        {whatsappLabel}
      </ExternalButtonLink>
    </div>
  )
}
