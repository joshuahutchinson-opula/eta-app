// /api/vendor-app/moment-picks/:id — one hand-picked moment (ETA admins).
// PATCH { daypart?, startsAt?, endsAt?, sortOrder?, note?, active? } → the pick.
// DELETE → removed.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { PICK_INCLUDE, pickSchema } from '@/lib/moment-picks'
import { parseBody } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const patchSchema = pickSchema.pick({ daypart: true, startsAt: true, endsAt: true, sortOrder: true, note: true, active: true })

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request, { role: 'ADMIN' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, patchSchema)
  if (!parsed.ok) return parsed.response
  const b = parsed.data
  const found = await prisma.momentPick.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!found) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
  const pick = await prisma.momentPick.update({
    where: { id: params.id },
    data: {
      ...(b.daypart !== undefined ? { daypart: b.daypart } : {}),
      ...(b.startsAt !== undefined ? { startsAt: b.startsAt ? new Date(b.startsAt) : null } : {}),
      ...(b.endsAt !== undefined ? { endsAt: b.endsAt ? new Date(b.endsAt) : null } : {}),
      ...(b.sortOrder !== undefined ? { sortOrder: b.sortOrder } : {}),
      ...(b.note !== undefined ? { note: b.note } : {}),
      ...(b.active !== undefined ? { active: b.active } : {})
    },
    include: PICK_INCLUDE
  })
  return NextResponse.json(pick)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request, { role: 'ADMIN' })
  if (!auth.ok) return auth.response
  await prisma.momentPick.deleteMany({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
