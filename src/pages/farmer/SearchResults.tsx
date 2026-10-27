import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { searchMachines } from '../../api/machines'
import { AppLayout } from '../../components/AppLayout'
import { MachineCard } from '../../components/MachineParts'
import { SearchForm, paramsToValues, valuesToQuery, valuesToSearch } from '../../components/SearchForm'
import { BackButton, EmptyState, ErrorState, PageTitle, Spinner, Button } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useI18n } from '../../i18n'

export default function SearchResults() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const values = useMemo(() => paramsToValues(params), [params])
  const key = valuesToQuery(values)

  const results = useAsync(() => searchMachines(valuesToSearch(values)), [key])

  return (
    <AppLayout>
      <div className="space-y-5">
        <BackButton to="/farmer" />
        <PageTitle sub={results.data ? t('search.count', { count: results.data.length }) : undefined}>
          {t('search.resultsTitle')}
        </PageTitle>

        <SearchForm
          key={key}
          initial={values}
          onSearch={(v) => navigate(`/farmer/search?${valuesToQuery(v)}`)}
        />

        {results.loading ? (
          <Spinner />
        ) : results.error ? (
          <ErrorState messageKey={results.error} onRetry={results.reload} />
        ) : results.data && results.data.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {results.data.map((m) => (
              <MachineCard key={m.id} machine={m} canBook />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<SearchX className="h-8 w-8" aria-hidden />}
            title={t('search.empty.title')}
            text={t('search.empty.text')}
            action={
              <Button
                full
                onClick={() => {
                  navigate('/farmer')
                }}
              >
                {t('search.tryAnother')}
              </Button>
            }
          />
        )}
      </div>
    </AppLayout>
  )
}
