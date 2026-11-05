// GET /api/vendor-app/partners/:id/summary?from=YYYY-MM&to=YYYY-MM — the
// partner's month-by-month numbers (Jamaica months; default: the last six):
//   guests       who joined with its code that month, and how many of its
//                guests were active
//   activity     their QR visits, bookings and event tickets
//   spend        in-app payments at the property's linked vendors (all
//                guests, and its own guests)
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePartnerAccess } from '@/lib/partner-app'

export const dynamic = 'force-dynamic'

const OFFSET = 5 * 3600000
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

function monthStart(key: string): Date {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1) + OFFSET)
}
function nextMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}
function currentMonth(): string {
  return new Date(Date.now() - OFFSET).toISOString().slice(0, 7)
}

const round = (n: number) => Math.round(n * 100) / 100

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requirePartnerAccess(request, params.id)
  if (!access.ok) return access.response
  const q = new URL(request.url).searchParams
  const to = MONTH.test(q.get('to') ?? '') ? q.get('to')! : currentMonth()
  let from = MONTH.test(q.get('from') ?? '') ? q.get('from')! : null
  if (!from) {
    const [y, m] = to.split('-').map(Number)
    const back = new Date(Date.UTC(y, m - 1 - 5, 1))
    from = `${back.getUTCFullYear()}-${String(back.getUTCMonth() + 1).padStart(2, '0')}`
  }
  if (from > to) return NextResponse.json({ error: 'from must be before to' }, { status: 400 })
  const months: string[] = []
  for (let k = from; k <= to && months.length < 24; k = nextMonth(k)) months.push(k)

  const propertyId = access.property.id
  try {
    const [guests, linked] = await Promise.all([
      prisma.user.findMany({ where: { partnerPropertyId: propertyId }, select: { id: true } }),
      prisma.vendor.findMany({ where: { partnerPropertyId: propertyId }, select: { id: true, name: true } })
    ])
    const guestIds = guests.map(g => g.id)
    const vendorIds = linked.map(v => v.id)

    const rows = await Promise.all(months.map(async month => {
      const range = { gte: monthStart(month), lt: monthStart(nextMonth(month)) }
      const byGuests = { userId: { in: guestIds } }
      const [joined, visits, visitors, bookings, tickets, spendAll, spendGuests, bookers, ticketHolders] = await Promise.all([
        prisma.user.count({ where: { partnerPropertyId: propertyId, partnerJoinedAt: range } }),
        prisma.checkIn.count({ where: { ...byGuests, createdAt: range } }),
        prisma.checkIn.groupBy({ by: ['userId'], where: { ...byGuests, createdAt: range } }),
        prisma.booking.aggregate({ where: { ...byGuests, createdAt: range, status: { not: 'CANCELLED' } }, _count: { _all: true }, _sum: { totalPrice: true } }),
        prisma.ticket.aggregate({ where: { ...byGuests, createdAt: range, status: { not: 'CANCELLED' } }, _count: { _all: true }, _sum: { quantity: true, totalPrice: true } }),
        prisma.transaction.aggregate({ where: { vendorId: { in: vendorIds }, type: 'PAYMENT', status: 'COMPLETED', createdAt: range }, _sum: { amount: true }, _count: { _all: true } }),
        prisma.transaction.aggregate({ where: { ...byGuests, vendorId: { in: vendorIds }, type: 'PAYMENT', status: 'COMPLETED', createdAt: range }, _sum: { amount: true } }),
        prisma.booking.groupBy({ by: ['userId'], where: { ...byGuests, createdAt: range, status: { not: 'CANCELLED' } } }),
        prisma.ticket.groupBy({ by: ['userId'], where: { ...byGuests, createdAt: range, status: { not: 'CANCELLED' } } })
      ])
      const active = new Set([...visitors, ...bookers, ...ticketHolders].map(r => r.userId)).size
      return {
        month,
        guests: { joinedWithCode: joined, active },
        activity: {
          visits,
          bookings: bookings._count._all,
          bookingValue: round(bookings._sum.totalPrice ?? 0),
          eventTickets: tickets._sum.quantity ?? 0,
          ticketValue: round(tickets._sum.totalPrice ?? 0)
        },
        spend: {
          linkedVendors: round(spendAll._sum.amount ?? 0),
          linkedVendorPayments: spendAll._count._all,
          byGuests: round(spendGuests._sum.amount ?? 0)
        }
      }
    }))

    return NextResponse.json({ property: access.property, currency: 'USD', totalGuests: guestIds.length, linkedVendors: linked, months: rows })
  } catch (error) {
    console.error('Partner summary failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
