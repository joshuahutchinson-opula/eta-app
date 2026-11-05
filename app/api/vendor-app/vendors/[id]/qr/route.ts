// /api/vendor-app/vendors/:id/qr — the vendor's QR check-in card (vendor app).
// GET                → { token, code, url, issuedAt } — issued on first call.
// GET ?format=svg    → the printable card as SVG (download / print).
// POST { rotate: true } → a new token; the old printed card stops working.
import { NextResponse } from 'next/server'
import { requireVendorAccess } from '@/lib/vendor-app'
import { displayCode, qrCardFor, qrCardSvg, qrUrl } from '@/lib/vendor-qr'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

function body(card: { token: string; issuedAt: Date }) {
  return { token: card.token, code: displayCode(card.token), url: qrUrl(card.token), issuedAt: card.issuedAt }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  try {
    const card = await qrCardFor(access.vendor.id)
    if (new URL(request.url).searchParams.get('format') === 'svg') {
      return new NextResponse(qrCardSvg(access.vendor.name, card.token), {
        headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Content-Disposition': `inline; filename="eta-qr-${access.vendor.id}.svg"`, 'Cache-Control': 'no-store' }
      })
    }
    return NextResponse.json(body(card))
  } catch (error) {
    console.error('Error issuing QR card:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const parsed = await parseBody(request, z.object({ rotate: z.literal(true) }))
  if (!parsed.ok) return parsed.response
  try {
    return NextResponse.json(body(await qrCardFor(access.vendor.id, true)), { status: 201 })
  } catch (error) {
    console.error('Error rotating QR card:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
