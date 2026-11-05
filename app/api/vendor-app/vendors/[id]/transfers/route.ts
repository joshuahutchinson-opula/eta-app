// /api/vendor-app/vendors/:id/transfers — a transport vendor's airport
// transfers, offered in the arrival flow's "Need a ride?" (lib/transfers.ts).
// GET → its services.
// PUT { services: [{ airport, vehicle, seats, baseFare, perKm?, readyMinutes?,
//       driverName?, driverPhoto?, active? }] } → replaces the list, in order.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVendorAccess } from '@/lib/vendor-app'
import { AIRPORTS } from '@/lib/arrival'
import { httpsUrl, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const service = z.object({
  airport: z.enum(AIRPORTS.map(a => a.code) as [string, ...string[]]),
  vehicle: text(60).min(1),
  seats: z.number().int().min(1).max(60),
  baseFare: z.number().finite().min(0).max(5000),
  perKm: z.number().finite().min(0).max(50).optional(),
  readyMinutes: z.number().int().min(0).max(240).optional(),
  driverName: text(60).nullable().optional(),
  driverPhoto: httpsUrl.nullable().optional(),
  active: z.boolean().optional()
})

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  return NextResponse.json({ services: await prisma.transferService.findMany({ where: { vendorId: access.vendor.id }, orderBy: { sortOrder: 'asc' } }) })
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const parsed = await parseBody(request, z.object({ services: z.array(service).max(20) }))
  if (!parsed.ok) return parsed.response
  try {
    const vendor = await prisma.vendor.findUnique({ where: { id: access.vendor.id }, select: { isTransport: true } })
    if (!vendor?.isTransport) return NextResponse.json({ error: 'Only transport vendors can offer transfers' }, { status: 409 })
    // Booked rides keep their history; the old services are retired, not deleted.
    await prisma.$transaction([
      prisma.transferService.updateMany({ where: { vendorId: access.vendor.id }, data: { active: false, sortOrder: 999 } }),
      prisma.transferService.createMany({
        data: parsed.data.services.map((s, i) => ({ vendorId: access.vendor.id, airport: s.airport, vehicle: s.vehicle, seats: s.seats, baseFare: s.baseFare, perKm: s.perKm ?? 0, readyMinutes: s.readyMinutes ?? 15, driverName: s.driverName ?? null, driverPhoto: s.driverPhoto ?? null, active: s.active ?? true, sortOrder: i }))
      })
    ])
    return NextResponse.json({ services: await prisma.transferService.findMany({ where: { vendorId: access.vendor.id, sortOrder: { lt: 999 } }, orderBy: { sortOrder: 'asc' } }) })
  } catch (error) {
    console.error('Error saving transfers:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
