import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Tractor, Wheat } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { homeFor } from '../auth/guards'
import { Logo, LanguageSelect } from '../components/Brand'
import { Alert, Button, FullPageSpinner } from '../components/ui'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../i18n/en'
import type { Role } from '../types'
import { errorKey, logError } from '../utils/errors'

export default function RoleSelect() {
  const { t, lang } = useI18n()
  const { session, profile, loading, chooseRole, changeLanguage } = useAuth()
  const navigate = useNavigate()
  const [saving, setSaving] = useState<Role | null>(null)
  const [error, setError] = useState<TranslationKey | null>(null)

  if (loading) return <FullPageSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (profile?.role) return <Navigate to={homeFor(profile.role)} replace />

  async function pick(role: Role) {
    setError(null)
    setSaving(role)
    try {
      await chooseRole(role)
      navigate(homeFor(role), { replace: true })
    } catch (err) {
      logError('chooseRole', err)
      setError(errorKey(err))
      setSaving(null)
    }
  }

  const cards: { role: Role; icon: typeof Wheat; title: TranslationKey; desc: TranslationKey }[] = [
    { role: 'farmer', icon: Wheat, title: 'role.farmer.title', desc: 'role.farmer.desc' },
    { role: 'owner', icon: Tractor, title: 'role.owner.title', desc: 'role.owner.desc' },
  ]

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Logo size={40} />
          <span className="text-xl font-bold text-brand-900">{t('app.name')}</span>
        </div>
        <LanguageSelect value={lang} onChange={changeLanguage} />
      </header>

      <main className="flex flex-1 flex-col justify-center gap-6 py-8">
        <h1 className="text-center text-3xl font-extrabold text-brand-900">{t('role.title')}</h1>

        {error && <Alert>{t(error)}</Alert>}

        <div className="grid gap-4 md:grid-cols-2">
          {cards.map(({ role, icon: Icon, title, desc }) => (
            <section
              key={role}
              className="flex flex-col items-center gap-4 rounded-3xl border-2 border-line bg-white p-6 text-center shadow-sm"
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-100 text-brand-800">
                <Icon className="h-14 w-14" aria-hidden strokeWidth={1.75} />
              </div>
              <h2 className="text-2xl font-bold text-brand-900">{t(title)}</h2>
              <p className="text-lg text-muted">{t(desc)}</p>
              <Button
                size="lg"
                full
                onClick={() => pick(role)}
                loading={saving === role}
                disabled={saving !== null}
                aria-label={`${t(title)} – ${t('common.continue')}`}
              >
                {saving === role ? t('role.saving') : t('common.continue')}
              </Button>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
