// /api/vendor-app/vendors/:id/explorer-perks — vendor-funded explorer-only
// perks (Reward.kind "explorer", e.g. a secret menu item). They unlock only
// when a traveler reaches this vendor through Explore mode or a quest and
// scans the QR card (lib/explore.ts), and never show on Discover or the
// vendor page.
// GET  → this vendor's perks, with how many explorers unlocked and used them.
// POST { name, description, icon?, validDays? } → a new perk.
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVendorAccess } from '@/lib/vendor-app'
import { EXPLORER_KIND } from '@/lib/explore'
import { parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const rewards = await prisma.reward.findMany({ where: { kind: EXPLORER_KIND, vendors: { some: { vendorId: access.vendor.id } } }, orderBy: { createdAt: 'desc' } })
  const counts = await prisma.redemption.groupBy({ by: ['rewardId', 'status'], where: { rewardId: { in: rewards.map(r => r.id) } }, _count: { _all: true } })
  return NextResponse.json(rewards.map(r => ({
    ...r,
    unlocked: counts.filter(c => c.rewardId === r.id).reduce((n, c) => n + c._count._all, 0),
    used: counts.find(c => c.rewardId === r.id && c.status === 'USED')?._count._all ?? 0
  })))
}

const schema = z.object({
  name: text(80).min(2),
  description: text(300).min(5),
  icon: z.string().max(30).optional(),
  validDays: z.number().int().min(1).max(365).optional()
})

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id: access.vendor.id }, select: { city: true } })
    const reward = await prisma.reward.create({
      data: {
        id: `explorer-${crypto.randomBytes(5).toString('hex')}`,
        kind: EXPLORER_KIND,
        name: parsed.data.name,
        description: parsed.data.description,
        icon: parsed.data.icon ?? 'sparkle',
        validDays: parsed.data.validDays ?? 30,
        cost: 0,
        city: vendor.city,
        vendors: { create: { vendorId: access.vendor.id } }
      }
    })
    return NextResponse.json(reward, { status: 201 })
  } catch (error) {
    console.error('Error creating explorer perk:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
