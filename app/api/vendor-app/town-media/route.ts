// /api/vendor-app/town-media — Home's hero media (TownMedia): a photo or a
// short muted loop of each town for each daypart. ETA admins only.
// GET  ?city=&daypart= → the media, by town, daypart and order.
// POST { city, daypart: morning|afternoon|golden|night, kind: photo|video,
//        url, poster?, credit?, sortOrder?, active? } → the new row (201).
//      Upload the file first (/api/uploads, folder "town-media") and send its URL.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { CITY_CODES, isCityCode } from '@/lib/regions'
import { DAYPARTS } from '@/lib/daypart'
import { httpsUrl, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({
  city: z.enum(CITY_CODES as [string, ...string[]]),
  daypart: z.enum(DAYPARTS as [string, ...string[]]),
  kind: z.enum(['photo', 'video']).default('photo'),
  url: httpsUrl,
  poster: httpsUrl.nullable().optional(),
  credit: text(80).nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional()
})

async function admin(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth
  if (auth.user.role !== 'ADMIN') return { ok: false as const, response: NextResponse.json({ error: 'Only ETA admins can do that', code: 'FORBIDDEN' }, { status: 403 }) }
  return auth
}

export async function GET(request: Request) {
  const auth = await admin(request)
  if (!auth.ok) return auth.response
  const q = new URL(request.url).searchParams
  const city = q.get('city')
  const daypart = q.get('daypart')
  const rows = await prisma.townMedia.findMany({
    where: { ...(isCityCode(city) ? { city } : {}), ...(daypart && (DAYPARTS as string[]).includes(daypart) ? { daypart } : {}) },
    orderBy: [{ city: 'asc' }, { daypart: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }]
  })
  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const auth = await admin(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const m = parsed.data
  if (m.kind === 'video' && !m.poster) return NextResponse.json({ error: 'A video needs a poster frame', code: 'INVALID_BODY' }, { status: 400 })
  try {
    const row = await prisma.townMedia.create({
      data: { city: m.city as never, daypart: m.daypart, kind: m.kind, url: m.url, poster: m.poster ?? null, credit: m.credit ?? null, sortOrder: m.sortOrder ?? 0, active: m.active ?? true, createdById: auth.user.id }
    })
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error('Town media failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
