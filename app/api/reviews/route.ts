// GET ?vendorId=|experienceId=&take= — public reviews (hidden ones left out;
// reviewers by first name only). POST — post a review (signed in, verified).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EARN } from '@/lib/earn-config'
import { balances, earn } from '@/lib/points-ledger'
import { requireUser } from '@/lib/auth-server'
import { rateLimit } from '@/lib/rate-limit'
import { id, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const vendorId = q.get('vendorId')
  const experienceId = q.get('experienceId')
  const take = Math.min(200, Math.max(1, Number(q.get('take')) || 50))
  try {
    const reviews = await prisma.review.findMany({
      where: { hidden: false, ...(vendorId ? { vendorId } : {}), ...(experienceId ? { experienceId } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
      include: { user: { select: { name: true, avatarUrl: true } }, vendor: { select: { name: true } } }
    })
    return NextResponse.json(reviews.map(r => ({ id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt, vendorId: r.vendorId, experienceId: r.experienceId, vendor: r.vendor, user: { name: r.user.name.split(' ')[0], avatarUrl: r.user.avatarUrl } })))
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

const schema = z.object({
  vendorId: id,
  experienceId: id.optional(),
  // Whole stars, 1–5.
  rating: z.number().int().min(1).max(5),
  comment: text(1000).optional()
})

export async function POST(request: Request) {
  const auth = await requireUser(request, { verified: true, message: 'Log in to write a review' })
  if (!auth.ok) return auth.response
  const limited = rateLimit('review', auth.user.id)
  if (limited) return limited
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    const { vendorId, experienceId, rating, comment } = parsed.data
    if (!(await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } }))) {
      return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    }
    const review = await prisma.review.create({
      data: { userId: auth.user.id, vendorId, experienceId: experienceId ?? null, rating, comment: comment || null }
    })
    // EARN.verifiedReview, only after a QR visit to this vendor, once per vendor.
    const visited = await prisma.checkIn.findFirst({ where: { userId: auth.user.id, vendorId, method: 'qr' }, select: { vendor: { select: { city: true } } } })
    const pointsAwarded = visited
      ? await earn(prisma, { userId: auth.user.id, reason: 'review', points: EARN.verifiedReview, sourceType: 'review', sourceId: vendorId, city: visited.vendor?.city ?? null, vendorId })
      : 0
    return NextResponse.json({ ...review, pointsAwarded, ...(pointsAwarded ? await balances(auth.user.id) : {}) }, { status: 201 })
  } catch (error) {
    console.error('Error creating review:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
