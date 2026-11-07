// Give Back causes (admin-managed records).
// GET ?city=NEGRIL       → the town's active cause (or null).
// POST (ADMIN)           { city, title, body, imageUrl?, goalPoints, unitPoints, unitLabel, active? } → creates one.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { causeFor } from '@/lib/causes'
import { CITY_CODES, isCityCode } from '@/lib/regions'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get('city')
  if (!isCityCode(city)) return NextResponse.json({ error: 'Pick a town' }, { status: 400 })
  return NextResponse.json({ cause: await causeFor(city) })
}

const causeSchema = z.object({
  city: z.enum(CITY_CODES as [string, ...string[]]),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(2000),
  imageUrl: z.string().url().max(500).nullable().optional(),
  goalPoints: z.number().int().min(100).max(100000000),
  unitPoints: z.number().int().min(10).max(1000000),
  unitLabel: z.string().trim().min(3).max(160),
  active: z.boolean().optional()
})

export async function POST(request: Request) {
  const auth = await requireUser(request, { role: 'ADMIN' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, causeSchema)
  if (!parsed.ok) return parsed.response
  const cause = await prisma.cause.create({ data: { ...parsed.data, city: parsed.data.city as never } })
  return NextResponse.json(cause, { status: 201 })
}
