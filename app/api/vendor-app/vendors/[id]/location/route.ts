// /api/vendor-app/vendors/:id/location — the vendor's pin (vendor app).
// GET → { lat, lng, status, source, accuracyM, updatedAt }.
// PUT { source: "gps", lat, lng, accuracy } — "I'm here now": the phone's GPS
//     fix (±50 m or better) becomes the pin.
// PUT { source: "drag", lat, lng } — nudge the pin by dragging, after a GPS
//     fix, up to 300 m from where it is.
// Either marks the location CONFIRMED (VendorLocationStatus).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVendorAccess } from '@/lib/vendor-app'
import { distanceM } from '@/lib/hidden-gems'
import { lat, lng, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

/** A GPS fix has to be at least this good to become the pin. */
const MAX_GPS_ACCURACY_M = 50
/** How far a drag can move the pin from where it is. */
const MAX_DRAG_M = 300

const SELECT = { lat: true, lng: true, locationStatus: true, locationSource: true, locationAccuracyM: true, locationUpdatedAt: true } as const

function view(v: { lat: number; lng: number; locationStatus: string; locationSource: string | null; locationAccuracyM: number | null; locationUpdatedAt: Date | null }) {
  return { lat: v.lat, lng: v.lng, status: v.locationStatus, source: v.locationSource, accuracyM: v.locationAccuracyM, updatedAt: v.locationUpdatedAt }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const v = await prisma.vendor.findUniqueOrThrow({ where: { id: access.vendor.id }, select: SELECT })
  return NextResponse.json(view(v))
}

const schema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('gps'), lat, lng, accuracy: z.number().finite().min(0) }),
  z.object({ source: z.literal('drag'), lat, lng })
])

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  try {
    const current = await prisma.vendor.findUniqueOrThrow({ where: { id: access.vendor.id }, select: SELECT })
    if (body.source === 'gps' && body.accuracy > MAX_GPS_ACCURACY_M) {
      return NextResponse.json({ error: `Your GPS is ±${Math.round(body.accuracy)} m — step outside and try again (needs ±${MAX_GPS_ACCURACY_M} m)`, code: 'GPS_FUZZY' }, { status: 422 })
    }
    if (body.source === 'drag' && access.user.role !== 'ADMIN') {
      if (current.locationSource !== 'vendor_gps' && current.locationSource !== 'vendor_drag') {
        return NextResponse.json({ error: 'Set your pin with “I’m here now” first, then drag to adjust' }, { status: 409 })
      }
      if (distanceM(current, body) > MAX_DRAG_M) return NextResponse.json({ error: `Drag adjusts up to ${MAX_DRAG_M} m — use “I’m here now” from the new spot instead` }, { status: 422 })
    }
    const v = await prisma.vendor.update({
      where: { id: access.vendor.id },
      data: {
        lat: body.lat,
        lng: body.lng,
        locationStatus: 'CONFIRMED',
        locationSource: body.source === 'gps' ? 'vendor_gps' : 'vendor_drag',
        locationAccuracyM: body.source === 'gps' ? body.accuracy : current.locationAccuracyM,
        locationUpdatedAt: new Date()
      },
      select: SELECT
    })
    return NextResponse.json(view(v))
  } catch (error) {
    console.error('Error setting vendor location:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
