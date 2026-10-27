import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CalendarX, MapPin, SearchX, UserRound } from 'lucide-react'
import { createBooking } from '../api/bookings'
import { getBusyDates, getMachine, getMachinePhone } from '../api/machines'
import { useAuth } from '../auth/AuthContext'
import { AppLayout } from '../components/AppLayout'
import { ContactButtons, MachineImage, Price, areaLabel, useMachineTitle } from '../components/MachineParts'
import { useToast } from '../components/Toast'
import {
  Alert,
  BackButton,
  Button,
  ButtonLink,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  SelectField,
  Spinner,
  TextAreaField,
  TextField,
} from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { useI18n } from '../i18n'
import { karnatakaVillages } from '../data/karnatakaLocations'
import type { TranslationKey } from '../i18n/en'
import { errorKey, logError } from '../utils/errors'
import { uid } from '../utils/id'
import { formatDate, formatInr, todayIST } from '../utils/format'
import { validateBooking, hasErrors, type BookingField } from '../validation'

export default function MachineDetail() {
  const { id = '' } = useParams()
  const { t, lang } = useI18n()
  const { profile } = useAuth()
  const [search] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const title = useMachineTitle()
  const bookRef = useRef<HTMLElement>(null)

  const isFarmer = profile?.role === 'farmer'
  const machine = useAsync(() => getMachine(id), [id])
  const busy = useAsync(() => getBusyDates(id), [id], Boolean(id))
  const phone = useAsync(() => getMachinePhone(id), [id], Boolean(machine.data))

  // "Book Machine" buttons link to #book: scroll to the form once the machine has loaded.
  useEffect(() => {
    if (machine.data && location.hash === '#book') {
      bookRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [machine.data, location.hash])

  // --- booking form -------------------------------------------------------
  const today = todayIST()
  const [form, setForm] = useState({
    date: '',
    fieldVillage: search.get('village') ?? '',
    acreage: '',
    crop: '',
    phone: profile?.phone ?? '',
    notes: '',
  })
  const [errors, setErrors] = useState<Partial<Record<BookingField, TranslationKey>>>({})
  const [submitError, setSubmitError] = useState<TranslationKey | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // One id per form: a double tap or retry returns the same booking instead of creating a second one.
  const requestId = useRef(uid())

  useEffect(() => {
    if (profile?.phone) setForm((f) => (f.phone ? f : { ...f, phone: profile.phone ?? '' }))
  }, [profile?.phone])

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

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
          <BackButton />
          <ErrorState messageKey={machine.error} onRetry={machine.reload} />
        </div>
      </AppLayout>
    )
  }
  const m = machine.data
  if (!m) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <BackButton />
          <EmptyState icon={<SearchX className="h-8 w-8" aria-hidden />} title={t('machine.notFound')} />
        </div>
      </AppLayout>
    )
  }

  const isOwnMachine = profile?.id === m.ownerId
  const busyDates = busy.data ?? []
  const estimate = Number(form.acreage) > 0 ? Number(form.acreage) * m.pricePerAcre : null
  const dateIsBusy = busyDates.find((b) => b.date === form.date)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (submitting || !m) return
    setSubmitError(null)

    const found = validateBooking(form, today, m.crops.length > 0)
    setErrors(found)
    if (hasErrors(found)) {
      document.getElementById('book-form')?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    if (dateIsBusy) {
      setErrors({ date: dateIsBusy.reason === 'booked' ? 'err.dateTaken' : 'err.dateBlocked' })
      return
    }

    setSubmitting(true)
    try {
      await createBooking({
        machineId: m.id,
        serviceDate: form.date,
        fieldVillage: form.fieldVillage,
        acreage: Number(form.acreage),
        crop: form.crop,
        phone: form.phone,
        notes: form.notes,
        requestId: requestId.current,
      })
      toast.success(t('book.success'))
      navigate('/farmer/bookings', { replace: true })
    } catch (err) {
      logError('createBooking', err)
      const key = errorKey(err)
      setSubmitError(key)
      // The date list may be out of date (someone else just got confirmed): refresh it.
      if (key === 'err.dateTaken' || key === 'err.dateBlocked') void busy.reload()
      // A failed attempt may be retried with the same request id safely; only a new form needs a new one.
      setSubmitting(false)
    }
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <BackButton />

        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <MachineImage path={m.photoPath} className="h-60 w-full sm:h-80" />
          <div className="space-y-3 p-4 md:p-5">
            <h1 className="text-3xl font-bold leading-tight text-brand-900">{title(m.machineType, m.modelName)}</h1>
            <Price amount={m.pricePerAcre} large />
            <p className="flex items-center gap-2 text-lg">
              <UserRound className="h-5 w-5 text-muted" aria-hidden />
              <span className="text-muted">{t('machine.owner')}:</span>
              <strong>{m.ownerName || '—'}</strong>
            </p>
            <p className="text-lg font-semibold text-brand-800">
              {m.status === 'active' ? t('machine.available') : t('machine.paused')}
            </p>
          </div>
        </div>

        {m.crops.length > 0 && (
          <Card>
            <h2 className="mb-2 text-xl font-bold">{t('machine.crops')}</h2>
            <div className="flex flex-wrap gap-2">
              {m.crops.map((c) => (
                <Chip key={c}>{t(`crop.${c}`)}</Chip>
              ))}
            </div>
          </Card>
        )}

        {m.areas.length > 0 && (
          <Card>
            <h2 className="mb-2 text-xl font-bold">{t('machine.serves')}</h2>
            <ul className="space-y-1.5 text-lg">
              {m.areas.map((a) => (
                <li key={`${a.village}-${a.district}-${a.state}`} className="flex items-start gap-2">
                  <MapPin className="mt-1 h-5 w-5 shrink-0 text-brand-700" aria-hidden />
                  <span>
                    {areaLabel(a)}, {a.state}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <h2 className="mb-2 text-xl font-bold">{t('machine.availability')}</h2>
          {busy.loading ? (
            <Spinner />
          ) : busyDates.length === 0 ? (
            <p className="text-lg text-muted">{t('machine.noBusy')}</p>
          ) : (
            <>
              <p className="mb-2 text-lg text-muted">{t('machine.busyDates')}</p>
              <ul className="flex flex-wrap gap-2">
                {busyDates.map((b) => (
                  <li key={`${b.date}-${b.reason}`}>
                    <Chip tone="wheat">
                      <CalendarX className="mr-1.5 h-4 w-4" aria-hidden />
                      {formatDate(b.date, lang)}
                    </Chip>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        {phone.data && (
          <Card>
            <h2 className="mb-3 text-xl font-bold">{t('machine.contact')}</h2>
            <ContactButtons
              phone={phone.data}
              callLabel={t('machine.call')}
              whatsappLabel={t('machine.whatsapp')}
              whatsappText={t('machine.whatsappText')}
            />
          </Card>
        )}

        {isOwnMachine && <Alert kind="info">{t('machine.ownerPreview')}</Alert>}

        {isFarmer && m.status === 'active' && !isOwnMachine && (
          <section ref={bookRef} id="book" className="scroll-mt-20">
            <Card className="space-y-4 border-2 border-brand-700">
              <h2 className="text-2xl font-bold text-brand-900">{t('book.title')}</h2>
              <form id="book-form" onSubmit={submit} noValidate className="space-y-4">
                <datalist id="booking-karnataka-villages">{karnatakaVillages.map((v) => <option key={v} value={v} />)}</datalist>
                <TextField
                  id="book-date"
                  type="date"
                  label={t('book.date')}
                  help={t('book.dateHelp')}
                  min={today}
                  value={form.date}
                  onChange={(e) => set('date')(e.target.value)}
                  error={errors.date ? t(errors.date) : dateIsBusy ? t(dateIsBusy.reason === 'booked' ? 'err.dateTaken' : 'err.dateBlocked') : undefined}
                  required
                />
                <TextField
                  id="book-village"
                  list="booking-karnataka-villages"
                  label={t('book.village')}
                  placeholder={t('book.villageExample')}
                  value={form.fieldVillage}
                  onChange={(e) => set('fieldVillage')(e.target.value)}
                  error={errors.fieldVillage ? t(errors.fieldVillage) : undefined}
                  autoComplete="off"
                  required
                />
                <TextField
                  id="book-acreage"
                  label={t('book.acreage')}
                  placeholder={t('book.acreageExample')}
                  inputMode="decimal"
                  value={form.acreage}
                  onChange={(e) => set('acreage')(e.target.value.replace(/[^0-9.]/g, ''))}
                  error={errors.acreage ? t(errors.acreage) : undefined}
                  required
                />
                {m.crops.length > 0 && (
                  <SelectField
                    id="book-crop"
                    label={t('book.crop')}
                    value={form.crop}
                    onChange={(e) => set('crop')(e.target.value)}
                    error={errors.crop ? t(errors.crop) : undefined}
                    required
                  >
                    <option value="">{t('book.selectCrop')}</option>
                    {m.crops.map((c) => (
                      <option key={c} value={c}>
                        {t(`crop.${c}`)}
                      </option>
                    ))}
                  </SelectField>
                )}
                <TextField
                  id="book-phone"
                  type="tel"
                  label={t('book.phone')}
                  help={t('book.phoneHelp')}
                  placeholder={t('profile.phoneExample')}
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => set('phone')(e.target.value)}
                  error={errors.phone ? t(errors.phone) : undefined}
                  required
                />
                <TextAreaField
                  id="book-notes"
                  label={t('book.notes')}
                  optional
                  maxLength={500}
                  placeholder={t('book.notesExample')}
                  value={form.notes}
                  onChange={(e) => set('notes')(e.target.value)}
                />

                {estimate != null && (
                  <div className="rounded-xl bg-wheat-100 p-4">
                    <p className="text-lg font-semibold">{t('book.estimate')}</p>
                    <p className="text-3xl font-extrabold text-brand-900">{formatInr(estimate, lang)}</p>
                    <p className="text-base text-muted">{t('book.estimateHelp')}</p>
                  </div>
                )}

                {submitError && <Alert>{t(submitError)}</Alert>}

                <Button type="submit" size="lg" full loading={submitting}>
                  {submitting ? t('book.submitting') : t('book.submit')}
                </Button>
              </form>
            </Card>
          </section>
        )}

        {isOwnMachine && (
          <ButtonLink to={`/owner/machines/${m.id}/edit`} variant="secondary" full>
            {t('common.edit')}
          </ButtonLink>
        )}
      </div>
    </AppLayout>
  )
}
