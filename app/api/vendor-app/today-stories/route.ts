// /api/vendor-app/today-stories — Home's Today story (lib/today-story-admin.ts).
// GET  ?city=&from=YYYY-MM-DD → stories the caller can manage (all for ETA
//      admins, their own vendors' for a vendor), newest day first.
// POST { city, publishOn, eyebrow?, title, dek, coverImage, coverVideo?,
//        body: [{ type: "text", text } | { type: "image", url, caption? } |
//        { type: "quote", text, by? }], vendorId?, eventId?, published? }
//      → a new story. One per region per day (409 when the day is taken).
//      A vendor's story waits unpublished for ETA to publish it.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { checkStory, isTaken, storySchema, StoryError } from '@/lib/today-story-admin'
import { isCityCode } from '@/lib/regions'
import { parseBody } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  if (auth.user.role !== 'ADMIN' && auth.user.role !== 'VENDOR') return NextResponse.json({ error: 'Only vendors or ETA admins can do that', code: 'FORBIDDEN' }, { status: 403 })
  const q = new URL(request.url).searchParams
  const city = q.get('city')
  const from = q.get('from')
  const stories = await prisma.todayStory.findMany({
    where: {
      ...(isCityCode(city) ? { city } : {}),
      ...(from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? { publishOn: { gte: from } } : {}),
      ...(auth.user.role === 'ADMIN' ? {} : { OR: [{ createdById: auth.user.id }, { vendor: { ownerId: auth.user.id } }] })
    },
    orderBy: { publishOn: 'desc' },
    take: 100
  })
  return NextResponse.json(stories)
}

export async function POST(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, storySchema)
  if (!parsed.ok) return parsed.response
  const s = parsed.data
  try {
    const { canPublish } = await checkStory(auth.user, s)
    const story = await prisma.todayStory.create({
      data: {
        city: s.city as never,
        publishOn: s.publishOn,
        eyebrow: s.eyebrow ?? null,
        title: s.title,
        dek: s.dek,
        coverImage: s.coverImage,
        coverVideo: s.coverVideo ?? null,
        body: s.body,
        vendorId: s.vendorId ?? null,
        eventId: s.eventId ?? null,
        published: canPublish ? s.published ?? true : false,
        createdById: auth.user.id
      }
    })
    return NextResponse.json(story, { status: 201 })
  } catch (error) {
    if (error instanceof StoryError) return NextResponse.json({ error: error.message, code: error.status === 403 ? 'FORBIDDEN' : 'INVALID_BODY' }, { status: error.status })
    if (isTaken(error)) return NextResponse.json({ error: 'There’s already a Today story for that region and day', code: 'TAKEN' }, { status: 409 })
    console.error('Error creating today story:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
