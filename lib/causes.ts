// lib/causes.ts — Give Back. Each town can have a local cause (Cause rows,
// admin-managed: town, title, text, image, goal, unit) that travellers and
// locals donate points to, any amount. Negril's is rebuilding and recovery
// after Hurricane Melissa: every 500 points covers roofing supplies for a
// local family or small business. Donating spends points through the
// ledger (reason "donate"); points never become cash in anyone's hands.
import { prisma } from '@/lib/prisma'
import { spend, SpendError } from '@/lib/points-ledger'
import type { CityCode } from '@/lib/regions'

export interface CauseView {
  id: string; city: string; title: string; body: string; imageUrl: string | null
  goalPoints: number; unitPoints: number; unitLabel: string; raisedPoints: number
  /** Units covered so far ("12 families"). */
  units: number
  donors: number
}

export async function causeFor(city: CityCode): Promise<CauseView | null> {
  const c = await prisma.cause.findFirst({ where: { city: city as never, active: true }, orderBy: { createdAt: 'desc' } })
  if (!c) return null
  const donors = (await prisma.donation.groupBy({ by: ['userId'], where: { causeId: c.id } })).length
  return { id: c.id, city: c.city, title: c.title, body: c.body, imageUrl: c.imageUrl, goalPoints: c.goalPoints, unitPoints: c.unitPoints, unitLabel: c.unitLabel, raisedPoints: c.raisedPoints, units: Math.floor(c.raisedPoints / c.unitPoints), donors }
}

export class DonateError extends Error {}

export async function donate(userId: string, causeId: string, points: number) {
  const cause = await prisma.cause.findFirst({ where: { id: causeId, active: true } })
  if (!cause) throw new DonateError('Nuttin nuh go suh')
  try {
    return await prisma.$transaction(async tx => {
      const d = await tx.donation.create({ data: { causeId, userId, points } })
      await spend(tx, { userId, reason: 'donate', points, sourceType: 'donation', sourceId: d.id, city: cause.city })
      const updated = await tx.cause.update({ where: { id: causeId }, data: { raisedPoints: { increment: points } }, select: { raisedPoints: true } })
      const me = await tx.user.findUnique({ where: { id: userId }, select: { points: true, lifetimePoints: true } })
      return { donationId: d.id, raisedPoints: updated.raisedPoints, units: Math.floor(updated.raisedPoints / cause.unitPoints), points: me?.points ?? 0, lifetimePoints: me?.lifetimePoints ?? 0 }
    })
  } catch (e) {
    if (e instanceof SpendError) throw new DonateError('Yuh nave nuff points fi dat yet')
    throw e
  }
}
