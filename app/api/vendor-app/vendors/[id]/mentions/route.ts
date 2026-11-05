// GET /api/vendor-app/vendors/:id/mentions?status=PENDING — the vendor's
// Instagram story mentions (lib/instagram.ts), newest first. Defaults to
// the approval queue: pending and not yet expired.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVendorAccess } from '@/lib/vendor-app'

export const dynamic = 'force-dynamic'

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const s = new URL(request.url).searchParams.get('status')?.toUpperCase()
  const status = (STATUSES as readonly string[]).includes(s ?? '') ? (s as (typeof STATUSES)[number]) : 'PENDING'
  try {
    const rows = await prisma.instagramMention.findMany({
      where: { vendorId: access.vendor.id, status, expiresAt: { gt: new Date() } },
      orderBy: { receivedAt: 'desc' },
      take: 100,
      include: { checkIn: { select: { createdAt: true } } }
    })
    return NextResponse.json(rows.map(r => ({
      id: r.id,
      status: r.status,
      igUsername: r.igUsername,
      mediaUrl: r.mediaUrl,
      mediaType: r.mediaType,
      receivedAt: r.receivedAt,
      expiresAt: r.expiresAt,
      scannedAt: r.checkIn?.createdAt ?? null
    })))
  } catch (error) {
    console.error('Error listing mentions:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
