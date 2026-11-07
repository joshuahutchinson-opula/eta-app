// POST — the caller has seen their tier-up celebration: tierSeen moves up to
// their current tier (from lifetime points). Never moves down.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { getTierForPoints, tierIndex } from '@/lib/rewardTiers'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const u = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { lifetimePoints: true, tierSeen: true } })
  if (!u) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
  const tier = getTierForPoints(u.lifetimePoints).key
  if (tierIndex(tier) > tierIndex(u.tierSeen)) await prisma.user.update({ where: { id: auth.user.id }, data: { tierSeen: tier } })
  return NextResponse.json({ tierSeen: tierIndex(tier) > tierIndex(u.tierSeen) ? tier : u.tierSeen })
}
