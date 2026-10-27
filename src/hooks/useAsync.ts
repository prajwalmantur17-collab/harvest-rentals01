import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranslationKey } from '../i18n/en'
import { errorKey, logError } from '../utils/errors'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: TranslationKey | null
  reload: () => Promise<void>
  setData: (value: T | null) => void
}

/** Load data on mount / when `deps` change. Errors become translated message keys; stale responses are ignored. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[], enabled = true): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<TranslationKey | null>(null)
  const loader = useRef(load)
  loader.current = load
  const seq = useRef(0)

  const run = useCallback(async (showSpinner: boolean) => {
    const mine = ++seq.current
    if (showSpinner) setLoading(true)
    try {
      const result = await loader.current()
      if (mine !== seq.current) return
      setData(result)
      setError(null)
    } catch (err) {
      if (mine !== seq.current) return
      logError('load', err)
      setError(errorKey(err))
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    void run(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  const reload = useCallback(() => run(false), [run])
  return { data, loading, error, reload, setData }
}
