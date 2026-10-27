import { Link } from 'react-router-dom'
import { ClipboardList, Plus, Tractor } from 'lucide-react'
import type { ReactNode } from 'react'
import { listOwnerBookings } from '../../api/bookings'
import { listMyMachines } from '../../api/machines'
import { useAuth } from '../../auth/AuthContext'
import { AppLayout } from '../../components/AppLayout'
import { PageTitle } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { useI18n } from '../../i18n'

function Tile({
  to,
  icon,
  title,
  text,
  badge,
  primary,
}: {
  to: string
  icon: ReactNode
  title: string
  text?: string
  badge?: string
  primary?: boolean
}) {
  return (
    <Link
      to={to}
      className={`flex min-h-32 items-center gap-4 rounded-2xl border-2 p-5 shadow-sm transition-colors ${
        primary
          ? 'border-brand-800 bg-brand-800 text-white hover:bg-brand-900'
          : 'border-line bg-white text-brand-900 hover:border-brand-700'
      }`}
    >
      <span
        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${
          primary ? 'bg-white/15 text-white' : 'bg-brand-100 text-brand-800'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xl font-bold leading-tight">{title}</span>
        {text && <span className={`mt-1 block text-lg ${primary ? 'text-white/90' : 'text-muted'}`}>{text}</span>}
      </span>
      {badge && <span className="shrink-0 rounded-full bg-wheat-500 px-3 py-1.5 text-lg font-bold text-ink">{badge}</span>}
    </Link>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border-2 border-brand-700 bg-white p-4 text-center shadow-sm">
      <p className="text-5xl font-extrabold text-brand-900" data-testid="stat-value">
        {value}
      </p>
      <p className="mt-1 text-lg font-semibold text-muted">{label}</p>
    </div>
  )
}

export default function OwnerHome() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const ownerId = profile?.id ?? ''
  const machines = useAsync(() => listMyMachines(ownerId), [ownerId], Boolean(ownerId))
  const bookings = useAsync(() => listOwnerBookings(), [ownerId], Boolean(ownerId))
  useRealtimeRefresh('bookings', () => {
    void bookings.reload()
    void machines.reload()
  }, Boolean(ownerId))

  const all = bookings.data ?? []
  const waiting = all.filter((b) => b.status === 'pending').length
  const confirmed = all.filter((b) => b.status === 'confirmed').length

  return (
    <AppLayout>
      <div className="space-y-5">
        <PageTitle>{t('owner.title')}</PageTitle>

        <div className="grid grid-cols-2 gap-3">
          <Stat value={machines.data?.length ?? 0} label={t('owner.listedLabel')} />
          <Stat value={confirmed} label={t('owner.confirmedLabel')} />
        </div>

        <div className="grid gap-4">
          <Tile
            primary
            to="/owner/machines/new"
            icon={<Plus className="h-9 w-9" aria-hidden />}
            title={t('owner.add')}
            text={t('owner.addHelp')}
          />
          <Tile to="/owner/machines" icon={<Tractor className="h-9 w-9" aria-hidden />} title={t('owner.machines')} />
          <Tile
            to="/owner/bookings"
            icon={<ClipboardList className="h-9 w-9" aria-hidden />}
            title={t('owner.requests')}
            badge={waiting > 0 ? t('owner.waiting', { count: waiting }) : undefined}
          />
        </div>
      </div>
    </AppLayout>
  )
}
