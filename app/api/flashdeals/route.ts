import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyFlashDeal } from '@/lib/alerts'
import { canActForVendor, requireUser } from '@/lib/auth-server'
import { id, parseBody, text, z } from '@/lib/validate'
import { listParams } from '@/lib/list-params'

export const dynamic = 'force-dynamic'

// GET ?city= | ?region=  ?limit= — active deals.
export async function GET(request: Request) {
  const { cities, limit } = listParams(request.url)
  try {
    const flashDeals = await prisma.flashDeal.findMany({
      where: {
        expires: { gt: new Date() },
        ...(cities ? { vendor: { city: { in: cities } } } : {})
      },
      take: limit,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            isPremium: true,
            images: true,
            city: true
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

// POST { vendorId, deal, expires } — a vendor (via the vendor app) or an
// admin drops a flash deal; nearby subscribers and anyone who saved the
// vendor get a push (B4).
const schema = z.object({
  vendorId: id,
  deal: text(140).min(1),
  expires: z.string().datetime({ offset: true })
})

export async function POST(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    const expires = new Date(parsed.data.expires)
    if (expires.getTime() <= Date.now()) return NextResponse.json({ error: 'expires must be in the future' }, { status: 400 })
    if (!(await canActForVendor(auth.user, parsed.data.vendorId))) return NextResponse.json({ error: 'Only the vendor or an ETA admin can do that' }, { status: 403 })
    const flashDeal = await prisma.flashDeal.create({
      data: { vendorId: parsed.data.vendorId, deal: parsed.data.deal, expires }
    })
    await notifyFlashDeal(flashDeal.id).catch(err => console.error('Deal alert failed:', err))
    return NextResponse.json(flashDeal)
  } catch (error) {
    console.error('Error creating flash deal:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
