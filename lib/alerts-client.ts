// lib/alerts-client.ts
'use client'

import { getCurrentUser } from '@/lib/auth-client'

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    return reg
  } catch {
    return null
  }
}

function savedVendorIds(): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem('savedVendors') || '[]')
    return Array.isArray(ids) ? ids : []
  } catch {
    return []
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { maximumAge: 10 * 60 * 1000, timeout: 8000 }
    )
  })
}

async function existingSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  return reg ? reg.pushManager.getSubscription() : null
}

export async function alertsEnabled(): Promise<boolean> {
  return Boolean(await existingSubscription()) && Notification.permission === 'granted'
}

async function post(sub: PushSubscription, extra: Record<string, unknown>) {
  const res = await fetch('/api/alerts/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), userId: getCurrentUser()?.id, savedVendorIds: savedVendorIds(), ...extra })
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Sumth nah wuk')
  return res.json()
}

/** Opt in: permission prompt, push subscription, saved vendors + location for "nearby". */
export async function enableAlerts(prefs: { liveAlerts: boolean; dealAlerts: boolean }): Promise<void> {
  if (!pushSupported()) {
    throw new Error('This browser can’t receive alerts. On iPhone, add ETA to your Home Screen first.')
  }
  const keyRes = await fetch('/api/alerts/subscribe')
  const { publicKey } = await keyRes.json()
  if (!publicKey) throw new Error('Alerts aren’t switched on for this server yet.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications are blocked — allow them in your browser settings.')
  const reg = await registerServiceWorker()
  if (!reg) throw new Error('Sumth nah wuk')
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  }))
  const pos = prefs.dealAlerts ? await currentPosition() : null
  await post(sub, { ...prefs, ...(pos ?? {}) })
}

export async function disableAlerts(): Promise<void> {
  const sub = await existingSubscription()
  if (!sub) return
  await fetch('/api/alerts/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {})
  await sub.unsubscribe().catch(() => {})
}

/** Keep the server's copy of saved vendors / prefs / location current. No-op when not opted in. */
export async function syncAlerts(extra: Record<string, unknown> = {}): Promise<void> {
  try {
    const sub = await existingSubscription()
    if (!sub) return
    await post(sub, extra)
  } catch {
    // best effort
  }
}

export async function refreshAlertLocation(): Promise<void> {
  const sub = await existingSubscription()
  if (!sub) return
  const pos = await currentPosition()
  if (pos) await syncAlerts(pos)
}
