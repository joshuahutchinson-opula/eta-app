// GET /api/visits/vendor?code= (signed in) — which vendor a scanned ETA QR
// card belongs to, so Scan & Pay can still pay them when the visit itself
// can't be logged (no location, too far, already checked in).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { parseScanned } from '@/lib/vendor-qr'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to pay' })
  if (!auth.ok) return auth.response
  const limited = rateLimit('visit', auth.user.id)
  if (limited) return limited
  const token = parseScanned(new URL(request.url).searchParams.get('code') ?? '')
  if (!token) return NextResponse.json({ error: 'That isn’t an ETA vendor code', code: 'QR_INVALID' }, { status: 400 })
  const card = await prisma.vendorQrCard.findUnique({ where: { token }, include: { vendor: { select: { id: true, name: true, images: true, neighborhood: true } } } })
  if (!card) return NextResponse.json({ error: 'That isn’t an ETA vendor code', code: 'QR_INVALID' }, { status: 404 })
  return NextResponse.json({ vendor: { id: card.vendor.id, name: card.vendor.name, image: card.vendor.images[0] ?? null, neighborhood: card.vendor.neighborhood } })
}
