// GET /api/vendor-app/vendors/:id/visits?from=&to=&limit= — proof of visit
// for the vendor app: every QR check-in at this vendor (first name + initial
// only), with totals. from/to are ISO dates; defaults to the last 30 days.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVendorAccess } from '@/lib/vendor-app'

export const dynamic = 'force-dynamic'

function shortName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/)
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const q = new URL(request.url).searchParams
  const to = q.get('to') ? new Date(q.get('to')!) : new Date()
  const from = q.get('from') ? new Date(q.get('from')!) : new Date(to.getTime() - 30 * 86400000)
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return NextResponse.json({ error: 'from/to must be ISO dates' }, { status: 400 })
  const limit = Math.min(500, Math.max(1, Number(q.get('limit')) || 100))
  try {
    const where = { vendorId: access.vendor.id, method: 'qr', createdAt: { gte: from, lte: to } }
    const [visits, total, unique] = await Promise.all([
      prisma.checkIn.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, include: { user: { select: { name: true, homeCountry: true } } } }),
      prisma.checkIn.count({ where }),
      prisma.checkIn.groupBy({ by: ['userId'], where })
    ])
    return NextResponse.json({
      vendor: access.vendor,
      from, to,
      totals: { visits: total, uniqueVisitors: unique.length },
      visits: visits.map(v => ({ id: v.id, at: v.createdAt, visitor: shortName(v.user.name), homeCountry: v.user.homeCountry, distanceM: v.distanceM, pointsAwarded: v.points }))
    })
  } catch (error) {
    console.error('Error listing visits:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
