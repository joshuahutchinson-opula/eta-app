// GET ?city=NEGRIL — the rewards available in that region: island-wide ones
// plus the region's own, each with the vendors that honour it.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isCityCode } from '@/lib/regions'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get('city')
  try {
    const rewards = await prisma.reward.findMany({
      where: { active: true, ...(isCityCode(city) ? { OR: [{ city: null }, { city }] } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { cost: 'asc' }],
      include: { vendors: { include: { vendor: { select: { id: true, name: true } } } } }
    })
    return NextResponse.json(rewards.map(({ vendors, ...r }) => ({ ...r, vendors: vendors.map(v => v.vendor) })))
  } catch (error) {
    console.error('Error fetching rewards:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
