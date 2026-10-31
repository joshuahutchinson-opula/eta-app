// PATCH { status: 'CONFIRMED' | 'DECLINED', note? } — the vendor answers a
// reservation request. For the vendor app: the caller must own the vendor
// (VENDOR role) or be an ADMIN. The traveler sees the new status in My
// Bookings and gets an inbox notification.
// DELETE — the traveler withdraws their own pending request.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canActForVendor, requireUser } from '@/lib/auth-server'
import { notifyUser } from '@/lib/notify'
import { parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({ status: z.enum(['CONFIRMED', 'DECLINED']), note: text(280).optional() })

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    const row = await prisma.reservationRequest.findUnique({ where: { id: params.id }, include: { vendor: { select: { id: true, name: true } } } })
    if (!row) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (!(await canActForVendor(auth.user, row.vendorId))) return NextResponse.json({ error: 'Only the vendor or an ETA admin can do that' }, { status: 403 })
    const updated = await prisma.reservationRequest.update({
      where: { id: row.id },
      data: { status: parsed.data.status, vendorNote: parsed.data.note || null, respondedAt: new Date() }
    })
    const when = row.date.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Jamaica' })
    await notifyUser(row.userId, 'bookings', `reservation:${row.id}:${parsed.data.status}`, {
      title: parsed.data.status === 'CONFIRMED' ? `${row.vendor.name} accepted your reservation` : `${row.vendor.name} can’t take your reservation`,
      body: `${when} · ${row.partySize} people${parsed.data.note ? ` · “${parsed.data.note}”` : ''}`,
      url: '/bookings'
    }).catch(err => console.error('Reservation notification failed:', err))
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating reservation:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    const deleted = await prisma.reservationRequest.deleteMany({ where: { id: params.id, userId: auth.user.id, status: 'REQUESTED' } })
    if (deleted.count === 0) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error withdrawing reservation:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
