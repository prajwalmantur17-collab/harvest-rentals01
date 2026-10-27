import { useCallback, useState } from 'react'

export interface Coords {
  lat: number
  lng: number
}

type GeoState = 'idle' | 'locating' | 'granted' | 'denied'

/** Optional location. Nothing in the app requires it; denying it never blocks a task. */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>('idle')
  const [coords, setCoords] = useState<Coords | null>(null)

  const request = useCallback((): Promise<Coords | null> => {
    if (!('geolocation' in navigator)) {
      setState('denied')
      return Promise.resolve(null)
    }
    setState('locating')
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setCoords(c)
          setState('granted')
          resolve(c)
        },
        () => {
          setState('denied')
          resolve(null)
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 },
      )
    })
  }, [])

  const clear = useCallback(() => {
    setCoords(null)
    setState('idle')
  }, [])

  return { state, coords, request, clear }
}
