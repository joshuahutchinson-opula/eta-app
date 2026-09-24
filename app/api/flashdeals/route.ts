import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyFlashDeal } from '@/lib/alerts'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const flashDeals = await prisma.flashDeal.findMany({
      where: {
        expires: { gt: new Date() }
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            isPremium: true,
            images: true
          }
        }
      },
      orderBy: { expires: 'asc' }
    })

    return NextResponse.json(flashDeals)
  } catch (error) {
    console.error('Error fetching flash deals:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}

// POST { vendorId, deal, expires } — a vendor drops a flash deal; nearby
// subscribers and anyone who saved the vendor get a push (B4).
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const expires = typeof body.expires === 'string' ? new Date(body.expires) : null
    if (typeof body.vendorId !== 'string' || typeof body.deal !== 'string' || !body.deal.trim() || !expires || isNaN(expires.getTime()) || expires.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'vendorId, deal and a future expires are required' }, { status: 400 })
    }
    const flashDeal = await prisma.flashDeal.create({
      data: { vendorId: body.vendorId, deal: body.deal.trim().slice(0, 140), expires }
    })
    await notifyFlashDeal(flashDeal.id).catch(err => console.error('Deal alert failed:', err))
    return NextResponse.json(flashDeal)
  } catch (error) {
    console.error('Error creating flash deal:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
