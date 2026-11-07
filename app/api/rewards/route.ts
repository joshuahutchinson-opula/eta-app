// GET ?city=NEGRIL — the rewards available in that region: island-wide ones
// plus the region's own, each with the vendors that honour it, its filter
// category (vendor | insider | events | eta), its tier, and how many are
// left today under its cap. Local-flavoured perks (audience "local") are
// only listed for locals. Rewards that need a visit carry `locked` for the
// signed-in caller until they've QR-scanned at one of those vendors.
// Welcome perks aren't in the catalog.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isCityCode } from '@/lib/regions'
import { userIdFromRequest } from '@/lib/auth-server'
import { capsLeft } from '@/lib/vouchers'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get('city')
  try {
    const userId = userIdFromRequest(request)
    const me = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { travelerType: true } }) : null
    const rewards = await prisma.reward.findMany({
      where: {
        active: true, kind: 'catalog',
        ...(me?.travelerType === 'LOCAL' ? {} : { audience: 'all' }),
        ...(isCityCode(city) ? { OR: [{ city: null }, { city }] } : {})
      },
      orderBy: [{ sortOrder: 'asc' }, { cost: 'asc' }],
      include: { vendors: { include: { vendor: { select: { id: true, name: true, images: true, isPremium: true } } } } }
    })
    const visited = new Set(userId
      ? (await prisma.checkIn.findMany({ where: { userId, method: 'qr', vendorId: { not: null } }, select: { vendorId: true }, distinct: ['vendorId'] })).map(c => c.vendorId!)
      : [])
    const events = await prisma.event.findMany({ where: { id: { in: rewards.map(r => r.eventId).filter((x): x is string => Boolean(x)) } }, select: { id: true, title: true, startAt: true } })
    const out = await Promise.all(rewards.map(async ({ vendors, ...r }) => ({
      ...r,
      vendors: vendors.map(v => ({ id: v.vendor.id, name: v.vendor.name, image: v.vendor.images[0] ?? null, premium: v.vendor.isPremium })),
      event: events.find(e => e.id === r.eventId) ?? null,
      left: await capsLeft(r),
      locked: r.requiresVisit && !vendors.some(v => visited.has(v.vendorId))
    })))
    return NextResponse.json(out)
  } catch (error) {
    console.error('Error fetching rewards:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
