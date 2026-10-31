// POST { vendorId } — the vendor app records that a vendor accepted the
// current Vendor Agreement (lib/legal.ts VENDOR_AGREEMENT_VERSION). The
// caller must own the vendor (VENDOR role) or be an ADMIN.
// GET ?vendorId= — whether that vendor has accepted the current version.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canActForVendor, requireUser } from '@/lib/auth-server'
import { VENDOR_AGREEMENT_VERSION } from '@/lib/legal'
import { id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const vendorId = new URL(request.url).searchParams.get('vendorId')
  if (!vendorId || !(await canActForVendor(auth.user, vendorId))) return NextResponse.json({ error: 'Only the vendor or an ETA admin can see this' }, { status: 403 })
  const row = await prisma.vendorAgreementAcceptance.findUnique({ where: { vendorId_version: { vendorId, version: VENDOR_AGREEMENT_VERSION } } })
  return NextResponse.json({ version: VENDOR_AGREEMENT_VERSION, accepted: Boolean(row), acceptedAt: row?.acceptedAt ?? null })
}

export async function POST(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ vendorId: id }))
  if (!parsed.ok) return parsed.response
  const { vendorId } = parsed.data
  try {
    if (!(await canActForVendor(auth.user, vendorId))) return NextResponse.json({ error: 'Only the vendor or an ETA admin can do that' }, { status: 403 })
    const row = await prisma.vendorAgreementAcceptance.upsert({
      where: { vendorId_version: { vendorId, version: VENDOR_AGREEMENT_VERSION } },
      create: { vendorId, version: VENDOR_AGREEMENT_VERSION, acceptedByUserId: auth.user.id },
      update: {}
    })
    return NextResponse.json({ version: row.version, acceptedAt: row.acceptedAt }, { status: 201 })
  } catch (error) {
    console.error('Error recording agreement:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
