// GET /api/vendor-app/vendors/:id/rewards/report?from=&to= — is ETA Rewards
// paying off? Per reward: vouchers issued and confirmed here; overall: the
// customers those vouchers brought in, their visits and what they spent
// here in the period (spend entered at confirmation plus in-app payments).
// Defaults to the last 30 days.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVendorAccess } from '@/lib/vendor-app'

export const dynamic = 'force-dynamic'

const cents = (n: number) => Math.round(n * 100) / 100

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const q = new URL(request.url).searchParams
  const to = q.get('to') ? new Date(q.get('to')!) : new Date()
  const from = q.get('from') ? new Date(q.get('from')!) : new Date(to.getTime() - 30 * 86400000)
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return NextResponse.json({ error: 'from/to must be ISO dates' }, { status: 400 })
  try {
    const rewards = await prisma.reward.findMany({ where: { vendors: { some: { vendorId: params.id } } }, select: { id: true, name: true, cost: true, dailyCap: true, monthlyBudget: true, active: true } })
    const ids = rewards.map(r => r.id)
    const [issued, used] = await Promise.all([
      prisma.redemption.groupBy({ by: ['rewardId'], where: { rewardId: { in: ids }, createdAt: { gte: from, lte: to } }, _count: true }),
      prisma.redemption.findMany({ where: { vendorId: params.id, status: 'USED', usedAt: { gte: from, lte: to } }, select: { rewardId: true, userId: true, spendAmount: true } })
    ])
    const customers = Array.from(new Set(used.map(u => u.userId)))
    const [visits, payments] = await Promise.all([
      prisma.checkIn.count({ where: { vendorId: params.id, method: 'qr', userId: { in: customers }, createdAt: { gte: from, lte: to } } }),
      prisma.transaction.aggregate({ where: { vendorId: params.id, userId: { in: customers }, type: 'PAYMENT', status: 'COMPLETED', createdAt: { gte: from, lte: to } }, _sum: { amount: true } })
    ])
    const declared = used.reduce((n, u) => n + (u.spendAmount ?? 0), 0)
    return NextResponse.json({
      vendor: access.vendor, from, to,
      totals: {
        vouchersIssued: issued.reduce((n, i) => n + i._count, 0),
        redemptions: used.length,
        customersBrought: customers.length,
        customerVisits: visits,
        customerSpend: cents(declared + (payments._sum.amount ?? 0)),
        pointsRedeemed: used.reduce((n, u) => n + (rewards.find(r => r.id === u.rewardId)?.cost ?? 0), 0)
      },
      rewards: rewards.map(r => {
        const mine = used.filter(u => u.rewardId === r.id)
        return {
          ...r,
          issued: issued.find(i => i.rewardId === r.id)?._count ?? 0,
          redeemedHere: mine.length,
          customers: new Set(mine.map(u => u.userId)).size,
          spend: cents(mine.reduce((n, u) => n + (u.spendAmount ?? 0), 0))
        }
      })
    })
  } catch (error) {
    console.error('Rewards report failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
