// POST { targetType, targetId, reason, note? } — report a photo, story,
// review or hidden gem. One report per person per item; enough pending
// reports hide it (lib/reports.ts).
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { REPORT_REASONS, REPORT_TARGETS, hideIfReported, targetExists } from '@/lib/reports'
import { rateLimit } from '@/lib/rate-limit'
import { id, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: id,
  reason: z.enum(REPORT_REASONS),
  note: text(500).optional()
})

export async function POST(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to report this' })
  if (!auth.ok) return auth.response
  const limited = rateLimit('report', auth.user.id)
  if (limited) return limited
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const { targetType, targetId, reason, note } = parsed.data
  try {
    if (!(await targetExists(targetType, targetId))) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    await prisma.report.create({ data: { targetType, targetId, reason, note: note || null, reporterId: auth.user.id } })
    const hidden = await hideIfReported(targetType, targetId)
    return NextResponse.json({ ok: true, hidden }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ ok: true, alreadyReported: true })
    }
    console.error('Error filing report:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
