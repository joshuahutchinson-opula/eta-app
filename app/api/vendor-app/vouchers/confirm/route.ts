// POST /api/vendor-app/vouchers/confirm { vendorId, scanned, spendAmount? }
// — the vendor scans a traveller's voucher QR (or types the code, for
// rewards without a rotating QR) and confirms it. Single use. spendAmount
// is what the customer spent on that visit, for the redemptions report.
// Returns the reward and the customer's first name and status (Yaadies get
// the gold badge in the vendor app).
import { NextResponse } from 'next/server'
import { requireVendorAccess } from '@/lib/vendor-app'
import { confirmVoucher, VoucherError } from '@/lib/vouchers'
import { getTierForPoints } from '@/lib/rewardTiers'
import { id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({ vendorId: id, scanned: z.string().trim().min(6).max(80), spendAmount: z.number().finite().min(0).max(100000).optional() })

export async function POST(request: Request) {
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const access = await requireVendorAccess(request, parsed.data.vendorId)
  if (!access.ok) return access.response
  try {
    const result = await confirmVoucher({ vendorId: parsed.data.vendorId, scanned: parsed.data.scanned, confirmedById: access.user.id, spendAmount: parsed.data.spendAmount })
    const tier = result.customer ? getTierForPoints(result.customer.lifetimePoints).key : null
    return NextResponse.json({ ok: true, rewardName: result.rewardName, customer: result.customer ? { name: result.customer.name, tier, yaadie: tier === 'YAADIE' } : null })
  } catch (error) {
    if (error instanceof VoucherError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    console.error('Voucher confirm failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
