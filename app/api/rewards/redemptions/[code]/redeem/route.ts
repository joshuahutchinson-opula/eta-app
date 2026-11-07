// POST /api/rewards/redemptions/ETA-XXXX/redeem { vendorId, scanned?, spendAmount? }
// — a vendor confirms a traveller's voucher (same as
// /api/vendor-app/vouchers/confirm). The caller must own that vendor
// (VENDOR role) or be an ADMIN. Rotating-QR rewards need the scanned value.
import { NextResponse } from 'next/server'
import { canActForVendor, requireUser } from '@/lib/auth-server'
import { confirmVoucher, VoucherError } from '@/lib/vouchers'
import { id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { code: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ vendorId: id, scanned: z.string().max(80).optional(), spendAmount: z.number().finite().min(0).max(100000).optional() }))
  if (!parsed.ok) return parsed.response
  const { vendorId, scanned, spendAmount } = parsed.data
  try {
    if (!(await canActForVendor(auth.user, vendorId))) return NextResponse.json({ error: 'Only the vendor or an ETA admin can do that' }, { status: 403 })
    return NextResponse.json(await confirmVoucher({ vendorId, scanned: scanned ?? params.code, confirmedById: auth.user.id, spendAmount }))
  } catch (error) {
    if (error instanceof VoucherError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    console.error('Error redeeming voucher:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
