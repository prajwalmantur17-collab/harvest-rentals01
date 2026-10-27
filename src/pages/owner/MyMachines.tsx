import { useState } from 'react'
import { CalendarDays, Eye, Pause, Pencil, Play, Plus, Tractor, Trash2 } from 'lucide-react'
import { listMyMachines, removeMachine, setMachineStatus } from '../../api/machines'
import { useAuth } from '../../auth/AuthContext'
import { AppLayout } from '../../components/AppLayout'
import { MachineImage, Price, areaLabel, useMachineTitle } from '../../components/MachineParts'
import { useToast } from '../../components/Toast'
import { Alert, BackButton, Button, ButtonLink, Chip, EmptyState, ErrorState, PageTitle, Spinner, TextField } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n/en'
import type { OwnerMachine } from '../../types'
import { errorKey, logError } from '../../utils/errors'

function MachineRow({ machine, onChanged }: { machine: OwnerMachine; onChanged: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const title = useMachineTitle()
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<TranslationKey | null>(null)
  const active = machine.status === 'active'

  async function toggle() {
    setBusy(true)
    try {
      await setMachineStatus(machine.id, active ? 'paused' : 'active')
      toast.success(active ? t('owner.paused') : t('owner.reactivated'))
      onChanged()
    } catch (err) {
      logError('setMachineStatus', err)
      toast.error(t(errorKey(err)))
    } finally {
      setBusy(false)
    }
  }

  async function confirmRemove() {
    setPinError(null)
    if (!/^\d{4}$/.test(pin)) {
      setPinError('v.pin')
      return
    }
    setBusy(true)
    try {
      await removeMachine(machine.id, pin)
      toast.success(t('owner.removed'))
      onChanged()
    } catch (err) {
      logError('removeMachine', err)
      setPinError(errorKey(err))
      setBusy(false)
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <MachineImage path={machine.photoPath} className="h-44 w-full" />
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-xl font-bold text-brand-900">{title(machine.machineType, machine.modelName)}</h2>
          <Chip tone={active ? 'green' : 'wheat'}>{active ? t('owner.statusActive') : t('owner.statusPaused')}</Chip>
        </div>
        <Price amount={machine.pricePerAcre} />
        {machine.areas[0] && <p className="text-lg text-muted">{areaLabel(machine.areas[0])}</p>}

        <div className="grid gap-2 sm:grid-cols-2">
          <ButtonLink to={`/owner/machines/${machine.id}/edit`} variant="secondary" full>
            <Pencil className="h-5 w-5" aria-hidden />
            {t('common.edit')}
          </ButtonLink>
          <ButtonLink to={`/owner/machines/${machine.id}/availability`} variant="secondary" full>
            <CalendarDays className="h-5 w-5" aria-hidden />
            {t('owner.availability')}
          </ButtonLink>
          <Button variant={active ? 'danger' : 'primary'} full onClick={toggle} loading={busy && !removing}>
            {active ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5" aria-hidden />}
            {active ? t('owner.pause') : t('owner.reactivate')}
          </Button>
          <ButtonLink to={`/machine/${machine.id}`} variant="ghost" full>
            <Eye className="h-5 w-5" aria-hidden />
            {t('owner.viewAsFarmer')}
          </ButtonLink>
        </div>

        {removing ? (
          <div className="space-y-3 rounded-xl border-2 border-red-300 bg-red-50 p-3">
            <p className="text-lg font-semibold text-red-900">{t('owner.removeAsk')}</p>
            <TextField
              id={`pin-${machine.id}`}
              label={t('owner.removePin')}
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder={t('form.pinExample')}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              error={pinError ? t(pinError) : undefined}
            />
            {pinError === 'err.generic' && <Alert>{t(pinError)}</Alert>}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="danger" onClick={confirmRemove} loading={busy}>
                <Trash2 className="h-5 w-5" aria-hidden />
                {t('owner.removeYes')}
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setRemoving(false)
                  setPin('')
                  setPinError(null)
                }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" full onClick={() => setRemoving(true)}>
            <Trash2 className="h-5 w-5" aria-hidden />
            {t('owner.remove')}
          </Button>
        )}
      </div>
    </article>
  )
}

export default function MyMachines() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const ownerId = profile?.id ?? ''
  const machines = useAsync(() => listMyMachines(ownerId), [ownerId], Boolean(ownerId))

  return (
    <AppLayout>
      <div className="space-y-5">
        <BackButton to="/owner" />
        <PageTitle sub={machines.data ? `${t('owner.listedLabel')}: ${machines.data.length}` : undefined}>
          {t('owner.machines')}
        </PageTitle>

        {machines.loading ? (
          <Spinner />
        ) : machines.error ? (
          <ErrorState messageKey={machines.error} onRetry={machines.reload} />
        ) : machines.data && machines.data.length > 0 ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {machines.data.map((m) => (
                <MachineRow key={m.id} machine={m} onChanged={() => void machines.reload()} />
              ))}
            </div>
            <ButtonLink to="/owner/machines/new" size="lg" full>
              <Plus className="h-6 w-6" aria-hidden />
              {t('owner.add')}
            </ButtonLink>
          </>
        ) : (
          <EmptyState
            icon={<Tractor className="h-8 w-8" aria-hidden />}
            title={t('owner.noMachines.title')}
            text={t('owner.noMachines.text')}
            action={
              <ButtonLink to="/owner/machines/new" full>
                <Plus className="h-5 w-5" aria-hidden />
                {t('owner.add')}
              </ButtonLink>
            }
          />
        )}
      </div>
    </AppLayout>
  )
}
