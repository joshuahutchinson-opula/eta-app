// GET ?city=NEGRIL — live stories for the selected region (vendor stories
// by the vendor's town, traveler stories by where they were posted), plus
// vendor-approved Instagram story mentions (lib/instagram.ts), each with
// `seen` for the signed-in viewer and `action`: where its "Go here" (a
// vendor) or "Book this" (an event) button leads.
// POST { caption?, imageUrl, videoUrl?, city, placeVendorId?, eventId? } —
// post a 24-hour story (signed in, verified email). Without a place, it's
// tagged with the vendor the poster QR-scanned at in the last few hours.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, userIdFromRequest } from '@/lib/auth-server'
import { isCityCode, CITY_CODES } from '@/lib/regions'
import { rateLimit } from '@/lib/rate-limit'
import { approvedMentionStories } from '@/lib/instagram'
import { storyAction } from '@/lib/story-action'
import { httpsUrl, id, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

/** A traveler story posted within this long of a QR scan is tagged with that vendor. */
const AUTO_TAG_MS = 3 * 3600000

export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get('city')
  const userId = userIdFromRequest(request)
  try {
    const [stories, mentions] = await Promise.all([
      prisma.story.findMany({
        where: {
          expiresAt: { gt: new Date() },
          hidden: false,
          ...(isCityCode(city) ? { OR: [{ vendor: { city } }, { vendorId: null, city }] } : {})
        },
        include: {
          vendor: { select: { name: true, isPremium: true, images: true, city: true } },
          user: { select: { name: true, avatarUrl: true } },
          placeVendor: { select: { id: true, name: true } },
          event: { select: { id: true, title: true } },
          ...(userId ? { views: { where: { userId }, select: { id: true } } } : {})
        },
        orderBy: { createdAt: 'desc' }
      }),
      approvedMentionStories(isCityCode(city) ? { vendorCity: city } : {})
    ])
    const own = stories.map(s => {
      const { views, user, placeVendor, event, ...rest } = s as typeof s & { views?: unknown[] }
      return { ...rest, source: 'eta' as const, user: user ? { name: user.name.split(' ')[0], avatarUrl: user.avatarUrl } : null, seen: Boolean(views?.length), action: storyAction(s) }
    })
    const ig = mentions.map(m => ({ ...m, action: { kind: 'vendor' as const, id: m.vendorId, name: m.vendor.name } }))
    return NextResponse.json([...own, ...ig].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
  } catch (error) {
    console.error('Error fetching stories:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

const schema = z.object({
  caption: text(200).optional(),
  imageUrl: httpsUrl,
  videoUrl: httpsUrl.optional(),
  city: z.enum(CITY_CODES as [string, ...string[]]),
  placeVendorId: id.optional(),
  eventId: id.optional()
})

export async function POST(request: Request) {
  const auth = await requireUser(request, { verified: true, message: 'Log in to post a story' })
  if (!auth.ok) return auth.response
  const limited = rateLimit('story', auth.user.id)
  if (limited) return limited
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    const { placeVendorId, eventId } = parsed.data
    const [place, event] = await Promise.all([
      placeVendorId ? prisma.vendor.findUnique({ where: { id: placeVendorId }, select: { id: true } }) : null,
      eventId ? prisma.event.findUnique({ where: { id: eventId }, select: { id: true } }) : null
    ])
    if (placeVendorId && !place) return NextResponse.json({ error: 'placeVendorId: no such vendor', code: 'INVALID_BODY' }, { status: 400 })
    if (eventId && !event) return NextResponse.json({ error: 'eventId: no such event', code: 'INVALID_BODY' }, { status: 400 })
    const recentScan = !place && !event
      ? await prisma.checkIn.findFirst({ where: { userId: auth.user.id, method: 'qr', vendorId: { not: null }, createdAt: { gte: new Date(Date.now() - AUTO_TAG_MS) } }, orderBy: { createdAt: 'desc' }, select: { vendorId: true } })
      : null
    const story = await prisma.story.create({
      data: {
        content: parsed.data.caption ?? '',
        type: parsed.data.videoUrl ? 'video' : 'user',
        imageUrl: parsed.data.imageUrl,
        videoUrl: parsed.data.videoUrl ?? null,
        city: parsed.data.city as never,
        userId: auth.user.id,
        placeVendorId: place?.id ?? recentScan?.vendorId ?? null,
        eventId: event?.id ?? null,
        expiresAt: new Date(Date.now() + 24 * 3600000)
      }
    })
    return NextResponse.json(story, { status: 201 })
  } catch (error) {
    console.error('Error creating story:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
