import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyVendorLive } from '@/lib/alerts'
import { sanitizeAccessibility } from '@/lib/accessibility'
import { requireUser } from '@/lib/auth-server'
import { httpsUrl, lat, lng, parseBody, text, z } from '@/lib/validate'
import { CITY_CODES } from '@/lib/regions'
import { popularTimes } from '@/lib/popular-times'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: params.id },
      include: {
        stories: { where: { expiresAt: { gt: new Date() }, hidden: false } },
        reviews: {
          where: { hidden: false },
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true, avatarUrl: true } } }
        },
        experienceStops: { include: { experience: true } },
        flashDeals: { where: { expires: { gt: new Date() } } },
        menuItems: { where: { available: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }
      }
    })
    if (!vendor) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })

    const reviewCount = vendor.reviews.length
    const rating = reviewCount > 0
      ? Math.round((vendor.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviewCount) * 10) / 10
      : undefined

    // Experiences whose route stops here (each listed once).
    const { experienceStops, ...rest } = vendor
    const experiences = Array.from(new Map(experienceStops.map(s => [s.experience.id, s.experience])).values())
    return NextResponse.json({
      ...rest,
      reviews: rest.reviews.map(r => ({ ...r, user: { name: r.user.name.split(' ')[0], avatarUrl: r.user.avatarUrl } })),
      experiences,
      rating,
      reviewCount: reviewCount > 0 ? reviewCount : undefined,
      popularTimes: await popularTimes(vendor.id)
    })
  } catch (error) {
    console.error('Error fetching vendor:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

// PUT — admin edits to a listing. Only the fields below can change.
const schema = z.object({
  name: text(120).min(1),
  category: z.enum(['FOOD', 'DRINKS', 'ACTIVITY', 'TRANSPORT', 'WELLNESS', 'BEACH', 'ACCOMMODATION', 'OTHER']),
  neighborhood: text(120),
  city: z.enum(CITY_CODES as [string, ...string[]]),
  lat, lng,
  priceRange: z.enum(['$', '$$', '$$$', '$$$$']),
  description: text(4000),
  instagram: text(120).nullable(),
  website: httpsUrl.nullable(),
  images: z.array(httpsUrl).max(30),
  videos: z.array(httpsUrl).max(10),
  open: z.boolean(),
  live: z.boolean(),
  isPremium: z.boolean(),
  isTransport: z.boolean(),
  visibleInMarketplace: z.boolean(),
  visibleOnMap: z.boolean(),
  whoThere: z.number().int().min(0).max(10000),
  tipsJar: z.boolean(),
  payItForward: z.boolean(),
  accessibility: z.array(z.string()).max(20),
  hours: z.record(z.array(z.tuple([z.string(), z.string()]))).nullable(),
  phone: text(40).nullable(),
  whatsapp: z.string().regex(/^\d{7,15}$/).nullable(),
  acceptsReservations: z.boolean(),
  isMock: z.boolean()
}).partial()

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request, { role: 'ADMIN' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    const { accessibility, hours, city, ...rest } = parsed.data
    const before = await prisma.vendor.findUnique({ where: { id: params.id }, select: { live: true } })
    if (!before) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const vendor = await prisma.vendor.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(city ? { city: city as never } : {}),
        ...(accessibility ? { accessibility: sanitizeAccessibility(accessibility) } : {}),
        ...(hours !== undefined ? { hours: hours ?? undefined } : {})
      }
    })
    // Going live is the moment saved-vendor alerts exist for (B4).
    if (!before.live && vendor.live) {
      await notifyVendorLive(vendor.id).catch(err => console.error('Live alert failed:', err))
    }
    return NextResponse.json(vendor)
  } catch (error) {
    console.error('Error updating vendor:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request, { role: 'ADMIN' })
  if (!auth.ok) return auth.response
  try {
    await prisma.vendor.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting vendor:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
