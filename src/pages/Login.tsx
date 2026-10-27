import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { demoLoginEnabled, supabaseEnabled } from '../lib/supabase'
import { FieldIllustration, LanguageButtons, Logo } from '../components/Brand'
import { Alert, Button, TextField } from '../components/ui'
import { useI18n } from '../i18n'

/** Demo sign-in: no password and no checks. Whatever is typed is accepted. */
export default function Login() {
  const { t, lang } = useI18n()
  const { session, signIn, requestOtp, verifyOtp, changeLanguage, loading } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const productionPhoneLogin = supabaseEnabled && !demoLoginEnabled

  // "/" sends a signed-in user to their dashboard or to role selection.
  if (session && !loading) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (productionPhoneLogin) {
        if (!otpSent) {
          await requestOtp(phone)
          setOtpSent(true)
        } else {
          await verifyOtp(name, phone, otp)
        }
      } else {
        await signIn(name, phone)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Check your settings and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
      <div className="mb-4 flex justify-center">
        <LanguageButtons value={lang} onChange={changeLanguage} />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size={72} />
          <h1 className="text-4xl font-extrabold leading-tight text-brand-900">{t('app.name')}</h1>
          <p className="text-xl text-muted">{t('app.tagline')}</p>
        </div>

        <FieldIllustration className="w-full overflow-hidden rounded-2xl border border-line" />

        <form onSubmit={submit} className="space-y-4" noValidate>
          <TextField
            id="login-name"
            label={t('login.name')}
            placeholder={t('login.nameExample')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={80}
          />
          <TextField
            id="login-phone"
            type="tel"
            inputMode="tel"
            label={t('login.phone')}
            placeholder={t('login.phoneExample')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            maxLength={20}
            required={productionPhoneLogin}
          />
          {productionPhoneLogin && otpSent && (
            <TextField
              id="login-otp"
              label="SMS verification code"
              placeholder="Enter the code you received"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\\D/g, '').slice(0, 8))}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          )}
          <Alert kind="info">
            {productionPhoneLogin
              ? 'Secure sign-in: we will send a one-time code to your phone. Your Supabase SMS provider must be configured.'
              : supabaseEnabled
                ? 'Judge demo mode: guest profile, machine listings, bookings and photos are saved online. This mode is not production authentication.'
                : t('login.demoNote')}
          </Alert>
          {error && <Alert kind="error">{error}</Alert>}
          <Button type="submit" size="lg" full disabled={submitting || loading || (productionPhoneLogin && (!phone.trim() || (otpSent && !otp.trim())))}>
            {submitting || loading
              ? 'Please wait…'
              : productionPhoneLogin
                ? otpSent ? 'Verify code and continue' : 'Send verification code'
                : t('common.continue')}
          </Button>
          {productionPhoneLogin && otpSent && (
            <button type="button" className="w-full text-base font-semibold text-brand-800 underline" onClick={() => { setOtpSent(false); setOtp(''); setError('') }}>
              Change phone number
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
