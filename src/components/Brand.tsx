import { useI18n, LANGUAGES } from '../i18n'
import type { Lang } from '../types'

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <rect width="64" height="64" rx="14" fill="#174a27" />
      <path d="M32 52V24" stroke="#f5e6b3" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M32 30c-6-1-9-5-9-10 6 1 9 5 9 10Zm0 0c6-1 9-5 9-10-6 1-9 5-9 10Zm0 10c-6-1-9-5-9-10 6 1 9 5 9 10Zm0 0c6-1 9-5 9-10-6 1-9 5-9 10Z"
        fill="#f5e6b3"
      />
    </svg>
  )
}

export function BrandName({ className = '' }: { className?: string }) {
  const { t } = useI18n()
  return <span className={`font-bold text-brand-900 ${className}`}>{t('app.name')}</span>
}

/** Original illustration: a field of wheat under a sun with a simple harvesting machine. */
export function FieldIllustration({ className = '' }: { className?: string }) {
  const rows = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  return (
    <svg viewBox="0 0 400 220" role="img" aria-label="" className={className}>
      <rect width="400" height="220" fill="#f8ecc8" />
      <circle cx="318" cy="52" r="26" fill="#f2c14e" />
      <path d="M0 128 Q90 100 190 122 T400 112 V220 H0Z" fill="#cfe3c4" />
      <path d="M0 150 Q120 126 240 146 T400 140 V220 H0Z" fill="#e0b84a" />
      <path d="M0 176 Q140 156 260 172 T400 168 V220 H0Z" fill="#d1a136" />
      {rows.map((i) => (
        <g key={i} transform={`translate(${12 + i * 33} ${182 + (i % 2) * 8})`} stroke="#8a5a00" strokeWidth="2" fill="none">
          <path d="M0 22V0" />
          <path d="M0 6l-5-5M0 6l5-5M0 12l-5-5M0 12l5-5" />
        </g>
      ))}
      {/* harvesting machine */}
      <g transform="translate(70 96)">
        <rect x="0" y="22" width="34" height="28" rx="4" fill="#174a27" />
        <rect x="6" y="28" width="18" height="12" rx="2" fill="#d7ecda" />
        <rect x="34" y="30" width="86" height="22" rx="4" fill="#2f8a47" />
        <rect x="116" y="38" width="30" height="14" rx="3" fill="#174a27" />
        <rect x="-10" y="46" width="24" height="10" rx="2" fill="#b07d12" />
        <circle cx="24" cy="62" r="13" fill="#2b2b2b" />
        <circle cx="24" cy="62" r="5" fill="#9aa39c" />
        <circle cx="104" cy="64" r="10" fill="#2b2b2b" />
        <circle cx="104" cy="64" r="4" fill="#9aa39c" />
        <path d="M52 30V14h40v16" fill="none" stroke="#174a27" strokeWidth="3" />
      </g>
    </svg>
  )
}

export function LanguageButtons({ value, onChange }: { value: Lang; onChange: (l: Lang) => void }) {
  const { t } = useI18n()
  return (
    <div role="group" aria-label={t('common.language')} className="flex flex-wrap justify-center gap-2">
      {LANGUAGES.map((l) => {
        const active = l.code === value
        return (
          <button
            key={l.code}
            type="button"
            lang={l.code}
            aria-pressed={active}
            onClick={() => onChange(l.code)}
            className={`min-h-12 min-w-[6.5rem] rounded-xl border-2 px-4 text-lg font-semibold transition-colors ${
              active
                ? 'border-brand-800 bg-brand-800 text-white'
                : 'border-line bg-white text-brand-900 hover:border-brand-700'
            }`}
          >
            {l.label}
          </button>
        )
      })}
    </div>
  )
}

/** Compact language switcher for the header. Native <select> works well on every phone. */
export function LanguageSelect({ value, onChange }: { value: Lang; onChange: (l: Lang) => void }) {
  const { t } = useI18n()
  return (
    <select
      aria-label={t('common.language')}
      value={value}
      onChange={(e) => onChange(e.target.value as Lang)}
      className="min-h-11 rounded-xl border-2 border-line bg-white px-2 py-1 text-base font-semibold text-brand-900"
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code} lang={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  )
}
