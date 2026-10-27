import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarX, Pause, Play, SearchX, X } from 'lucide-react'
import { blockDate, getBusyDates, getMyMachine, listBlockedDates, setMachineStatus, unblockDate } from '../../api/machines'
import { useAuth } from '../../auth/AuthContext'
import { AppLayout } from '../../components/AppLayout'
import { useMachineTitle } from '../../components/MachineParts'
import { useToast } from '../../components/Toast'
import {
  Alert,
  BackButton,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  PageTitle,
  Spinner,
  TextField,
} from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n/en'
import { errorKey, logError } from '../../utils/errors'
import { formatDate, todayIST } from '../../utils/format'

export default function Availability() {
  const { id = '' } = useParams()
  const { t, lang } = useI18n()
  const { profile } = useAuth()
  const ownerId = profile?.id ?? ''
  const toast = useToast()
  const title = useMachineTitle()
  const today = todayIST()

  const machine = useAsync(() => getMyMachine(ownerId, id), [id, ownerId], Boolean(ownerId))
  const blocked = useAsync(() => listBlockedDates(id), [id], Boolean(id))
  const busy = useAsync(() => getBusyDates(id), [id], Boolean(id))

  const [date, setDate] = useState('')
  const [dateError, setDateError] = useState<TranslationKey | null>(null)
  const [working, setWorking] = useState(false)

  const refresh = () => {
    void blocked.reload()
    void busy.reload()
  }

  async function add() {
    setDateError(null)
    if (!date || date < today) {
      setDateError('v.date')
      return
    }
    setWorking(true)
    try {
      await blockDate(id, date)
      toast.success(t('avail.blockedOk'))
      setDate('')
      refresh()
    } catch (err) {
      logError('blockDate', err)
      const key = errorKey(err)
      // A duplicate means the day is already blocked; that is not an error from the owner's point of view.
      if (key === 'err.duplicate') {
        setDate('')
        refresh()
      } else setDateError(key)
    } finally {
      setWorking(false)
    }
  }

  async function open(d: string) {
    try {
      await unblockDate(id, d)
      toast.success(t('avail.openedOk'))
      refresh()
    } catch (err) {
      logError('unblockDate', err)
      toast.error(t(errorKey(err)))
    }
  }

  async function toggleStatus() {
    if (!machine.data) return
    const active = machine.data.status === 'active'
    try {
      await setMachineStatus(id, active ? 'paused' : 'active')
      toast.success(active ? t('owner.paused') : t('owner.reactivated'))
      void machine.reload()
    } catch (err) {
      logError('setMachineStatus', err)
      toast.error(t(errorKey(err)))
    }
  }

  if (machine.loading) {
    return (
      <AppLayout>
        <Spinner />
      </AppLayout>
    )
  }
  if (machine.error) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <BackButton to="/owner/machines" />
          <ErrorState messageKey={machine.error} onRetry={machine.reload} />
        </div>
      </AppLayout>
    )
  }
  if (!machine.data) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <BackButton to="/owner/machines" />
          <EmptyState icon={<SearchX className="h-8 w-8" aria-hidden />} title={t('machine.notFound')} />
        </div>
      </AppLayout>
    )
  }

  const m = machine.data
  const active = m.status === 'active'
  const booked = (busy.data ?? []).filter((b) => b.reason === 'booked')

  return (
    <AppLayout>
      <div className="space-y-5">
        <BackButton to="/owner/machines" />
        <PageTitle sub={title(m.machineType, m.modelName)}>{t('avail.title')}</PageTitle>

        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Chip tone={active ? 'green' : 'wheat'}>{active ? t('owner.statusActive') : t('owner.statusPaused')}</Chip>
            <Button variant={active ? 'danger' : 'primary'} onClick={toggleStatus}>
              {active ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5" aria-hidden />}
              {active ? t('owner.pause') : t('owner.reactivate')}
            </Button>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-xl font-bold">{t('avail.blockTitle')}</h2>
          <TextField
            id="block-date"
            type="date"
            label={t('book.date')}
            help={t('avail.blockHelp')}
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={dateError ? t(dateError) : undefined}
          />
          <Button full onClick={add} loading={working}>
            <CalendarX className="h-5 w-5" aria-hidden />
            {t('avail.block')}
          </Button>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-xl font-bold">{t('avail.blocked')}</h2>
          {blocked.loading ? (
            <Spinner />
          ) : blocked.error ? (
            <Alert>{t(blocked.error)}</Alert>
          ) : blocked.data && blocked.data.length > 0 ? (
            <ul className="space-y-2">
              {blocked.data.map((d) => (
                <li key={d} className="flex items-center justify-between gap-3 rounded-xl bg-cream-100 px-4 py-2">
                  <span className="text-lg font-semibold">{formatDate(d, lang)}</span>
                  <Button variant="ghost" onClick={() => void open(d)} aria-label={`${t('common.remove')} ${formatDate(d, lang)}`}>
                    <X className="h-5 w-5" aria-hidden />
                    {t('common.remove')}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-lg text-muted">{t('avail.noneBlocked')}</p>
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="text-xl font-bold">{t('avail.booked')}</h2>
          {busy.loading ? (
            <Spinner />
          ) : booked.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {booked.map((b) => (
                <li key={b.date}>
                  <Chip>{formatDate(b.date, lang)}</Chip>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-lg text-muted">{t('avail.noneBooked')}</p>
          )}
        </Card>
      </div>
    </AppLayout>
  )
}
