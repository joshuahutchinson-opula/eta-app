import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { onBookingCompleted } from '@/lib/booking-events'
import { canActForVendor, requireUser } from '@/lib/auth-server'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

// GET — one booking, for its owner (or an admin).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { id: true, name: true } },
        experience: true,
        vendor: { select: { id: true, name: true, images: true, neighborhood: true, lat: true, lng: true } },
        accommodation: { select: { id: true, name: true, media: true, city: true, lat: true, lng: true } }
      }
    })
    if (!booking || (booking.userId !== auth.user.id && auth.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    }
    return NextResponse.json(booking)
  } catch (error) {
    console.error('Error fetching booking:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

// PUT { status } — the operator side (admins now; the vendor app later)
// confirms, completes or cancels a booking. Travelers cancel and reschedule
// through /cancel and /reschedule, which apply the cancellation policy.
const schema = z.object({ status: z.enum(['CONFIRMED', 'COMPLETED', 'CANCELLED']) })

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    const before = await prisma.booking.findUnique({ where: { id: params.id }, select: { status: true, vendorId: true, experience: { select: { stops: { where: { vendorId: { not: null } }, orderBy: { order: 'asc' }, take: 1, select: { vendorId: true } } } } } })
    if (!before) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const vendorId = before.vendorId ?? before.experience?.stops[0]?.vendorId
    if (!(await canActForVendor(auth.user, vendorId))) return NextResponse.json({ error: 'Only the vendor or an ETA admin can do that' }, { status: 403 })
    const booking = await prisma.booking.update({
      where: { id: params.id },
      data: { status: parsed.data.status, ...(parsed.data.status === 'CANCELLED' ? { cancelledAt: new Date() } : {}) }
    })
    if (before.status !== 'COMPLETED' && booking.status === 'COMPLETED') await onBookingCompleted(booking.id)
    return NextResponse.json(booking)
  } catch (error) {
    console.error('Error updating booking:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
