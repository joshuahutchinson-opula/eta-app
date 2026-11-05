// GET /api/vendor-app/partners — the partner properties the caller runs
// (every property for an ETA admin), with their linked vendors.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { partnerUrl } from '@/lib/partners'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  if (auth.user.role !== 'ADMIN' && auth.user.role !== 'VENDOR') return NextResponse.json({ error: 'Only partners or ETA admins can do that', code: 'FORBIDDEN' }, { status: 403 })
  const rows = await prisma.partnerProperty.findMany({
    where: auth.user.role === 'ADMIN' ? {} : { ownerId: auth.user.id },
    orderBy: { name: 'asc' },
    include: { vendors: { select: { id: true, name: true, category: true } }, _count: { select: { guests: true, hostPicks: true, events: true } } }
  })
  return NextResponse.json(rows.map(({ _count, ownerId: _o, ...p }) => ({ ...p, url: partnerUrl(p.code), guestsReferred: _count.guests, hostPicks: _count.hostPicks, events: _count.events })))
}
