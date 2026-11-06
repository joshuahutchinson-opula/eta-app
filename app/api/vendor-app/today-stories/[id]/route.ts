// /api/vendor-app/today-stories/:id — one Today story.
// GET → the story. PUT (any POST fields) → edit it; only ETA admins can
// publish, and a vendor's edit sends it back for review (unpublished).
// DELETE → remove it.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, type AuthedUser } from '@/lib/auth-server'
import { checkStory, isTaken, storySchema, StoryError } from '@/lib/today-story-admin'
import { parseBody } from '@/lib/validate'

export const dynamic = 'force-dynamic'

async function load(user: AuthedUser, id: string) {
  const story = await prisma.todayStory.findUnique({ where: { id } })
  if (!story) return { error: NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 }) }
  if (user.role !== 'ADMIN') {
    try { await checkStory(user, {}, story) } catch (e) {
      if (e instanceof StoryError) return { error: NextResponse.json({ error: e.message, code: 'FORBIDDEN' }, { status: 403 }) }
      throw e
    }
  }
  return { story }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const r = await load(auth.user, params.id)
  return r.error ?? NextResponse.json(r.story)
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const r = await load(auth.user, params.id)
  if (r.error) return r.error
  const parsed = await parseBody(request, storySchema.partial())
  if (!parsed.ok) return parsed.response
  const s = parsed.data
  try {
    const { canPublish } = await checkStory(auth.user, s, r.story)
    const story = await prisma.todayStory.update({
      where: { id: params.id },
      data: {
        ...(s.city ? { city: s.city as never } : {}),
        ...(s.publishOn ? { publishOn: s.publishOn } : {}),
        ...(s.eyebrow !== undefined ? { eyebrow: s.eyebrow } : {}),
        ...(s.title ? { title: s.title } : {}),
        ...(s.dek ? { dek: s.dek } : {}),
        ...(s.coverImage ? { coverImage: s.coverImage } : {}),
        ...(s.coverVideo !== undefined ? { coverVideo: s.coverVideo } : {}),
        ...(s.body ? { body: s.body } : {}),
        ...(s.vendorId !== undefined ? { vendorId: s.vendorId } : {}),
        ...(s.eventId !== undefined ? { eventId: s.eventId } : {}),
        published: canPublish ? s.published ?? r.story.published : false
      }
    })
    return NextResponse.json(story)
  } catch (error) {
    if (error instanceof StoryError) return NextResponse.json({ error: error.message, code: error.status === 403 ? 'FORBIDDEN' : 'INVALID_BODY' }, { status: error.status })
    if (isTaken(error)) return NextResponse.json({ error: 'There’s already a Today story for that region and day', code: 'TAKEN' }, { status: 409 })
    console.error('Error updating today story:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const r = await load(auth.user, params.id)
  if (r.error) return r.error
  await prisma.todayStory.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
