import { useEffect, useState, type FormEvent } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { AppLayout } from '../components/AppLayout'
import { LanguageButtons } from '../components/Brand'
import { useToast } from '../components/Toast'
import { Alert, BackButton, Button, Card, PageTitle, TextField } from '../components/ui'
import { homeFor } from '../auth/guards'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../i18n/en'
import { errorKey, logError } from '../utils/errors'
import { isValidPhone, normalizePhone } from '../utils/phone'

export default function Profile() {
  const { t, lang } = useI18n()
  const { profile, updateProfile, signOut, changeLanguage } = useAuth()
  const toast = useToast()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [phoneError, setPhoneError] = useState<TranslationKey | null>(null)
  const [saveError, setSaveError] = useState<TranslationKey | null>(null)
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    setName(profile?.full_name ?? '')
    setPhone(profile?.phone ?? '')
  }, [profile?.full_name, profile?.phone])

  async function save(e: FormEvent) {
    e.preventDefault()
    setPhoneError(null)
    setSaveError(null)
    if (phone.trim() && !isValidPhone(phone)) {
      setPhoneError('v.phone')
      return
    }
    setSaving(true)
    try {
      await updateProfile({ full_name: name.trim(), phone: phone.trim() ? normalizePhone(phone) : null })
      toast.success(t('profile.saved'))
    } catch (err) {
      logError('updateProfile', err)
      setSaveError(errorKey(err))
    } finally {
      setSaving(false)
    }
  }

  async function logout() {
    setLoggingOut(true)
    await signOut()
    // The route guards send a signed-out user to the login screen.
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <BackButton to={homeFor(profile?.role)} />
        <PageTitle sub={profile?.role ? (profile.role === 'farmer' ? t('profile.farmer') : t('profile.owner')) : undefined}>
          {t('profile.title')}
        </PageTitle>

        <Card className="space-y-4">
          <h2 className="text-xl font-bold">{t('common.language')}</h2>
          <LanguageButtons value={lang} onChange={changeLanguage} />
        </Card>

        <form onSubmit={save} noValidate>
          <Card className="space-y-4">
            <TextField id="p-name" label={t('profile.name')} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
            <TextField
              id="p-phone"
              type="tel"
              label={t('profile.phone')}
              optional
              placeholder={t('profile.phoneExample')}
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={phoneError ? t(phoneError) : undefined}
            />
            {saveError && <Alert>{t(saveError)}</Alert>}
            <Button type="submit" full loading={saving}>
              {t('common.save')}
            </Button>
          </Card>
        </form>

        <Button variant="danger" size="lg" full onClick={logout} loading={loggingOut}>
          <LogOut className="h-6 w-6" aria-hidden />
          {t('profile.logout')}
        </Button>
      </div>
    </AppLayout>
  )
}
