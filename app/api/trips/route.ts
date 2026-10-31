import { NextResponse } from 'next/server'
import type { City, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { parseCity } from '@/lib/regions'
import { requireUser, userIdFromRequest } from '@/lib/auth-server'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { TRIP_INCLUDE, cleanStopInput, newEditKey, newSlug, recalcShares, toTripDTO, type StopInput } from '@/lib/trips'
import { dateOnly, id, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

// GET /api/trips              → the signed-in user's trips (owned or joined)
// GET /api/trips?slugs=a,b,c  → no-login web plans remembered on this device
export async function GET(request: Request) {
  try {
    const userId = userIdFromRequest(request)
    const slugs = (new URL(request.url).searchParams.get('slugs') ?? '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 25)
    const or: Prisma.TripWhereInput[] = []
    if (userId) or.push({ ownerId: userId }, { members: { some: { userId } } })
    if (slugs.length) or.push({ slug: { in: slugs }, source: 'web' })
    if (!or.length) return NextResponse.json([])
    const trips = await prisma.trip.findMany({
      where: { OR: or, status: { not: 'CANCELLED' } },
      orderBy: { updatedAt: 'desc' },
      take: 25,
      include: TRIP_INCLUDE
    })
    return NextResponse.json(trips.map(t => {
      const member = userId ? t.members.find(m => m.userId === userId) ?? null : null
      const role = userId && t.ownerId === userId ? 'owner' : member ? 'member' : 'viewer'
      return toTripDTO(t, { role, userId, member, invite: null })
    }))
  } catch (error) {
    console.error('Error listing trips:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

const schema = z.object({
  source: z.enum(['app', 'web']).default('app'),
  name: text(80).optional(),
  city: z.string().max(32).optional(),
  experienceId: id.optional(),
  crew: z.array(text(40)).max(12).optional(),
  stops: z.array(z.unknown()).max(20).optional(),
  date: z.union([dateOnly, z.string().datetime({ offset: true })]).optional(),
  notes: text(1000).optional()
})

// POST /api/trips — create a trip. App trips belong to the signed-in user;
// web day plans need no login and are edited with the editKey, which is
// returned exactly once.
export async function POST(request: Request) {
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  try {
    let ownerId: string | null = null
    let ownerName = 'You'
    if (body.source === 'app') {
      const auth = await requireUser(request, { message: 'Log in to plan a trip with your crew' })
      if (!auth.ok) return auth.response
      ownerId = auth.user.id
      ownerName = auth.user.name.split(' ')[0]
    } else {
      const limited = rateLimit('webTrip', clientIp(request))
      if (limited) return limited
    }
    const city: City = parseCity(body.city)
    const name = body.name?.trim() || 'My Negril day'

    let experienceId: string | null = null
    if (body.experienceId) {
      const exp = await prisma.experience.findUnique({ where: { id: body.experienceId }, select: { id: true } })
      experienceId = exp?.id ?? null
    }

    // One member per name, ignoring case ("Sam" and "sam" are the same person).
    const crew: string[] = []
    const seen = new Set([ownerName.toLowerCase()])
    for (const raw of body.crew ?? []) {
      const n = raw.trim()
      if (!n || seen.has(n.toLowerCase())) continue
      seen.add(n.toLowerCase())
      crew.push(n)
    }

    const stopInputs: StopInput[] = [
      ...(experienceId ? [{ experienceId }] : []),
      ...(body.stops ?? []).map(cleanStopInput).filter((s): s is StopInput => s !== null)
    ]

    const date = body.date && !isNaN(Date.parse(body.date)) ? new Date(body.date) : null
    const editKey = newEditKey()
    const trip = await prisma.trip.create({
      data: {
        slug: newSlug(),
        name,
        source: body.source,
        city,
        date,
        notes: body.notes ?? null,
        editKey,
        ownerId,
        experienceId,
        members: body.source === 'app'
          ? { create: [{ name: ownerName, isOwner: true, status: 'arrived', userId: ownerId }, ...crew.map(n => ({ name: n }))] }
          : undefined,
        stops: { create: stopInputs.map((s, i) => ({ ...s, order: i, addedBy: ownerName })) }
      }
    })
    await recalcShares(trip.id)
    const full = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id }, include: TRIP_INCLUDE })
    const member = full.members.find(m => m.isOwner) ?? null
    return NextResponse.json({ trip: toTripDTO(full, { role: 'owner', userId: ownerId, member, invite: null }), editKey })
  } catch (error) {
    console.error('Error creating trip:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
