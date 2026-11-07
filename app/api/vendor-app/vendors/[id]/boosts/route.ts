// /api/vendor-app/vendors/:id/boosts — the vendor's quiet-hour boost
// (e.g. 2× points 2–5 pm), shown to travellers on Rewards with a live
// countdown while it runs. Times are Jamaica "HH:MM".
// GET → { quietHour: { active, start, end, multiplier, days } | null }
// PUT { active, start, end, multiplier?, days? } → switches it on/off and sets the times.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVendorAccess } from '@/lib/vendor-app'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM')
const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
const toHHMM = (m: number | null) => m === null ? null : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

function view(b: { active: boolean; startMin: number | null; endMin: number | null; multiplier: number; days: number[] } | null) {
  return b ? { active: b.active, start: toHHMM(b.startMin), end: toHHMM(b.endMin), multiplier: b.multiplier, days: b.days } : null
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const b = await prisma.boost.findFirst({ where: { vendorId: params.id, kind: 'quiet_hour' }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ vendor: access.vendor, quietHour: view(b) })
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const parsed = await parseBody(request, z.object({
    active: z.boolean(),
    start: hhmm,
    end: hhmm,
    multiplier: z.number().min(1.5).max(3).default(2),
    days: z.array(z.number().int().min(0).max(6)).max(7).default([])
  }))
  if (!parsed.ok) return parsed.response
  const { active, start, end, multiplier, days } = parsed.data
  const startMin = toMin(start)
  const endMin = toMin(end)
  if (endMin <= startMin) return NextResponse.json({ error: 'The boost has to end after it starts', code: 'INVALID_BODY' }, { status: 400 })
  if (endMin - startMin > 4 * 60) return NextResponse.json({ error: 'Quiet-hour boosts can run up to 4 hours', code: 'INVALID_BODY' }, { status: 400 })
  const existing = await prisma.boost.findFirst({ where: { vendorId: params.id, kind: 'quiet_hour' }, select: { id: true } })
  const data = { active, startMin, endMin, multiplier, days, title: `${multiplier}× points ${start}–${end}` }
  const b = existing
    ? await prisma.boost.update({ where: { id: existing.id }, data })
    : await prisma.boost.create({ data: { ...data, kind: 'quiet_hour', vendorId: params.id } })
  return NextResponse.json({ quietHour: view(b) })
}
