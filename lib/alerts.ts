// lib/alerts.ts
// Time-sensitive local alerts (B4): a push when a vendor you saved goes
// live, or when a flash deal drops near you. Driven by the same live /
// whoThere / FlashDeal data the app already shows.
//
// Delivery is Web Push (VAPID). Every alert is logged per subscription in
// NotificationLog, so re-running a sweep never double-notifies.

import webpush from 'web-push'
import { prisma } from '@/lib/prisma'

let configured: boolean | null = null

export function pushConfigured(): boolean {
  if (configured !== null) return configured
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) {
    configured = false
    return false
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:alerts@localhost', pub, priv)
  configured = true
  return true
}

export interface AlertPayload {
  title: string
  body: string
  url: string
  tag: string
  image?: string
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

/** Sends once per (subscription, key). Returns true if a push went out. */
async function deliver(sub: { id: string; endpoint: string; p256dh: string; auth: string }, key: string, payload: AlertPayload): Promise<boolean> {
  try {
    await prisma.notificationLog.create({ data: { subscriptionId: sub.id, key } })
  } catch {
    return false // already sent (unique constraint)
  }
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 60 * 60 })
    return true
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) {
      // Subscription expired or was revoked in the browser.
      await prisma.alertSubscription.delete({ where: { id: sub.id } }).catch(() => {})
    } else {
      await prisma.notificationLog.deleteMany({ where: { subscriptionId: sub.id, key } }).catch(() => {})
      console.error('Push failed:', status, (err as Error).message)
    }
    return false
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** A saved vendor just went live: alert everyone who saved it (max once per vendor per day). */
export async function notifyVendorLive(vendorId: string): Promise<number> {
  if (!pushConfigured()) return 0
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, name: true, live: true, whoThere: true, neighborhood: true, images: true } })
  if (!vendor?.live) return 0
  const subs = await prisma.alertSubscription.findMany({ where: { liveAlerts: true, savedVendorIds: { has: vendorId } } })
  let sent = 0
  for (const sub of subs) {
    const ok = await deliver(sub, `live:${vendorId}:${today()}`, {
      title: `${vendor.name} is live now`,
      body: vendor.whoThere > 0 ? `${vendor.whoThere} people there right now · ${vendor.neighborhood}` : `Happening now in ${vendor.neighborhood}`,
      url: `/vendor/${vendor.id}`,
      tag: `live-${vendor.id}`,
      image: vendor.images[0]
    })
    if (ok) sent++
  }
  return sent
}

/** A flash deal: alert subscribers within their radius, or who saved the vendor. */
export async function notifyFlashDeal(dealId: string): Promise<number> {
  if (!pushConfigured()) return 0
  const deal = await prisma.flashDeal.findUnique({
    where: { id: dealId },
    include: { vendor: { select: { id: true, name: true, lat: true, lng: true, images: true } } }
  })
  if (!deal || deal.expires.getTime() <= Date.now()) return 0
  const subs = await prisma.alertSubscription.findMany({ where: { dealAlerts: true } })
  let sent = 0
  for (const sub of subs) {
    const saved = sub.savedVendorIds.includes(deal.vendor.id)
    const km = sub.lat !== null && sub.lng !== null ? distanceKm(sub.lat, sub.lng, deal.vendor.lat, deal.vendor.lng) : null
    if (!saved && (km === null || km > sub.radiusKm)) continue
    const mins = Math.max(1, Math.round((deal.expires.getTime() - Date.now()) / 60000))
    const ok = await deliver(sub, `deal:${deal.id}`, {
      title: `Flash deal at ${deal.vendor.name}`,
      body: `${deal.deal}${km !== null ? ` · ${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} away` : ''} · ends in ${mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h`}`,
      url: `/vendor/${deal.vendor.id}`,
      tag: `deal-${deal.id}`,
      image: deal.vendor.images[0]
    })
    if (ok) sent++
  }
  return sent
}

/**
 * Catch-up pass over current live vendors and active deals — for vendors
 * that went live outside the API (e.g. edited directly in the database) and
 * for subscribers who moved into range. Safe to run as often as you like.
 */
export async function runAlertSweep(): Promise<{ live: number; deals: number }> {
  if (!pushConfigured()) return { live: 0, deals: 0 }
  const [liveVendors, deals] = await Promise.all([
    prisma.vendor.findMany({ where: { live: true }, select: { id: true } }),
    prisma.flashDeal.findMany({ where: { expires: { gt: new Date() } }, select: { id: true } })
  ])
  let live = 0
  let dealCount = 0
  for (const v of liveVendors) live += await notifyVendorLive(v.id)
  for (const d of deals) dealCount += await notifyFlashDeal(d.id)
  return { live, deals: dealCount }
}
