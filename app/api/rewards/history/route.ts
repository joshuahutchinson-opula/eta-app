// GET ?before=<iso> — the caller's points history (PointsLedger), newest
// first, 40 at a time: every earn and spend with its reason, source and
// the vendor's name when there is one.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to see your points history' })
  if (!auth.ok) return auth.response
  const before = new URL(request.url).searchParams.get('before')
  const at = before ? new Date(before) : null
  try {
    const rows = await prisma.pointsLedger.findMany({
      where: { userId: auth.user.id, ...(at && !isNaN(at.getTime()) ? { createdAt: { lt: at } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 40
    })
    const vendors = await prisma.vendor.findMany({ where: { id: { in: Array.from(new Set(rows.map(r => r.vendorId).filter((x): x is string => Boolean(x)))) } }, select: { id: true, name: true } })
    const name = new Map(vendors.map(v => [v.id, v.name]))
    return NextResponse.json({
      rows: rows.map(r => ({ id: r.id, points: r.points, kind: r.kind, reason: r.reason, sourceType: r.sourceType, vendor: r.vendorId ? name.get(r.vendorId) ?? null : null, city: r.city, at: r.createdAt })),
      more: rows.length === 40
    })
  } catch (error) {
    console.error('Error fetching points history:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
