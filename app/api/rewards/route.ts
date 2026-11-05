// GET ?city=NEGRIL — the rewards available in that region: island-wide ones
// plus the region's own, each with the vendors that honour it. Rewards that
// need a visit carry `locked` for the signed-in caller until they've
// QR-scanned at one of those vendors. Welcome perks aren't in the catalog.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isCityCode } from '@/lib/regions'
import { userIdFromRequest } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get('city')
  try {
    const rewards = await prisma.reward.findMany({
      where: { active: true, kind: 'catalog', ...(isCityCode(city) ? { OR: [{ city: null }, { city }] } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { cost: 'asc' }],
      include: { vendors: { include: { vendor: { select: { id: true, name: true } } } } }
    })
    const userId = userIdFromRequest(request)
    const visited = new Set(userId
      ? (await prisma.checkIn.findMany({ where: { userId, method: 'qr', vendorId: { not: null } }, select: { vendorId: true }, distinct: ['vendorId'] })).map(c => c.vendorId!)
      : [])
    return NextResponse.json(rewards.map(({ vendors, ...r }) => ({
      ...r,
      vendors: vendors.map(v => v.vendor),
      locked: r.requiresVisit && !vendors.some(v => visited.has(v.vendorId))
    })))
  } catch (error) {
    console.error('Error fetching rewards:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
