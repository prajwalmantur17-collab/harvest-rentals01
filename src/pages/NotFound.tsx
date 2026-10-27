import { SearchX } from 'lucide-react'
import { ButtonLink, EmptyState } from '../components/ui'
import { useI18n } from '../i18n'

export default function NotFound() {
  const { t } = useI18n()
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-8">
      <EmptyState
        icon={<SearchX className="h-8 w-8" aria-hidden />}
        title={t('err.page.title')}
        action={<ButtonLink to="/" full>{t('common.home')}</ButtonLink>}
      />
    </div>
  )
}
