// "I feel unsafe" live location.
// POST { lat, lng, accuracy?, token? } — start a share (no token) or update
//   it (token). Returns { token, url }. Links expire after SHARE_HOURS.
// DELETE { token } — stop sharing; the link then says it has ended.
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { absoluteUrl } from '@/lib/site-url'
import { lat, lng, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const SHARE_HOURS = 4

export async function POST(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to share your location' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ lat, lng, accuracy: z.number().finite().min(0).optional(), token: z.string().max(64).optional() }))
  if (!parsed.ok) return parsed.response
  const { token, ...pos } = parsed.data
  try {
    if (token) {
      const done = await prisma.safetyShare.updateMany({ where: { token, userId: auth.user.id, endedAt: null, expiresAt: { gt: new Date() } }, data: { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy ?? null } })
      if (done.count) return NextResponse.json({ token, url: absoluteUrl(`/live/${token}`) })
    }
    const share = await prisma.safetyShare.create({
      data: { token: crypto.randomBytes(12).toString('base64url'), userId: auth.user.id, lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy ?? null, expiresAt: new Date(Date.now() + SHARE_HOURS * 3600000) }
    })
    return NextResponse.json({ token: share.token, url: absoluteUrl(`/live/${share.token}`), expiresAt: share.expiresAt }, { status: 201 })
  } catch (error) {
    console.error('Error sharing location:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ token: z.string().max(64) }))
  if (!parsed.ok) return parsed.response
  await prisma.safetyShare.updateMany({ where: { token: parsed.data.token, userId: auth.user.id }, data: { endedAt: new Date() } })
  return NextResponse.json({ ok: true })
}
