// GET /api/partners/:code/qr — the property's printable QR card as SVG
// (ETA admins). The QR opens /p/<code> in ETA.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { findPartner, partnerCardSvg } from '@/lib/partners'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { code: string } }) {
  const auth = await requireUser(request, { role: 'ADMIN' })
  if (!auth.ok) return auth.response
  const p = await findPartner(params.code)
  if (!p) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
  return new NextResponse(partnerCardSvg(p.name, p.code), {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Content-Disposition': `inline; filename="eta-partner-${p.code}.svg"`, 'Cache-Control': 'no-store' }
  })
}
