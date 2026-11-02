// GET — traveler photos at photo spots (hidden ones left out).
// POST { url, caption?, photoSpotId? } — add one (signed in, verified email).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { rateLimit } from '@/lib/rate-limit'
import { httpsUrl, id, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const moments = await prisma.userMoment.findMany({
      where: { hidden: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { name: true, avatarUrl: true } }, photoSpot: true }
    })
    return NextResponse.json(moments.map(m => ({ ...m, user: { name: m.user.name.split(' ')[0], avatarUrl: m.user.avatarUrl } })))
  } catch (error) {
    console.error('Error fetching moments:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

const schema = z.object({
  url: httpsUrl,
  caption: text(280).optional(),
  photoSpotId: id.optional()
})

export async function POST(request: Request) {
  const auth = await requireUser(request, { verified: true, message: 'Log in to post a photo' })
  if (!auth.ok) return auth.response
  const limited = rateLimit('upload', auth.user.id)
  if (limited) return limited
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    const { url, caption, photoSpotId } = parsed.data
    if (photoSpotId && !(await prisma.photoSpot.findUnique({ where: { id: photoSpotId }, select: { id: true } }))) {
      return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    }
    const moment = await prisma.userMoment.create({ data: { url, caption: caption || null, photoSpotId: photoSpotId ?? null, userId: auth.user.id } })
    return NextResponse.json(moment, { status: 201 })
  } catch (error) {
    console.error('Error creating moment:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
