// PATCH /api/vendor-app/events/:id/big-night { bigNight } (ETA admins) —
// flags an event as the town's big night: on its night, Home's hero shows
// it (its video) with "Tonight: <event> · <time>" and Get Tickets
// (lib/home.ts partyNight). Events with lots of interest count anyway.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request, { role: 'ADMIN' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ bigNight: z.boolean() }))
  if (!parsed.ok) return parsed.response
  const found = await prisma.event.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!found) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
  const event = await prisma.event.update({ where: { id: params.id }, data: { bigNight: parsed.data.bigNight }, select: { id: true, title: true, bigNight: true } })
  return NextResponse.json(event)
}
