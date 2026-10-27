import { useState, type FormEvent } from 'react'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import { INDIAN_STATES } from '../data/states'
import { karnatakaDistricts, karnatakaVillages } from '../data/karnatakaLocations'
import { useI18n } from '../i18n'
import { CROPS, MACHINE_TYPES, type SearchParams } from '../types'
import { Button, SelectField, TextField } from './ui'

export interface SearchValues {
  village: string
  district: string
  state: string
  crop: string
  type: string
}

export const EMPTY_SEARCH: SearchValues = { village: '', district: '', state: '', crop: '', type: '' }

export function paramsToValues(p: URLSearchParams): SearchValues {
  return {
    village: p.get('village') ?? '',
    district: p.get('district') ?? '',
    state: p.get('state') ?? '',
    crop: p.get('crop') ?? '',
    type: p.get('type') ?? '',
  }
}

export function valuesToQuery(v: SearchValues): string {
  const q = new URLSearchParams()
  for (const [k, val] of Object.entries(v)) if (val.trim()) q.set(k, val.trim())
  return q.toString()
}

export function valuesToSearch(v: SearchValues): SearchParams {
  return {
    village: v.village,
    district: v.district,
    state: v.state,
    crop: v.crop,
    type: v.type,
  }
}

export function SearchForm({
  initial = EMPTY_SEARCH,
  onSearch,
  autoFocusVillage = false,
}: {
  initial?: SearchValues
  onSearch: (values: SearchValues) => void
  autoFocusVillage?: boolean
}) {
  const { t } = useI18n()
  const [values, setValues] = useState<SearchValues>(initial)
  const [more, setMore] = useState(Boolean(initial.district || initial.state || initial.crop || initial.type))

  const set = (key: keyof SearchValues) => (value: string) => setValues((v) => ({ ...v, [key]: value }))

  function submit(e: FormEvent) {
    e.preventDefault()
    onSearch(values)
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-white p-4 shadow-sm md:p-5" role="search">
      <datalist id="search-karnataka-villages">{karnatakaVillages.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="search-karnataka-districts">{karnatakaDistricts.map((v) => <option key={v} value={v} />)}</datalist>
      <TextField
        id="search-village"
        list="search-karnataka-villages"
        label={t('search.village')}
        value={values.village}
        onChange={(e) => set('village')(e.target.value)}
        placeholder={t('search.villageExample')}
        autoComplete="off"
        autoFocus={autoFocusVillage}
        enterKeyHint="search"
        className="min-h-16 text-xl"
      />

      <button
        type="button"
        onClick={() => setMore((m) => !m)}
        aria-expanded={more}
        className="inline-flex min-h-12 items-center gap-2 rounded-xl text-lg font-semibold text-brand-800 hover:underline"
      >
        {more ? <ChevronUp className="h-5 w-5" aria-hidden /> : <ChevronDown className="h-5 w-5" aria-hidden />}
        {more ? t('search.less') : t('search.more')}
      </button>

      {more && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="search-district"
            list="search-karnataka-districts"
            label={t('search.district')}
            value={values.district}
            onChange={(e) => set('district')(e.target.value)}
            placeholder={t('search.districtExample')}
            autoComplete="off"
          />
          <SelectField id="search-state" label={t('search.state')} value={values.state} onChange={(e) => set('state')(e.target.value)}>
            <option value="">{t('search.anyState')}</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectField>
          <SelectField id="search-crop" label={t('search.crop')} value={values.crop} onChange={(e) => set('crop')(e.target.value)}>
            <option value="">{t('search.anyCrop')}</option>
            {CROPS.map((c) => (
              <option key={c} value={c}>
                {t(`crop.${c}`)}
              </option>
            ))}
          </SelectField>
          <SelectField id="search-type" label={t('search.machineType')} value={values.type} onChange={(e) => set('type')(e.target.value)}>
            <option value="">{t('search.anyType')}</option>
            {MACHINE_TYPES.map((m) => (
              <option key={m} value={m}>
                {t(`type.${m}`)}
              </option>
            ))}
          </SelectField>
        </div>
      )}

      <Button type="submit" size="lg" full>
        <Search className="h-6 w-6" aria-hidden />
        {t('search.button')}
      </Button>
    </form>
  )
}
