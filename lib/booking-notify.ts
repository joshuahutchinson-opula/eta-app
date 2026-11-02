// lib/booking-notify.ts — booking confirmations and reminders (inbox, push
// if enabled, email), plus event reminders. The reminder passes run from
// /api/cron/reminders every ~15 minutes; each notification has a unique key
// per user so running them again never double-sends.
import { prisma } from '@/lib/prisma'
import { notifyUser } from '@/lib/notify'
import { bookingConfirmationEmail, bookingReminderEmail, receiptEmail, type BookingEmailInfo } from '@/lib/email'
import { absoluteUrl } from '@/lib/site-url'
import { bookingCode } from '@/lib/pricing'
import { formatMoney } from '@/lib/money'

const TZ = 'America/Jamaica'
const HOUR = 3600000

/** Event reminders go out this long before the start. */
export const EVENT_REMINDER_LEAD_MS = 2 * HOUR

const BOOKING_INCLUDE = {
  user: { select: { email: true } },
  experience: { select: { name: true, meetingPoint: true } },
  accommodation: { select: { name: true } },
  vendor: { select: { name: true } },
  trip: { select: { name: true } }
} as const

type BookingRow = NonNullable<Awaited<ReturnType<typeof loadBooking>>>

function loadBooking(id: string) {
  return prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE })
}

function info(b: BookingRow): BookingEmailInfo {
  const title = b.experience?.name ?? b.accommodation?.name ?? b.trip?.name ?? b.vendor?.name ?? 'Your booking'
  return {
    title,
    when: b.date.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ }),
    partySize: b.partySize,
    total: formatMoney(b.totalPrice, 'USD'),
    code: bookingCode(b.id),
    meetingPoint: b.experience?.meetingPoint ?? null,
    bookingUrl: absoluteUrl('/bookings')
  }
}

/** Right after a booking is made (and paid, when there's a transaction). */
export async function onBookingCreated(bookingId: string, transactionId?: string | null): Promise<void> {
  try {
    const b = await loadBooking(bookingId)
    if (!b) return
    const i = info(b)
    await notifyUser(b.userId, 'bookings', `booking:${b.id}:confirmed`, {
      title: `Booked: ${i.title}`,
      body: `${i.when} · ${i.partySize} ${i.partySize === 1 ? 'person' : 'people'} · ticket ${i.code}`,
      url: '/bookings'
    }, { email: bookingConfirmationEmail(b.user.email, i) })
    if (transactionId) await sendReceipt(transactionId)
  } catch (error) {
    console.error('Booking confirmation failed:', error)
  }
}

export async function sendReceipt(transactionId: string): Promise<void> {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId }, include: { user: { select: { email: true, notifyBookings: true } } } })
  if (!tx || !tx.user.notifyBookings) return
  const { send } = await import('@/lib/email')
  await send(receiptEmail(tx.user.email, {
    description: tx.description ?? 'ETA payment',
    amount: formatMoney(tx.amount, 'USD'),
    date: tx.createdAt.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ }),
    rail: tx.rail ?? 'ETA Wallet',
    ref: tx.id.slice(-10).toUpperCase(),
    receiptUrl: absoluteUrl(`/receipt/${tx.id}`)
  }))
}

/** Day-before (20–26 h out) and one-hour (within 70 min) reminders. */
export async function runBookingReminders(now = new Date()): Promise<{ dayBefore: number; hourBefore: number }> {
  const t = now.getTime()
  const upcoming = await prisma.booking.findMany({
    where: { status: 'CONFIRMED', date: { gt: now, lte: new Date(t + 26 * HOUR) }, accommodationId: null },
    include: BOOKING_INCLUDE
  })
  let dayBefore = 0
  let hourBefore = 0
  for (const b of upcoming) {
    const until = b.date.getTime() - t
    const i = info(b)
    if (until > 20 * HOUR) {
      const sent = await notifyUser(b.userId, 'bookings', `booking:${b.id}:day`, {
        title: `Tomorrow: ${i.title}`,
        body: `${i.when}${i.meetingPoint ? ` · meet at ${i.meetingPoint}` : ''}`,
        url: '/bookings'
      }, { email: bookingReminderEmail(b.user.email, i, 'day') })
      if (sent) dayBefore++
    } else if (until <= 70 * 60000) {
      const sent = await notifyUser(b.userId, 'bookings', `booking:${b.id}:hour`, {
        title: `Starting soon: ${i.title}`,
        body: `${i.when}${i.meetingPoint ? ` · meet at ${i.meetingPoint}` : ''}`,
        url: '/bookings'
      }, { email: bookingReminderEmail(b.user.email, i, 'hour') })
      if (sent) hourBefore++
    }
  }
  return { dayBefore, hourBefore }
}

/** Saved, interested and ticket-holding users hear about an event shortly before it starts. */
export async function runEventReminders(now = new Date()): Promise<number> {
  const events = await prisma.event.findMany({
    where: { startAt: { gt: now, lte: new Date(now.getTime() + EVENT_REMINDER_LEAD_MS) } },
    select: { id: true, title: true, venueName: true, startAt: true, interests: { select: { userId: true } }, tickets: { where: { status: 'CONFIRMED' }, select: { userId: true } } }
  })
  let sent = 0
  for (const ev of events) {
    const saved = await prisma.saved.findMany({ where: { kind: 'EVENT', refId: ev.id }, select: { userId: true } })
    const userIds = new Set([...saved, ...ev.interests, ...ev.tickets].map(r => r.userId))
    const time = ev.startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
    for (const userId of Array.from(userIds)) {
      if (await notifyUser(userId, 'events', `event:${ev.id}:soon`, { title: `${ev.title} starts at ${time}`, body: ev.venueName, url: `/events/${ev.id}` })) sent++
    }
  }
  return sent
}
