// lib/weather.ts
// Real-time weather for the context engine (B9), from Open-Meteo — free,
// no API key. Cached in memory for 10 minutes per city so every Home
// screen load doesn't hit the upstream API. Returns null when the service
// can't be reached; callers fall back to time-of-day-only suggestions.

import { townFor, type CityCode } from '@/lib/regions'

export type WeatherCondition = 'clear' | 'cloudy' | 'fog' | 'rain' | 'storm'

export interface WeatherNow {
  city: CityCode
  tempC: number
  condition: WeatherCondition
  isRaining: boolean
  /** ≥60% chance of rain in the next 2 hours. */
  rainSoon: boolean
  isDay: boolean
  windKph: number
  label: string
  /** Today's sunset (ISO, with the Jamaica offset). */
  sunsetAt: string | null
  fetchedAt: string
}

const TTL_MS = 10 * 60 * 1000
const cache = new Map<string, { at: number; value: WeatherNow }>()

// WMO weather interpretation codes, as used by Open-Meteo.
function classify(code: number): { condition: WeatherCondition; label: string } {
  if (code >= 95) return { condition: 'storm', label: 'Thunderstorm' }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { condition: 'rain', label: code >= 80 ? 'Rain showers' : code >= 61 ? 'Rain' : 'Drizzle' }
  if (code === 45 || code === 48) return { condition: 'fog', label: 'Fog' }
  if (code >= 2) return { condition: 'cloudy', label: code === 2 ? 'Partly cloudy' : 'Overcast' }
  return { condition: 'clear', label: code === 1 ? 'Mostly clear' : 'Clear' }
}

export async function getWeather(city: WeatherNow['city'] = 'NEGRIL'): Promise<WeatherNow | null> {
  const hit = cache.get(city)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  const { lat, lng } = townFor(city)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    '&current=temperature_2m,precipitation,weather_code,is_day,wind_speed_10m' +
    '&hourly=precipitation_probability&forecast_hours=3&daily=sunset&forecast_days=1&timezone=America%2FJamaica'
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(4000) })
    if (!res.ok) return hit?.value ?? null
    const data = await res.json()
    const cur = data.current
    const { condition, label } = classify(Number(cur.weather_code))
    const probs: number[] = (data.hourly?.precipitation_probability ?? []).slice(0, 2)
    const value: WeatherNow = {
      city,
      tempC: Math.round(Number(cur.temperature_2m)),
      condition,
      isRaining: condition === 'rain' || condition === 'storm' || Number(cur.precipitation) > 0.1,
      rainSoon: probs.some(p => p >= 60),
      isDay: cur.is_day === 1,
      windKph: Math.round(Number(cur.wind_speed_10m)),
      label,
      // Jamaica is UTC-5 year-round (no daylight saving).
      sunsetAt: data.daily?.sunset?.[0] ? new Date(`${data.daily.sunset[0]}:00-05:00`).toISOString() : null,
      fetchedAt: new Date().toISOString()
    }
    cache.set(city, { at: Date.now(), value })
    return value
  } catch {
    return hit?.value ?? null
  }
}

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
