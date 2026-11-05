// /api/partners — managing hotel and villa partners (ETA admins).
// GET  → every property with how many guests it referred.
// POST { name, code?, kind?, city, lat?, lng?, welcomeRewardId? } → a new
//      property; the code defaults to the name squashed to letters/digits.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { normalizeCode, partnerUrl } from '@/lib/partners'
import { CITY_CODES } from '@/lib/regions'
import { lat, lng, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request, { role: 'ADMIN' })
  if (!auth.ok) return auth.response
  const rows = await prisma.partnerProperty.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { guests: true } } } })
  return NextResponse.json(rows.map(({ _count, ...p }) => ({ ...p, url: partnerUrl(p.code), guestsReferred: _count.guests })))
}

const schema = z.object({
  name: text(120).min(1),
  code: z.string().max(40).optional(),
  kind: z.enum(['HOTEL', 'VILLA']).optional(),
  city: z.enum(CITY_CODES as [string, ...string[]]),
  lat: lat.optional(),
  lng: lng.optional(),
  welcomeRewardId: z.string().max(64).nullable().optional()
})

export async function POST(request: Request) {
  const auth = await requireUser(request, { role: 'ADMIN' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const { name, kind, city, welcomeRewardId, ...where } = parsed.data
  const code = normalizeCode(parsed.data.code ?? name)
  if (!code) return NextResponse.json({ error: 'code: use 3–24 letters or digits', code: 'INVALID_BODY' }, { status: 400 })
  try {
    const property = await prisma.partnerProperty.create({
      data: { name, code, kind: kind ?? 'HOTEL', city: city as never, lat: where.lat ?? null, lng: where.lng ?? null, welcomeRewardId: welcomeRewardId ?? null }
    })
    return NextResponse.json({ ...property, url: partnerUrl(property.code) }, { status: 201 })
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return NextResponse.json({ error: 'That code is taken' }, { status: 409 })
    console.error('Error creating partner:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
