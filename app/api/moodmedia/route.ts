// GET — traveler photos and clips on mood pages (hidden ones left out).
// POST { moodId, type, url } — add one (signed in, verified email).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { rateLimit } from '@/lib/rate-limit'
import { httpsUrl, id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const moodMedia = await prisma.moodMedia.findMany({
      where: { hidden: false },
      orderBy: { createdAt: 'desc' },
      include: { mood: true }
    })
    return NextResponse.json(moodMedia)
  } catch (error) {
    console.error('Error fetching mood media:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

const schema = z.object({
  moodId: id,
  type: z.enum(['image', 'video']).default('image'),
  url: httpsUrl
})

export async function POST(request: Request) {
  const auth = await requireUser(request, { verified: true, message: 'Log in to add a photo' })
  if (!auth.ok) return auth.response
  const limited = rateLimit('upload', auth.user.id)
  if (limited) return limited
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    const mood = await prisma.mood.findUnique({ where: { id: parsed.data.moodId }, select: { id: true } })
    if (!mood) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const moodMedia = await prisma.moodMedia.create({
      data: { moodId: mood.id, type: parsed.data.type, url: parsed.data.url, uploadedBy: auth.user.name.split(' ')[0], userId: auth.user.id }
    })
    return NextResponse.json(moodMedia, { status: 201 })
  } catch (error) {
    console.error('Error creating mood media:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
