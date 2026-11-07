// /api/vendor-app/vendors/:id/rewards — the vendor's own perks (vendor-funded).
// GET  → every reward this vendor honours, with redemptions today / this month against its caps.
// POST { name, description, cost, icon?, validDays?, dailyCap, monthlyBudget,
//        minTier?, category?, audience?, requiresVisit?, eventId? } → creates one.
// Every reward has a cap: dailyCap (per Jamaica day) and monthlyBudget (per month).
// Rewards at or above ROTATING_QR_COST get rotating voucher QR codes.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVendorAccess } from '@/lib/vendor-app'
import { capsLeft } from '@/lib/vouchers'
import { ROTATING_QR_COST } from '@/lib/earn-config'
import { parseBody, z } from '@/lib/validate'
import { rewardFields } from '@/lib/vendor-rewards'

export const dynamic = 'force-dynamic'


export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const rewards = await prisma.reward.findMany({ where: { vendors: { some: { vendorId: params.id } }, kind: 'catalog' }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({
    vendor: access.vendor,
    rewards: await Promise.all(rewards.map(async r => {
      const left = await capsLeft(r)
      return { ...r, ownedByVendor: r.createdByVendorId === params.id, redeemedToday: r.dailyCap - left.today, redeemedThisMonth: r.monthlyBudget - left.month }
    }))
  })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const parsed = await parseBody(request, z.object(rewardFields))
  if (!parsed.ok) return parsed.response
  const d = parsed.data
  if (d.dailyCap > d.monthlyBudget) return NextResponse.json({ error: 'The daily cap can’t be more than the monthly budget', code: 'INVALID_BODY' }, { status: 400 })
  const vendor = await prisma.vendor.findUnique({ where: { id: params.id }, select: { city: true } })
  const reward = await prisma.reward.create({
    data: {
      id: `v-${params.id.slice(-6)}-${Date.now().toString(36)}`,
      ...d,
      category: d.minTier ? 'insider' : d.category,
      city: vendor?.city ?? null,
      kind: 'catalog',
      rotatingQr: d.cost >= ROTATING_QR_COST,
      createdByVendorId: params.id,
      vendors: { create: { vendorId: params.id } }
    }
  })
  return NextResponse.json(reward, { status: 201 })
}
