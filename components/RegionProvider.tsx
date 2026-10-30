// components/RegionProvider.tsx — the one place the traveler's chosen town
// lives. Home's region pill sets it; Home, Market, Experiences, events, stays,
// flash deals and the route generator all read it through useRegion().
// Persisted in localStorage so it survives reloads.
'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { DEFAULT_CITY, isCityCode, nearestTown, parishFor, townFor, type CityCode, type Parish, type Town } from '@/lib/regions'

const STORAGE_KEY = 'eta_region'

interface RegionValue {
  city: CityCode
  town: Town
  parish: Parish
  /** False until the saved region has been read, so screens don't fetch the default first. */
  ready: boolean
  setCity: (city: CityCode) => void
  /** Picks the nearest town to the device's position. Rejects when location is unavailable. */
  locateMe: () => Promise<Town>
}

const RegionContext = createContext<RegionValue | null>(null)

export function RegionProvider({ children }: { children: React.ReactNode }) {
  const [city, setCityState] = useState<CityCode>(DEFAULT_CITY)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (isCityCode(saved)) setCityState(saved)
    } catch {}
    setReady(true)
  }, [])

  const setCity = useCallback((next: CityCode) => {
    setCityState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
  }, [])

  const locateMe = useCallback(() => new Promise<Town>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location isn’t available on this device'))
    navigator.geolocation.getCurrentPosition(
      p => {
        const town = nearestTown({ lat: p.coords.latitude, lng: p.coords.longitude })
        setCity(town.city)
        resolve(town)
      },
      () => reject(new Error('Couldn’t get your location — pick a town instead')),
      { timeout: 10000, maximumAge: 5 * 60 * 1000 }
    )
  }), [setCity])

  return (
    <RegionContext.Provider value={{ city, town: townFor(city), parish: parishFor(city), ready, setCity, locateMe }}>
      {children}
    </RegionContext.Provider>
  )
}

export function useRegion(): RegionValue {
  const value = useContext(RegionContext)
  if (!value) throw new Error('useRegion must be used inside RegionProvider')
  return value
}
