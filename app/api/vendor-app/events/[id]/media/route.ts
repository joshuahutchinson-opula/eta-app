// /api/vendor-app/events/:id/media — the event's promo media (vendor app):
// several videos and photos the event page's hero swipes through, videos
// always first. Upload each file first (/api/uploads) and send the URLs.
// Allowed: the partner property that posted the event, the vendor that
// hosts it, or an ETA admin.
// GET → { videos, photos }
// PUT { videos?, photos? } → { videos, photos } (each replaces its list, in order)
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canActForVendor, requireUser } from '@/lib/auth-server'
import { httpsUrl, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const MAX_EVENT_VIDEOS = 6
const MAX_EVENT_PHOTOS = 12

const schema = z.object({
  videos: z.array(httpsUrl).max(MAX_EVENT_VIDEOS),
  photos: z.array(httpsUrl).max(MAX_EVENT_PHOTOS)
}).partial()

async function access(request: Request, id: string) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth
  const ev = await prisma.event.findUnique({ where: { id }, select: { id: true, vendorId: true, partnerProperty: { select: { ownerId: true } } } })
  if (!ev) return { ok: false as const, response: NextResponse.json({ error: 'Nuttin nuh go suh', code: 'NOT_FOUND' }, { status: 404 }) }
  const allowed = auth.user.role === 'ADMIN'
    || (auth.user.role === 'VENDOR' && ev.partnerProperty?.ownerId === auth.user.id)
    || (await canActForVendor(auth.user, ev.vendorId))
  if (!allowed) return { ok: false as const, response: NextResponse.json({ error: 'Only the promoter or an ETA admin can do that', code: 'FORBIDDEN' }, { status: 403 }) }
  return { ok: true as const, id: ev.id }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const a = await access(request, params.id)
  if (!a.ok) return a.response
  return NextResponse.json(await prisma.event.findUniqueOrThrow({ where: { id: a.id }, select: { videos: true, photos: true } }))
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const a = await access(request, params.id)
  if (!a.ok) return a.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const b = parsed.data
  const media = await prisma.event.update({
    where: { id: a.id },
    data: {
      ...(b.videos ? { videos: Array.from(new Set(b.videos)) } : {}),
      ...(b.photos ? { photos: Array.from(new Set(b.photos)) } : {})
    },
    select: { videos: true, photos: true }
  })
  return NextResponse.json(media)
}
