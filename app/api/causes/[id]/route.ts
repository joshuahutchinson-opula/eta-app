// PATCH (ADMIN) — edit a Give Back cause: any of title, body, imageUrl,
// goalPoints, unitPoints, unitLabel, active.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(2000),
  imageUrl: z.string().url().max(500).nullable(),
  goalPoints: z.number().int().min(100).max(100000000),
  unitPoints: z.number().int().min(10).max(1000000),
  unitLabel: z.string().trim().min(3).max(160),
  active: z.boolean()
}).partial()

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request, { role: 'ADMIN' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const exists = await prisma.cause.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!exists) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
  return NextResponse.json(await prisma.cause.update({ where: { id: params.id }, data: parsed.data }))
}
