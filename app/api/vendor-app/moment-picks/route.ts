// /api/vendor-app/moment-picks — ETA admins' hand-picks for a town's
// Experiences moments (MomentPick). Live picks lead the big card, in
// sortOrder, ahead of the automatic choice (lib/moments.ts).
// GET  ?city= → the picks (with the experience or event they point at).
// POST { city, experienceId | eventId, daypart?, startsAt?, endsAt?,
//        sortOrder?, note?, active? } → the new pick (201).
//   daypart  morning | afternoon | golden | night | rain (null = any time)
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { isCityCode } from '@/lib/regions'
import { PICK_INCLUDE, pickSchema } from '@/lib/moment-picks'
import { parseBody } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request, { role: 'ADMIN' })
  if (!auth.ok) return auth.response
  const city = new URL(request.url).searchParams.get('city')
  const picks = await prisma.momentPick.findMany({
    where: isCityCode(city) ? { city } : {},
    orderBy: [{ city: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: PICK_INCLUDE
  })
  return NextResponse.json(picks)
}

export async function POST(request: Request) {
  const auth = await requireUser(request, { role: 'ADMIN' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, pickSchema)
  if (!parsed.ok) return parsed.response
  const b = parsed.data
  if (Boolean(b.experienceId) === Boolean(b.eventId)) return NextResponse.json({ error: 'Pick one experienceId or eventId', code: 'INVALID_BODY' }, { status: 400 })
  const target = b.experienceId
    ? await prisma.experience.findUnique({ where: { id: b.experienceId }, select: { city: true } })
    : await prisma.event.findUnique({ where: { id: b.eventId! }, select: { city: true } })
  if (!target) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
  if (target.city !== b.city) return NextResponse.json({ error: 'That isn’t in this town', code: 'INVALID_BODY' }, { status: 400 })
  try {
    const pick = await prisma.momentPick.create({
      data: {
        city: b.city as never,
        experienceId: b.experienceId ?? null,
        eventId: b.eventId ?? null,
        daypart: b.daypart ?? null,
        startsAt: b.startsAt ? new Date(b.startsAt) : null,
        endsAt: b.endsAt ? new Date(b.endsAt) : null,
        sortOrder: b.sortOrder ?? 0,
        note: b.note ?? null,
        active: b.active ?? true,
        createdById: auth.user.id
      },
      include: PICK_INCLUDE
    })
    return NextResponse.json(pick, { status: 201 })
  } catch (error) {
    console.error('Error creating moment pick:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
