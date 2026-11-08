// /api/vendor-app/experiences/:id/moment — how an experience is picked for
// the Experiences tab's moments (lib/moments.ts). Set by the vendor that
// hosts it (its first vendor stop) or an ETA admin.
// GET → { bestTimes, indoor, startTimes, capacityPerSlot, featuredUntil }
// PUT { bestTimes?, indoor?, startTimes?, capacityPerSlot?, featuredUntil? }
//   bestTimes        any of morning, afternoon, golden, night ([] = worked
//                    out from the start times and the real sunset)
//   indoor           true indoor (leads in the rain) / false outdoor /
//                    null = worked out from its stops
//   startTimes       "HH:MM" Jamaica time
//   capacityPerSlot  spots per start time (null = no limit listed)
//   featuredUntil    ISO date — paid "Featured" placement, always labelled.
//                    ETA admins only.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canActForVendor, requireUser } from '@/lib/auth-server'
import { DAYPARTS } from '@/lib/daypart'
import { hhmm, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const SELECT = { bestTimes: true, outdoor: true, startTimes: true, capacityPerSlot: true, featuredUntil: true } as const

function view(e: { bestTimes: string[]; outdoor: boolean | null; startTimes: string[]; capacityPerSlot: number | null; featuredUntil: Date | null }) {
  return { bestTimes: e.bestTimes, indoor: e.outdoor === null ? null : !e.outdoor, startTimes: e.startTimes, capacityPerSlot: e.capacityPerSlot, featuredUntil: e.featuredUntil }
}

const schema = z.object({
  bestTimes: z.array(z.enum(DAYPARTS as [string, ...string[]])).max(4),
  indoor: z.boolean().nullable(),
  startTimes: z.array(hhmm).max(24),
  capacityPerSlot: z.number().int().min(1).max(500).nullable(),
  featuredUntil: z.string().datetime({ offset: true }).nullable()
}).partial()

async function access(request: Request, id: string) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth
  const exp = await prisma.experience.findUnique({ where: { id }, select: { id: true, stops: { orderBy: { order: 'asc' }, select: { vendorId: true } } } })
  if (!exp) return { ok: false as const, response: NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 }) }
  const host = exp.stops.find(s => s.vendorId)?.vendorId ?? null
  if (!(await canActForVendor(auth.user, host))) {
    return { ok: false as const, response: NextResponse.json({ error: 'Only the host vendor or an ETA admin can do that', code: 'FORBIDDEN' }, { status: 403 }) }
  }
  return { ok: true as const, user: auth.user, id: exp.id }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const a = await access(request, params.id)
  if (!a.ok) return a.response
  const e = await prisma.experience.findUniqueOrThrow({ where: { id: a.id }, select: SELECT })
  return NextResponse.json(view(e))
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const a = await access(request, params.id)
  if (!a.ok) return a.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const b = parsed.data
  if (b.featuredUntil !== undefined && a.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Featured placement is set by ETA', code: 'FORBIDDEN' }, { status: 403 })
  }
  try {
    const e = await prisma.experience.update({
      where: { id: a.id },
      data: {
        ...(b.bestTimes ? { bestTimes: Array.from(new Set(b.bestTimes)) } : {}),
        ...(b.indoor !== undefined ? { outdoor: b.indoor === null ? null : !b.indoor } : {}),
        ...(b.startTimes ? { startTimes: Array.from(new Set(b.startTimes.map(t => t.padStart(5, '0')))).sort() } : {}),
        ...(b.capacityPerSlot !== undefined ? { capacityPerSlot: b.capacityPerSlot } : {}),
        ...(b.featuredUntil !== undefined ? { featuredUntil: b.featuredUntil ? new Date(b.featuredUntil) : null } : {})
      },
      select: SELECT
    })
    return NextResponse.json(view(e))
  } catch (error) {
    console.error('Error saving moment tags:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
