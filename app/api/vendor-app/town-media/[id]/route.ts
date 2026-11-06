// /api/vendor-app/town-media/:id — one hero photo/video (ETA admins only).
// PATCH { daypart?, kind?, url?, poster?, credit?, sortOrder?, active? } → the row.
// DELETE → removed.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { DAYPARTS } from '@/lib/daypart'
import { httpsUrl, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({
  daypart: z.enum(DAYPARTS as [string, ...string[]]),
  kind: z.enum(['photo', 'video']),
  url: httpsUrl,
  poster: httpsUrl.nullable(),
  credit: text(80).nullable(),
  sortOrder: z.number().int().min(0).max(999),
  active: z.boolean()
}).partial()

async function admin(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth
  if (auth.user.role !== 'ADMIN') return { ok: false as const, response: NextResponse.json({ error: 'Only ETA admins can do that', code: 'FORBIDDEN' }, { status: 403 }) }
  return auth
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await admin(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const existing = await prisma.townMedia.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
  return NextResponse.json(await prisma.townMedia.update({ where: { id: params.id }, data: parsed.data }))
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await admin(request)
  if (!auth.ok) return auth.response
  await prisma.townMedia.deleteMany({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
