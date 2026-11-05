// lib/notify.ts — account notifications: one entry in the user's inbox
// (NotificationLog with userId), a push to each of their devices, and
// optionally an email, plus a WhatsApp copy of booking and crew messages for
// travelers who opted in (lib/whatsapp.ts). Every sender goes through notifyUser(), which checks
// the user's preference for that type first and skips everything when it's
// off. Device-level alerts (saved vendor live, nearby flash deals) live in
// lib/alerts.ts and check the same preferences.
import webpush from 'web-push'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { pushConfigured, type AlertPayload } from '@/lib/alerts'
import { send, type EmailMessage } from '@/lib/email'
import { sendWhatsApp, type WhatsAppKind } from '@/lib/whatsapp'
import { absoluteUrl } from '@/lib/site-url'

export type NotifyType = 'bookings' | 'events' | 'deals' | 'live' | 'crew' | 'trips'

export const PREF_FIELD = {
  bookings: 'notifyBookings',
  events: 'notifyEvents',
  deals: 'notifyDeals',
  live: 'notifyLive',
  crew: 'notifyCrew',
  trips: 'notifyTrips'
} as const satisfies Record<NotifyType, keyof Prisma.UserSelect>

export async function wantsNotification(userId: string, type: NotifyType): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { deletedAt: true, [PREF_FIELD[type]]: true } })
  return Boolean(user && !user.deletedAt && (user as Record<string, unknown>)[PREF_FIELD[type]] !== false)
}

/** Booking and crew notifications go to WhatsApp too; reminders are told apart by key. */
function whatsappKind(type: NotifyType, key: string): WhatsAppKind | null {
  if (type === 'bookings') return /:(day|hour)$/.test(key) ? 'BOOKING_REMINDER' : 'BOOKING_CONFIRMED'
  if (type === 'crew') return 'CREW'
  return null
}

/**
 * Sends once per (user, key): the inbox row's unique key is what makes
 * re-running a reminder job safe. Returns true if it was new.
 */
export async function notifyUser(
  userId: string,
  type: NotifyType,
  key: string,
  payload: Omit<AlertPayload, 'tag'> & { tag?: string },
  opts: { email?: EmailMessage; whatsapp?: WhatsAppKind | false } = {}
): Promise<boolean> {
  if (!(await wantsNotification(userId, type))) return false
  try {
    await prisma.notificationLog.create({ data: { userId, key, type, title: payload.title, body: payload.body, url: payload.url } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false
    throw e
  }

  if (pushConfigured()) {
    const subs = await prisma.alertSubscription.findMany({ where: { userId } })
    await Promise.all(subs.map(async sub => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ tag: payload.tag ?? key, ...payload }),
          { TTL: 6 * 3600 }
        )
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await prisma.alertSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        else console.error('Push failed:', status, (err as Error).message)
      }
    }))
  }

  if (opts.email) await send(opts.email)

  const kind = opts.whatsapp === false ? null : opts.whatsapp ?? whatsappKind(type, key)
  if (kind) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { whatsappNumber: true, notifyWhatsapp: true } })
    if (user?.notifyWhatsapp && user.whatsappNumber) {
      await sendWhatsApp({ to: user.whatsappNumber, kind, title: payload.title, detail: payload.body, url: payload.url ? absoluteUrl(payload.url) : undefined })
    }
  }
  return true
}
