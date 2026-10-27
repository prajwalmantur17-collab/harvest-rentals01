import {
  forwardRef,
  useId,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Link, useNavigate, type LinkProps } from 'react-router-dom'
import { ArrowLeft, CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../i18n/en'
import type { BookingStatus } from '../types'

// ---------------------------------------------------------------------------
// Buttons (large tap targets, visible labels)
// ---------------------------------------------------------------------------
type Variant = 'primary' | 'secondary' | 'danger' | 'whatsapp' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-800 text-white hover:bg-brand-900 border-2 border-brand-800',
  secondary: 'bg-white text-brand-800 border-2 border-brand-800 hover:bg-brand-50',
  danger: 'bg-white text-red-800 border-2 border-red-800 hover:bg-red-50',
  whatsapp: 'bg-[#177a45] text-white border-2 border-[#177a45] hover:bg-[#10663a]',
  ghost: 'bg-transparent text-brand-800 border-2 border-transparent hover:bg-brand-50',
}

export function buttonClass(variant: Variant = 'primary', full = false, size: 'md' | 'lg' = 'md'): string {
  const height = size === 'lg' ? 'min-h-16 text-xl px-6' : 'min-h-[3.25rem] text-lg px-5'
  return `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${height} ${full ? 'w-full' : ''} ${VARIANTS[variant]}`
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  full?: boolean
  size?: 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', full, size = 'md', loading, children, disabled, className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${buttonClass(variant, full, size)} ${className}`}
      {...rest}
    >
      {loading && <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

interface ButtonLinkProps extends LinkProps {
  variant?: Variant
  full?: boolean
  size?: 'md' | 'lg'
}
export function ButtonLink({ variant = 'primary', full, size = 'md', className = '', ...rest }: ButtonLinkProps) {
  return <Link className={`${buttonClass(variant, full, size)} ${className}`} {...rest} />
}

export function ExternalButtonLink({
  variant = 'primary',
  full,
  className = '',
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; full?: boolean }) {
  return <a className={`${buttonClass(variant, full)} ${className}`} {...rest} />
}

// ---------------------------------------------------------------------------
// Form controls: every control has a visible label, optional help text and error
// ---------------------------------------------------------------------------
interface FieldProps {
  label: string
  htmlFor?: string
  help?: string
  error?: string
  optional?: boolean
  children: ReactNode
}

export function Field({ label, htmlFor, help, error, optional, children }: FieldProps) {
  const { t } = useI18n()
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-lg font-semibold">
        {label}
        {optional && <span className="ml-2 text-base font-normal text-muted">({t('common.optional')})</span>}
      </label>
      {help && (
        <p id={htmlFor ? `${htmlFor}-help` : undefined} className="text-base text-muted">
          {help}
        </p>
      )}
      {children}
      {error && (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="flex items-start gap-1.5 text-base font-medium text-red-800">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}

const CONTROL =
  'block w-full min-h-[3.25rem] rounded-xl border-2 bg-white px-4 py-2.5 text-ink placeholder:text-[#6b756f] focus:border-brand-700'

function controlClass(invalid: boolean, extra = '') {
  return `${CONTROL} ${invalid ? 'border-red-700' : 'border-line'} ${extra}`
}

interface ControlProps {
  id: string
  label: string
  help?: string
  error?: string
  optional?: boolean
}

export const TextField = forwardRef<HTMLInputElement, ControlProps & InputHTMLAttributes<HTMLInputElement>>(
  function TextField({ id, label, help, error, optional, className = '', ...rest }, ref) {
    return (
      <Field label={label} htmlFor={id} help={help} error={error} optional={optional}>
        <input
          ref={ref}
          id={id}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={[help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined}
          className={controlClass(Boolean(error), className)}
          {...rest}
        />
      </Field>
    )
  },
)

export function SelectField({
  id,
  label,
  help,
  error,
  optional,
  className = '',
  children,
  ...rest
}: ControlProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} htmlFor={id} help={help} error={error} optional={optional}>
      <select
        id={id}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined}
        className={controlClass(Boolean(error), className)}
        {...rest}
      >
        {children}
      </select>
    </Field>
  )
}

export function TextAreaField({
  id,
  label,
  help,
  error,
  optional,
  className = '',
  ...rest
}: ControlProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} htmlFor={id} help={help} error={error} optional={optional}>
      <textarea
        id={id}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined}
        className={controlClass(Boolean(error), `min-h-24 ${className}`)}
        {...rest}
      />
    </Field>
  )
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-white p-4 shadow-sm md:p-5 ${className}`}>{children}</div>
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-muted" role="status">
      <LoaderCircle className="h-7 w-7 animate-spin text-brand-700" aria-hidden />
      <span className="text-lg">{label ?? t('common.loading')}</span>
    </div>
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-50">
      <Spinner />
    </div>
  )
}

export function Alert({
  kind = 'error',
  children,
  action,
}: {
  kind?: 'error' | 'success' | 'info'
  children: ReactNode
  action?: ReactNode
}) {
  const styles = {
    error: 'border-red-300 bg-red-50 text-red-900',
    success: 'border-brand-200 bg-brand-50 text-brand-900',
    info: 'border-wheat-500 bg-wheat-100 text-ink',
  }[kind]
  const Icon = kind === 'success' ? CircleCheck : CircleAlert
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`flex flex-col gap-3 rounded-xl border-2 p-4 ${styles}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
        <div className="text-lg">{children}</div>
      </div>
      {action}
    </div>
  )
}

export function ErrorState({ messageKey, onRetry }: { messageKey: TranslationKey; onRetry?: () => void }) {
  const { t } = useI18n()
  return (
    <Alert
      action={
        onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        ) : undefined
      }
    >
      {t(messageKey)}
    </Alert>
  )
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode
  title: string
  text?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line bg-white px-6 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-wheat-100 text-wheat-700">{icon}</div>
      <h2 className="text-xl font-bold">{title}</h2>
      {text && <p className="max-w-md text-lg text-muted">{text}</p>}
      {action && <div className="mt-2 w-full max-w-xs">{action}</div>}
    </div>
  )
}

export function BackButton({ to, label }: { to?: string; label?: string }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const cls =
    'inline-flex min-h-12 items-center gap-2 rounded-xl px-3 -ml-3 text-lg font-semibold text-brand-800 hover:bg-brand-50'
  if (to) {
    return (
      <Link to={to} className={cls}>
        <ArrowLeft className="h-6 w-6" aria-hidden />
        {label ?? t('common.back')}
      </Link>
    )
  }
  return (
    <button type="button" className={cls} onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
      <ArrowLeft className="h-6 w-6" aria-hidden />
      {label ?? t('common.back')}
    </button>
  )
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="space-y-1">
      <h1 className="text-3xl font-bold leading-tight text-brand-900">{children}</h1>
      {sub && <p className="text-lg text-muted">{sub}</p>}
    </div>
  )
}

export function Chip({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'wheat' | 'gray' }) {
  const tones = {
    green: 'bg-brand-50 text-brand-800 border-brand-200',
    wheat: 'bg-wheat-100 text-wheat-700 border-wheat-500/40',
    gray: 'bg-cream-100 text-muted border-line',
  }
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-base font-medium ${tones[tone]}`}>{children}</span>
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: 'bg-[#fdf1d0] text-[#6b4200] border-[#e3c26a]',
  confirmed: 'bg-brand-100 text-brand-900 border-brand-200',
  rejected: 'bg-red-100 text-red-900 border-red-300',
  cancelled: 'bg-cream-200 text-[#3d4540] border-line',
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useI18n()
  return (
    <span className={`inline-flex items-center rounded-full border-2 px-3 py-1 text-base font-bold ${STATUS_STYLES[status]}`}>
      {t(`status.${status}`)}
    </span>
  )
}

/** Unique id helper for forms. */
export function useFieldId(prefix: string): string {
  return `${prefix}-${useId().replace(/:/g, '')}`
}
