// lib/arrival-client.ts — deciding, once per device, whether the first open
// is an arrival (airport or hotel, lib/arrival.ts) and handing what we found
// to the arrival flow (app/arrival).
'use client'

import type { WelcomeReward } from '@/lib/welcome'
import type { ArrivalPlace } from '@/lib/arrival'

const CHECKED_KEY = 'eta_arrival_checked'
const DONE_KEY = 'eta_arrival_done'
const PAYLOAD_KEY = 'eta_arrival'

export interface ArrivalPayload { place: ArrivalPlace; city: string; reward: WelcomeReward | null }

function position(timeoutMs: number): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null)
    const timer = setTimeout(() => resolve(null), timeoutMs + 500)
    navigator.geolocation.getCurrentPosition(
      p => { clearTimeout(timer); resolve({ lat: p.coords.latitude, lng: p.coords.longitude }) },
      () => { clearTimeout(timer); resolve(null) },
      { timeout: timeoutMs, maximumAge: 5 * 60 * 1000 }
    )
  })
}

/** "arrival" when this first open is at an airport or hotel (and stores what was found). Runs once per device. */
export async function checkArrivalOnce(): Promise<'arrival' | 'none'> {
  try { if (localStorage.getItem(CHECKED_KEY)) return 'none' } catch { return 'none' }
  const pos = await position(8000)
  try { localStorage.setItem(CHECKED_KEY, String(Date.now())) } catch {}
  if (!pos) return 'none'
  try {
    const res = await fetch(`/api/arrival?lat=${pos.lat}&lng=${pos.lng}`)
    const data = res.ok ? await res.json() : null
    if (!data?.place) return 'none'
    sessionStorage.setItem(PAYLOAD_KEY, JSON.stringify(data))
    return 'arrival'
  } catch {
    return 'none'
  }
}

export function readArrival(): ArrivalPayload | null {
  try { return JSON.parse(sessionStorage.getItem(PAYLOAD_KEY) || 'null') } catch { return null }
}

export function finishArrival() {
  try { localStorage.setItem(DONE_KEY, String(Date.now())) } catch {}
}

/** Whether the arrival flow already set where they're staying. */
export function arrivalDone(): boolean {
  try { return Boolean(localStorage.getItem(DONE_KEY)) } catch { return false }
}

// ---------- Arrival from a trip stage (lib/stage.ts) ----------
// The countdown hands its trip to the arrival flow when they land: what's
// already done is skipped (stay set → no stay screen; ride pre-booked →
// "Your Driver Is Waiting"; a partner hotel → straight to Checked In), and
// returning travelers get "Welcome back to Jamaica" with their
// welcome-back gift. The payload is cached during the countdown so it
// still works offline at the airport.

export interface ArrivalRide {
  vendor: { name: string; phone: string | null; whatsapp: string | null }
  driverName: string | null
  driverPhoto: string | null
  driverPhone: string | null
  vehicle: string
  plate: string | null
  meetPoint: string | null
  pickupAt: string
}

export interface ArrivalTripInfo {
  tripId: string
  kind: 'VISIT' | 'GETAWAY'
  returning: boolean
  /** The stay's already set: skip "Where are you staying?". */
  stay: { name: string; city: string; lat: number | null; lng: number | null; partnerCode: string | null } | null
  ride: ArrivalRide | null
  /** Arrive today; only the leave date is asked when this is missing. */
  end: string | null
}

export interface TripArrivalPayload extends ArrivalPayload { trip?: ArrivalTripInfo }

const CACHE_KEY = 'eta_arrival_cache'

export function readTripArrival(): TripArrivalPayload | null {
  return readArrival() as TripArrivalPayload | null
}

/** Hands a payload to the arrival flow (app/arrival reads it from sessionStorage). */
export function handToArrival(payload: TripArrivalPayload) {
  try { sessionStorage.setItem(PAYLOAD_KEY, JSON.stringify(payload)); sessionStorage.removeItem('eta_arrival_flow') } catch {}
}

/** Keeps the payload (and the arrival screen) on the device for the airport. */
export async function cacheArrival(payload: TripArrivalPayload) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...payload, savedAt: Date.now() })) } catch { return }
  try {
    const { registerServiceWorker } = await import('@/lib/alerts-client')
    const reg = await registerServiceWorker()
    const worker = reg?.active ?? navigator.serviceWorker?.controller
    if (!worker) return
    const assets = performance.getEntriesByType('resource').map(e => e.name).filter(u => u.startsWith(window.location.origin) && u.includes('/_next/static/'))
    const images = [payload.place.image, payload.trip?.ride?.driverPhoto].filter((u): u is string => Boolean(u))
    worker.postMessage({ type: 'CACHE_TRIP', urls: Array.from(new Set(['/arrival', '/logo-tb.png', ...assets, ...images])) })
  } catch {}
}

export function cachedArrival(tripId: string): TripArrivalPayload | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    return c && c.trip?.tripId === tripId ? c : null
  } catch { return null }
}
