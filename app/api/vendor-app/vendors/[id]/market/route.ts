// /api/vendor-app/vendors/:id/market — which Market sections the vendor is
// in, and the bits those sections show (vendor app; ETA admins can edit any
// vendor's). A section with no vendors in the town is hidden.
// GET → { marketTags, heatLevel, happyHourStart, happyHourEnd, marketNote, tags }
//       (tags = every tag the vendor can pick, lib/market-tags.ts)
// PUT { marketTags?, heatLevel?, happyHourStart?, happyHourEnd?, marketNote? }
//   marketTags      any of jerk, rum_bar, beach_bar, crafts, souvenirs,
//                   grocery, pharmacy, phone_topup
//   heatLevel       1–4, the Jerk Spots scotch-bonnet scale (null clears)
//   happyHourStart/End  "HH:MM" Jamaica time, both or neither (null clears)
//   marketNote      one short line for the tiles ("Sunset view", "40+ rums")
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVendorAccess } from '@/lib/vendor-app'
import { HEAT_MAX, HEAT_MIN, MARKET_TAGS } from '@/lib/market-tags'
import { hhmm, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const SELECT = { marketTags: true, heatLevel: true, happyHourStart: true, happyHourEnd: true, marketNote: true } as const

const schema = z.object({
  marketTags: z.array(z.enum(MARKET_TAGS)).max(MARKET_TAGS.length),
  heatLevel: z.number().int().min(HEAT_MIN).max(HEAT_MAX).nullable(),
  happyHourStart: hhmm.nullable(),
  happyHourEnd: hhmm.nullable(),
  marketNote: text(40).nullable()
}).partial()

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const v = await prisma.vendor.findUniqueOrThrow({ where: { id: access.vendor.id }, select: SELECT })
  return NextResponse.json({ ...v, tags: MARKET_TAGS })
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  if ((body.happyHourStart === undefined) !== (body.happyHourEnd === undefined) || (body.happyHourStart === null) !== (body.happyHourEnd === null)) {
    return NextResponse.json({ error: 'Send happyHourStart and happyHourEnd together', code: 'INVALID_BODY' }, { status: 400 })
  }
  try {
    const v = await prisma.vendor.update({
      where: { id: access.vendor.id },
      data: {
        ...(body.marketTags ? { marketTags: Array.from(new Set(body.marketTags)) } : {}),
        ...(body.heatLevel !== undefined ? { heatLevel: body.heatLevel } : {}),
        ...(body.happyHourStart !== undefined ? { happyHourStart: body.happyHourStart, happyHourEnd: body.happyHourEnd } : {}),
        ...(body.marketNote !== undefined ? { marketNote: body.marketNote || null } : {})
      },
      select: SELECT
    })
    return NextResponse.json({ ...v, tags: MARKET_TAGS })
  } catch (error) {
    console.error('Error saving market tags:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
