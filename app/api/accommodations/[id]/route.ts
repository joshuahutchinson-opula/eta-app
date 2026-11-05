// GET /api/accommodations/:id — one stay listing, with its ETA Partner link
// and the property's own booking contacts.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const accommodation = await prisma.accommodation.findUnique({
      where: { id: params.id },
      include: {
        bundles: {
          include: {
            experience: true
          }
        },
        partner: { select: { code: true, name: true, active: true } }
      }
    })

    if (!accommodation) {
      return NextResponse.json(
        { error: 'Nuttin nuh go suh' },
        { status: 404 }
      )
    }

    // A listing only: the guest books direct (bookingUrl, phone, whatsapp, email).
    const { partner, ...rest } = accommodation
    return NextResponse.json({ ...rest, partner: partner?.active ? { code: partner.code, name: partner.name } : null })
  } catch (error) {
    console.error('Error fetching accommodation:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}