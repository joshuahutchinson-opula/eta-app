// lib/auth-client.ts — the signed-in session on this device: the JWT
// (eta_token) and a cached copy of the user (eta_user).
'use client'

export interface CurrentUser {
  id: string
  email: string
  name: string
  role: string
  level: string
  points: number
  walletBalance: number
  streak: number
  city: string
  avatarUrl?: string | null
  bio?: string | null
  homeCountry?: string | null
  createdAt?: string
  emailVerifiedAt?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  leaderboardOptIn?: boolean
  notifyBookings?: boolean
  notifyEvents?: boolean
  notifyDeals?: boolean
  notifyLive?: boolean
  notifyCrew?: boolean
}

const TOKEN_KEY = 'eta_token'
const USER_KEY = 'eta_user'
export const AUTH_EVENT = 'eta-auth-change'

/** Stores a fresh session (login, register, OAuth, password reset). */
export function signIn(token: string, user: CurrentUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: 'signin' }))
}

export function getCurrentUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setCurrentUser(user: CurrentUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function isVerified(user: CurrentUser | null): boolean {
  return Boolean(user?.emailVerifiedAt)
}

/** Seconds-since-epoch expiry from the token's payload, or null if unreadable. */
export function tokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

// What belongs to the person, not the device: removed on log-out. Theme,
// language, currency, region and low-data mode stay.
const USER_KEYS = [TOKEN_KEY, USER_KEY, 'eta_my_trips', 'eta_active_trip', 'savedVendors', 'savedBundles', 'savedEvents', 'eta_saved_synced', 'eta_recent_searches', 'eta_vibe', 'alertPrefs', 'eta_offline_bookings']
const USER_PREFIXES = ['eta_trip_member_', 'eta_trip_cache_', 'eta_offline_']

function clearLocalSession() {
  try {
    for (const k of USER_KEYS) localStorage.removeItem(k)
    const all: string[] = []
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) all.push(k) }
    for (const k of all) if (USER_PREFIXES.some(p => k.startsWith(p))) localStorage.removeItem(k)
    sessionStorage.clear()
  } catch {}
}

async function clearDeviceData() {
  // Push subscription and offline copies of trips, tickets and receipts.
  try {
    const reg = await navigator.serviceWorker?.getRegistration('/sw.js')
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await fetch('/api/alerts/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {})
      await sub.unsubscribe().catch(() => {})
    }
    navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_USER' })
    if (typeof caches !== 'undefined') {
      for (const key of await caches.keys()) if (key.startsWith('eta-trip') || key.startsWith('eta-user')) await caches.delete(key)
    }
  } catch {}
}

/** Log out everywhere this token works: revoke it on the server, then wipe this device's copy. */
export async function logout(): Promise<void> {
  const token = getAuthToken()
  if (token) {
    await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
  }
  await clearDeviceData()
  clearLocalSession()
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: 'signout' }))
}

let expiring = false

/** The session ran out (or was revoked): sign out cleanly and say why on the login screen. */
export function expireSession() {
  if (expiring || typeof window === 'undefined') return
  expiring = true
  clearLocalSession()
  clearDeviceData().finally(() => {
    window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: 'expired' }))
    const back = window.location.pathname + window.location.search
    window.location.replace(`/login?expired=1&next=${encodeURIComponent(back)}`)
  })
}
