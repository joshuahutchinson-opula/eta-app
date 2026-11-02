// GET — the signed-in caller's own discoveries. Discoveries (and their
// points) are created by check-ins and hidden-gem confirmations; POST here is
// an admin-only correction tool.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    const discoveries = await prisma.discovery.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: { select: { id: true, name: true, category: true, lat: true, lng: true, city: true } },
        photoSpot: { select: { id: true, name: true, lat: true, lng: true, city: true } },
        hiddenGem: { select: { id: true, name: true, category: true, lat: true, lng: true } }
      }
    })
    return NextResponse.json(discoveries)
  } catch (error) {
    console.error('Error fetching discoveries:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

const schema = z.object({
  userId: id,
  type: z.enum(['VENDOR', 'PHOTOSPOT', 'HIDDEN_GEM']),
  points: z.number().int().min(0).max(1000).default(0),
  vendorId: id.optional(),
  photoSpotId: id.optional(),
  hiddenGemId: id.optional()
})

export async function POST(request: Request) {
  const auth = await requireUser(request, { role: 'ADMIN' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    const d = parsed.data
    const discovery = await prisma.discovery.create({
      data: { userId: d.userId, type: d.type, points: d.points, vendorId: d.vendorId ?? null, photoSpotId: d.photoSpotId ?? null, hiddenGemId: d.hiddenGemId ?? null }
    })
    return NextResponse.json(discovery, { status: 201 })
  } catch (error) {
    console.error('Error creating discovery:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
