import { useEffect, useRef } from 'react'
import { DB_EVENT } from '../store/db'
import { requireSupabase, supabaseEnabled } from '../lib/supabase'

/**
 * Call `onChange` whenever the stored data changes: in this tab (our own event) or in another tab
 * (the browser's "storage" event). Bursts are debounced so one change causes one refresh.
 */
export function useRealtimeRefresh(_table: 'bookings' | 'notifications', onChange: () => void, enabled = true) {
  const callback = useRef(onChange)
  callback.current = onChange

  useEffect(() => {
    if (!enabled) return
    let timer: number | undefined
    const handler = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => callback.current(), 150)
    }
    window.addEventListener(DB_EVENT, handler)
    window.addEventListener('storage', handler)
    let channel: any
    if (supabaseEnabled) {
      const sb = requireSupabase()
      channel = sb.channel(`live-${_table}-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: _table }, handler)
        .subscribe()
    }
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(DB_EVENT, handler)
      window.removeEventListener('storage', handler)
      if (channel) void requireSupabase().removeChannel(channel)
    }
  }, [enabled])
}
