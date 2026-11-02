// GET ?city=NEGRIL — live stories for the selected region (vendor stories
// by the vendor's town, traveler stories by where they were posted), each
// with `seen` for the signed-in viewer.
// POST { caption?, imageUrl, videoUrl?, city } — post a 24-hour story
// (signed in, verified email).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, userIdFromRequest } from '@/lib/auth-server'
import { isCityCode, CITY_CODES } from '@/lib/regions'
import { rateLimit } from '@/lib/rate-limit'
import { httpsUrl, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get('city')
  const userId = userIdFromRequest(request)
  try {
    const stories = await prisma.story.findMany({
      where: {
        expiresAt: { gt: new Date() },
        hidden: false,
        ...(isCityCode(city) ? { OR: [{ vendor: { city } }, { vendorId: null, city }] } : {})
      },
      include: {
        vendor: { select: { name: true, isPremium: true, images: true, city: true } },
        user: { select: { name: true, avatarUrl: true } },
        ...(userId ? { views: { where: { userId }, select: { id: true } } } : {})
      },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(stories.map(s => {
      const { views, user, ...rest } = s as typeof s & { views?: unknown[] }
      return { ...rest, user: user ? { name: user.name.split(' ')[0], avatarUrl: user.avatarUrl } : null, seen: Boolean(views?.length) }
    }))
  } catch (error) {
    console.error('Error fetching stories:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

const schema = z.object({
  caption: text(200).optional(),
  imageUrl: httpsUrl,
  videoUrl: httpsUrl.optional(),
  city: z.enum(CITY_CODES as [string, ...string[]])
})

export async function POST(request: Request) {
  const auth = await requireUser(request, { verified: true, message: 'Log in to post a story' })
  if (!auth.ok) return auth.response
  const limited = rateLimit('story', auth.user.id)
  if (limited) return limited
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    const story = await prisma.story.create({
      data: {
        content: parsed.data.caption ?? '',
        type: parsed.data.videoUrl ? 'video' : 'user',
        imageUrl: parsed.data.imageUrl,
        videoUrl: parsed.data.videoUrl ?? null,
        city: parsed.data.city as never,
        userId: auth.user.id,
        expiresAt: new Date(Date.now() + 24 * 3600000)
      }
    })
    return NextResponse.json(story, { status: 201 })
  } catch (error) {
    console.error('Error creating story:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
