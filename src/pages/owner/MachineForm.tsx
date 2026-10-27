import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Camera, LocateFixed, Trash2 } from 'lucide-react'
import {
  getMachinePhone,
  getMyMachine,
  photoUrl,
  prepareImage,
  removeMachinePhoto,
  saveMachine,
  uploadMachinePhoto,
} from '../../api/machines'
import { useAuth } from '../../auth/AuthContext'
import { AppLayout } from '../../components/AppLayout'
import { useToast } from '../../components/Toast'
import {
  Alert,
  BackButton,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  PageTitle,
  SelectField,
  Spinner,
  TextAreaField,
  TextField,
} from '../../components/ui'
import { INDIAN_STATES } from '../../data/states'
import { karnatakaDistricts, karnatakaVillages } from '../../data/karnatakaLocations'
import { useAsync } from '../../hooks/useAsync'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n/en'
import { CROPS, MACHINE_TYPES, type Crop, type MachineFormValues } from '../../types'
import { errorKey, logError } from '../../utils/errors'
import { hasErrors, validateMachine, validatePhoto, type MachineField } from '../../validation'

const EMPTY: MachineFormValues = {
  machineType: '',
  modelName: '',
  pricePerAcre: '',
  crops: [],
  village: '',
  extraVillages: '',
  district: '',
  state: '',
  phone: '',
  pin: '',
  photoPath: null,
  lat: null,
  lng: null,
}

export default function MachineForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const { t } = useI18n()
  const { profile } = useAuth()
  const ownerId = profile?.id ?? ''
  const navigate = useNavigate()
  const toast = useToast()
  const geo = useGeolocation()
  const fileInput = useRef<HTMLInputElement>(null)

  const [values, setValues] = useState<MachineFormValues>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<MachineField, TranslationKey>>>({})
  const [photoError, setPhotoError] = useState<TranslationKey | null>(null)
  const [submitError, setSubmitError] = useState<TranslationKey | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  // The photo that was saved on the machine when the page opened. It is deleted only after a successful save.
  const [originalPhoto, setOriginalPhoto] = useState<string | null>(null)
  // Photos uploaded in this session but not saved yet; removed again if the owner replaces them or leaves.
  const [pendingUploads, setPendingUploads] = useState<string[]>([])
  const pendingUploadsRef = useRef<string[]>([])
  const savedRef = useRef(false)

  useEffect(() => () => {
    if (!savedRef.current) {
      for (const path of pendingUploadsRef.current) {
        void removeMachinePhoto(path).catch((err) => logError('clean up unsaved photo', err))
      }
    }
  }, [])

  const loaded = useAsync(
    async () => {
      if (!id) return null
      const m = await getMyMachine(ownerId, id)
      if (!m) return null
      const phone = await getMachinePhone(id)
      return { m, phone }
    },
    [id, ownerId],
    editing && Boolean(ownerId),
  )

  useEffect(() => {
    const data = loaded.data
    if (!data) return
    const { m, phone } = data
    const [main, ...others] = m.areas
    setOriginalPhoto(m.photoPath)
    setValues({
      machineType: m.machineType,
      modelName: m.modelName ?? '',
      pricePerAcre: String(m.pricePerAcre),
      crops: m.crops,
      village: main?.village ?? '',
      extraVillages: others.map((a) => a.village).join(', '),
      district: main?.district ?? '',
      state: main?.state ?? '',
      phone,
      pin: '',
      photoPath: m.photoPath,
      lat: m.currentLat,
      lng: m.currentLng,
    })
  }, [loaded.data])

  const set = <K extends keyof MachineFormValues>(key: K, value: MachineFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }))

  function toggleCrop(crop: Crop) {
    set('crops', values.crops.includes(crop) ? values.crops.filter((c) => c !== crop) : [...values.crops, crop])
  }

  async function onPickPhoto(file: File | undefined) {
    if (!file) return
    setPhotoError(null)
    const problem = validatePhoto(file)
    if (problem) {
      setPhotoError(problem)
      return
    }
    setUploadPct(0)
    try {
      const blob = await prepareImage(file)
      const path = await uploadMachinePhoto(blob, ownerId, setUploadPct)
      // A replaced photo that was never saved is removed straight away.
      if (values.photoPath && pendingUploads.includes(values.photoPath)) {
        removeMachinePhoto(values.photoPath).catch((err) => logError('remove unsaved photo', err))
      }
      const nextUploads = [...pendingUploadsRef.current.filter((x) => x !== values.photoPath), path]
      pendingUploadsRef.current = nextUploads
      setPendingUploads(nextUploads)
      set('photoPath', path)
      setErrors((prev) => ({ ...prev, photoPath: undefined }))
    } catch (err) {
      logError('upload photo', err)
      setPhotoError(errorKey(err) === 'err.network' ? 'err.network' : 'err.upload')
    } finally {
      setUploadPct(null)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function useCurrentLocation() {
    const c = await geo.request()
    if (c) {
      setValues((v) => ({ ...v, lat: Math.round(c.lat * 1e6) / 1e6, lng: Math.round(c.lng * 1e6) / 1e6 }))
      toast.success(t('form.gpsSaved'))
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving || uploadPct !== null) return
    setSubmitError(null)
    const found = validateMachine(values, !editing)
    setErrors(found)
    if (hasErrors(found)) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }

    setSaving(true)
    try {
      await saveMachine(id ?? null, values)
      savedRef.current = true
      pendingUploadsRef.current = []
      setPendingUploads([])
      // The old photo is now unused. Failing to delete it must not undo a successful save.
      if (originalPhoto && originalPhoto !== values.photoPath) {
        removeMachinePhoto(originalPhoto).catch((err) => logError('remove old photo', err))
      }
      toast.success(t('form.saved'))
      navigate('/owner/machines', { replace: true })
    } catch (err) {
      logError('saveMachine', err)
      setSubmitError(errorKey(err))
      setSaving(false)
    }
  }

  async function removePhoto() {
    if (values.photoPath && pendingUploads.includes(values.photoPath)) {
      removeMachinePhoto(values.photoPath).catch((err) => logError('remove unsaved photo', err))
      const nextUploads = pendingUploadsRef.current.filter((x) => x !== values.photoPath)
      pendingUploadsRef.current = nextUploads
      setPendingUploads(nextUploads)
    }
    set('photoPath', null)
  }

  const title = editing ? t('form.editTitle') : t('form.addTitle')

  if (editing && loaded.loading) {
    return (
      <AppLayout>
        <Spinner />
      </AppLayout>
    )
  }
  if (editing && loaded.error) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <BackButton to="/owner/machines" />
          <ErrorState messageKey={loaded.error} onRetry={loaded.reload} />
        </div>
      </AppLayout>
    )
  }
  if (editing && !loaded.data) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <BackButton to="/owner/machines" />
          <EmptyState icon={<Camera className="h-8 w-8" aria-hidden />} title={t('machine.notFound')} />
        </div>
      </AppLayout>
    )
  }

  const preview = photoUrl(values.photoPath)

  return (
    <AppLayout>
      <form onSubmit={submit} noValidate className="space-y-5">
        <datalist id="karnataka-villages">{karnatakaVillages.map((v) => <option key={v} value={v} />)}</datalist>
        <datalist id="karnataka-districts">{karnatakaDistricts.map((v) => <option key={v} value={v} />)}</datalist>
        <BackButton to="/owner/machines" />
        <PageTitle>{title}</PageTitle>

        <Card className="space-y-5">
          <SelectField
            id="m-type"
            label={t('form.type')}
            value={values.machineType}
            onChange={(e) => set('machineType', e.target.value as MachineFormValues['machineType'])}
            error={errors.machineType ? t(errors.machineType) : undefined}
            required
          >
            <option value="">—</option>
            {MACHINE_TYPES.map((m) => (
              <option key={m} value={m}>
                {t(`type.${m}`)}
              </option>
            ))}
          </SelectField>

          <TextField
            id="m-model"
            label={t('form.model')}
            optional
            placeholder={t('form.modelExample')}
            value={values.modelName}
            onChange={(e) => set('modelName', e.target.value)}
            error={errors.modelName ? t(errors.modelName) : undefined}
            maxLength={80}
          />

          <TextField
            id="m-price"
            label={t('form.price')}
            placeholder={t('form.priceExample')}
            inputMode="decimal"
            value={values.pricePerAcre}
            onChange={(e) => set('pricePerAcre', e.target.value.replace(/[^0-9.]/g, ''))}
            error={errors.pricePerAcre ? t(errors.pricePerAcre) : undefined}
            required
          />

          <Field label={t('form.crops')} error={errors.crops ? t(errors.crops) : undefined}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label={t('form.crops')}>
              {CROPS.map((c) => {
                const checked = values.crops.includes(c)
                return (
                  <label
                    key={c}
                    className={`flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-xl border-2 px-3 text-lg font-medium ${
                      checked ? 'border-brand-800 bg-brand-50' : 'border-line bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCrop(c)}
                      className="h-6 w-6 shrink-0 accent-[#174a27]"
                    />
                    {t(`crop.${c}`)}
                  </label>
                )
              })}
            </div>
          </Field>
        </Card>

        <Card className="space-y-5">
          <TextField
            id="m-village"
            list="karnataka-villages"
            label={t('form.village')}
            help={t('form.villageHelp')}
            placeholder={t('form.villageExample')}
            value={values.village}
            onChange={(e) => set('village', e.target.value)}
            error={errors.village ? t(errors.village) : undefined}
            autoComplete="off"
            required
          />
          <TextAreaField
            id="m-extra"
            label={t('form.extra')}
            optional
            help={t('form.extraHelp')}
            placeholder={t('form.extraExample')}
            value={values.extraVillages}
            onChange={(e) => set('extraVillages', e.target.value)}
            rows={2}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id="m-district"
              list="karnataka-districts"
              label={t('form.district')}
              placeholder={t('form.districtExample')}
              value={values.district}
              onChange={(e) => set('district', e.target.value)}
              error={errors.district ? t(errors.district) : undefined}
              autoComplete="off"
              required
            />
            <SelectField
              id="m-state"
              label={t('form.state')}
              value={values.state}
              onChange={(e) => set('state', e.target.value)}
              error={errors.state ? t(errors.state) : undefined}
              required
            >
              <option value="">{t('form.selectState')}</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
          </div>
          <TextField
            id="m-phone"
            type="tel"
            label={t('form.phone')}
            help={t('form.phoneHelp')}
            placeholder={t('form.phoneExample')}
            inputMode="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
            error={errors.phone ? t(errors.phone) : undefined}
            required
          />
          {!editing && (
            <TextField
              id="m-pin"
              label={t('form.pin')}
              help={t('form.pinHelp')}
              placeholder={t('form.pinExample')}
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={values.pin}
              onChange={(e) => set('pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
              error={errors.pin ? t(errors.pin) : undefined}
              required
            />
          )}
        </Card>

        <Card className="space-y-4">
          <Field label={t('form.photo')} help={t('form.photoHelp')} error={photoError ? t(photoError) : errors.photoPath ? t(errors.photoPath) : undefined}>
            {preview && <img src={preview} alt="" className="h-52 w-full rounded-xl object-cover" />}
            <input
              ref={fileInput}
              id="m-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => void onPickPhoto(e.target.files?.[0])}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="secondary"
                full
                disabled={uploadPct !== null}
                onClick={() => fileInput.current?.click()}
              >
                <Camera className="h-5 w-5" aria-hidden />
                {values.photoPath ? t('form.photoReplace') : t('form.photoChoose')}
              </Button>
              {values.photoPath && (
                <Button variant="danger" full disabled={uploadPct !== null} onClick={() => void removePhoto()}>
                  <Trash2 className="h-5 w-5" aria-hidden />
                  {t('form.photoRemove')}
                </Button>
              )}
            </div>
            {uploadPct !== null && (
              <div className="space-y-1" role="status">
                <div className="h-3 overflow-hidden rounded-full bg-cream-200">
                  <div className="h-full bg-brand-700 transition-all" style={{ width: `${uploadPct}%` }} />
                </div>
                <p className="text-base font-medium text-brand-800">{t('form.uploading', { pct: uploadPct })}</p>
              </div>
            )}
          </Field>
        </Card>

        <Card className="space-y-3">
          <Field label={t('form.gps')} optional help={t('form.gpsHelp')}>
            {values.lat != null && values.lng != null && (
              <p className="rounded-xl bg-brand-50 px-4 py-3 text-lg font-medium text-brand-900">
                {values.lat.toFixed(4)}, {values.lng.toFixed(4)}
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="secondary" full onClick={useCurrentLocation} loading={geo.state === 'locating'}>
                <LocateFixed className="h-5 w-5" aria-hidden />
                {t('form.gpsUse')}
              </Button>
              {values.lat != null && (
                <Button
                  variant="ghost"
                  full
                  onClick={() => {
                    set('lat', null)
                    set('lng', null)
                  }}
                >
                  {t('form.gpsClear')}
                </Button>
              )}
            </div>
            {geo.state === 'denied' && <Alert kind="info">{t('form.gpsDenied')}</Alert>}
          </Field>
        </Card>

        {submitError && <Alert>{t(submitError)}</Alert>}

        <Button type="submit" size="lg" full loading={saving} disabled={uploadPct !== null}>
          {saving ? t('form.saving') : t('form.save')}
        </Button>
      </form>
    </AppLayout>
  )
}
