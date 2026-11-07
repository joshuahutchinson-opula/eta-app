// /api/fraud-alerts (ADMIN) — unusually fast earning (lib/points-ledger.ts
// raises these and emails the admins).
// GET              → open alerts, newest first, with the user and their last hour of earns.
// PATCH { id }     → marks one resolved.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { FRAUD } from '@/lib/earn-config'
import { id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request, { role: 'ADMIN' })
  if (!auth.ok) return auth.response
  const alerts = await prisma.fraudAlert.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { id: true, name: true, email: true, points: true, lifetimePoints: true } } }
  })
  const out = await Promise.all(alerts.map(async a => ({
    ...a,
    recent: await prisma.pointsLedger.findMany({
      where: { userId: a.userId, kind: 'earn', createdAt: { gte: new Date(a.createdAt.getTime() - FRAUD.windowMs), lte: a.createdAt } },
      orderBy: { createdAt: 'desc' },
      select: { points: true, reason: true, vendorId: true, createdAt: true }
    })
  })))
  return NextResponse.json({ alerts: out })
}

export async function PATCH(request: Request) {
  const auth = await requireUser(request, { role: 'ADMIN' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ id }))
  if (!parsed.ok) return parsed.response
  const done = await prisma.fraudAlert.updateMany({ where: { id: parsed.data.id, resolvedAt: null }, data: { resolvedAt: new Date() } })
  if (!done.count) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
