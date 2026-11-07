// lib/weather.ts — rain forecasts from Open-Meteo (free, no API key) for
// Plan B (lib/plan-b.ts). Returns null when the service can't be reached.

import { townFor, type CityCode } from '@/lib/regions'

// Hourly rain chance up to 16 days out, for Plan B (lib/plan-b.ts). Cached
// an hour per town; the forecast doesn't move faster than that.
const FORECAST_TTL_MS = 60 * 60 * 1000
const forecastCache = new Map<string, { at: number; hours: Map<number, number> }>()

async function hourlyRain(city: CityCode): Promise<Map<number, number> | null> {
  const hit = forecastCache.get(city)
  if (hit && Date.now() - hit.at < FORECAST_TTL_MS) return hit.hours
  const { lat, lng } = townFor(city)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=precipitation_probability&forecast_days=16&timezone=UTC`
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    if (!res.ok) return hit?.hours ?? null
    const data = await res.json()
    const times: string[] = data.hourly?.time ?? []
    const probs: number[] = data.hourly?.precipitation_probability ?? []
    const hours = new Map<number, number>()
    times.forEach((t, i) => { if (Number.isFinite(probs[i])) hours.set(Date.parse(`${t}:00Z`), probs[i]) })
    forecastCache.set(city, { at: Date.now(), hours })
    return hours
  } catch {
    return hit?.hours ?? null
  }
}

/** Highest chance of rain (0–100) in the hours from `start` for `hours`; null when there's no forecast that far out. */
export async function rainChance(city: CityCode, start: Date, hours = 3): Promise<number | null> {
  const forecast = await hourlyRain(city)
  if (!forecast) return null
  const first = Math.floor(start.getTime() / 3600000) * 3600000
  let max: number | null = null
  for (let h = 0; h < Math.max(1, hours); h++) {
    const p = forecast.get(first + h * 3600000)
    if (p !== undefined) max = Math.max(max ?? 0, p)
  }
  return max
}
