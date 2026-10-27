import { useNavigate } from 'react-router-dom'
import { ClipboardList, LocateFixed, Sprout } from 'lucide-react'
import { searchMachines } from '../../api/machines'
import { useAuth } from '../../auth/AuthContext'
import { AppLayout } from '../../components/AppLayout'
import { MachineCard } from '../../components/MachineParts'
import { SearchForm, valuesToQuery } from '../../components/SearchForm'
import { useToast } from '../../components/Toast'
import { Alert, ButtonLink, Button, EmptyState, ErrorState, PageTitle, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useI18n } from '../../i18n'

export default function FarmerHome() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const geo = useGeolocation()

  const recommended = useAsync(
    () => searchMachines({ lat: geo.coords?.lat, lng: geo.coords?.lng }, 6),
    [geo.coords?.lat, geo.coords?.lng],
  )

  async function useMyLocation() {
    const c = await geo.request()
    if (!c) toast.info(t('search.locationDenied'))
  }

  const firstName = profile?.full_name?.trim().split(/\s+/)[0]

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageTitle sub={firstName ? undefined : t('app.tagline')}>
          {firstName ? `${t('farmer.title')}` : t('farmer.title')}
        </PageTitle>

        <SearchForm onSearch={(v) => navigate(`/farmer/search?${valuesToQuery(v)}`)} />

        <ButtonLink to="/farmer/bookings" variant="secondary" size="lg" full>
          <ClipboardList className="h-6 w-6" aria-hidden />
          {t('search.myBookings')}
        </ButtonLink>

        <section className="space-y-3" aria-labelledby="recommended-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="recommended-title" className="text-2xl font-bold text-brand-900">
              {t('search.recommended')}
            </h2>
            {geo.state === 'granted' ? (
              <Button variant="ghost" onClick={geo.clear}>
                {t('search.locationOff')}
              </Button>
            ) : (
              <Button variant="secondary" onClick={useMyLocation} loading={geo.state === 'locating'}>
                <LocateFixed className="h-5 w-5" aria-hidden />
                {geo.state === 'locating' ? t('search.locating') : t('search.nearMe')}
              </Button>
            )}
          </div>

          {geo.state === 'granted' && <Alert kind="success">{t('search.locationOn')}</Alert>}
          {geo.state === 'denied' && <Alert kind="info">{t('search.locationDenied')}</Alert>}

          {recommended.loading ? (
            <Spinner />
          ) : recommended.error ? (
            <ErrorState messageKey={recommended.error} onRetry={recommended.reload} />
          ) : recommended.data && recommended.data.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {recommended.data.map((m) => (
                <MachineCard key={m.id} machine={m} canBook />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Sprout className="h-8 w-8" aria-hidden />} title={t('search.noneListed')} />
          )}
        </section>
      </div>
    </AppLayout>
  )
}
