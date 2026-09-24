import { NextResponse } from 'next/server'
import type { City, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { TRIP_INCLUDE, cleanStopInput, newEditKey, newSlug, recalcShares, toTripDTO, type StopInput } from '@/lib/trips'

export const dynamic = 'force-dynamic'

// GET /api/trips?ownerId=...        → that user's trips
// GET /api/trips?slugs=a,b,c        → trips remembered on this device (no login needed)
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const ownerId = params.get('ownerId')
    const slugs = (params.get('slugs') ?? '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 25)
    if (!ownerId && slugs.length === 0) return NextResponse.json([])
    const or: Prisma.TripWhereInput[] = []
    if (ownerId) or.push({ ownerId })
    if (slugs.length) or.push({ slug: { in: slugs } })
    const trips = await prisma.trip.findMany({
      where: { OR: or, status: { not: 'CANCELLED' } },
      orderBy: { updatedAt: 'desc' },
      take: 25,
      include: TRIP_INCLUDE
    })
    return NextResponse.json(trips.map(toTripDTO))
  } catch (error) {
    console.error('Error listing trips:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

// POST /api/trips — create a trip. Returns the editKey exactly once.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const source = body.source === 'web' ? 'web' : 'app'
    const city: City = body.city === 'MONTEGO_BAY' ? 'MONTEGO_BAY' : 'NEGRIL'
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : 'My Negril day'

    let ownerId: string | null = null
    let ownerName = typeof body.ownerName === 'string' && body.ownerName.trim() ? body.ownerName.trim().slice(0, 40) : 'You'
    if (typeof body.ownerId === 'string') {
      const user = await prisma.user.findUnique({ where: { id: body.ownerId }, select: { id: true, name: true } })
      if (user) {
        ownerId = user.id
        if (ownerName === 'You') ownerName = user.name.split(' ')[0]
      }
    }

    let experienceId: string | null = null
    if (typeof body.experienceId === 'string') {
      const exp = await prisma.experience.findUnique({ where: { id: body.experienceId }, select: { id: true } })
      experienceId = exp?.id ?? null
    }

    // One member per name, ignoring case ("Sam" and "sam" are the same person).
    const crew: string[] = []
    if (Array.isArray(body.crew)) {
      const seen = new Set([ownerName.toLowerCase()])
      for (const raw of body.crew) {
        const n = typeof raw === 'string' ? raw.trim().slice(0, 40) : ''
        if (!n || seen.has(n.toLowerCase())) continue
        seen.add(n.toLowerCase())
        crew.push(n)
        if (crew.length === 12) break
      }
    }

    const stopInputs: StopInput[] = [
      ...(experienceId ? [{ experienceId }] : []),
      ...(Array.isArray(body.stops) ? body.stops.map(cleanStopInput).filter((s: StopInput | null): s is StopInput => s !== null).slice(0, 20) : [])
    ]

    const date = typeof body.date === 'string' && !isNaN(Date.parse(body.date)) ? new Date(body.date) : null
    const editKey = newEditKey()
    const trip = await prisma.trip.create({
      data: {
        slug: newSlug(),
        name,
        source,
        city,
        date,
        notes: typeof body.notes === 'string' ? body.notes.slice(0, 1000) : null,
        editKey,
        ownerId,
        experienceId,
        members: source === 'app'
          ? { create: [{ name: ownerName, isOwner: true, status: 'arrived' }, ...crew.map(n => ({ name: n }))] }
          : undefined,
        stops: { create: stopInputs.map((s, i) => ({ ...s, order: i, addedBy: ownerName })) }
      }
    })
    await recalcShares(trip.id)
    const full = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id }, include: TRIP_INCLUDE })
    return NextResponse.json({ trip: toTripDTO(full), editKey })
  } catch (error) {
    console.error('Error creating trip:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
