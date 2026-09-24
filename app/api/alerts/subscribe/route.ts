import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pushConfigured } from '@/lib/alerts'

export const dynamic = 'force-dynamic'

// GET — the VAPID public key the browser needs to subscribe (null if push isn't configured on this server).
export async function GET() {
  return NextResponse.json({ publicKey: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null })
}

function cleanIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return Array.from(new Set(value.filter((v): v is string => typeof v === 'string' && v.length <= 64))).slice(0, 200)
}

// POST { subscription: PushSubscriptionJSON, savedVendorIds, lat, lng, liveAlerts, dealAlerts, userId }
// Creates or updates this device's subscription. Also used to sync saved vendors and location.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const endpoint = body.subscription?.endpoint
    const p256dh = body.subscription?.keys?.p256dh
    const auth = body.subscription?.keys?.auth
    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || typeof p256dh !== 'string' || typeof auth !== 'string') {
      return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 })
    }
    const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : undefined)
    const userId = typeof body.userId === 'string'
      ? (await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true } }))?.id
      : undefined
    const data = {
      p256dh,
      auth,
      savedVendorIds: cleanIds(body.savedVendorIds),
      lat: num(body.lat),
      lng: num(body.lng),
      liveAlerts: typeof body.liveAlerts === 'boolean' ? body.liveAlerts : undefined,
      dealAlerts: typeof body.dealAlerts === 'boolean' ? body.dealAlerts : undefined,
      userId
    }
    const defined = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
    const sub = await prisma.alertSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh, auth, ...defined },
      update: defined
    })
    return NextResponse.json({ ok: true, liveAlerts: sub.liveAlerts, dealAlerts: sub.dealAlerts, savedCount: sub.savedVendorIds.length })
  } catch (error) {
    console.error('Error saving alert subscription:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

// DELETE { endpoint } — opt out.
export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body.endpoint === 'string') await prisma.alertSubscription.deleteMany({ where: { endpoint: body.endpoint } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error removing alert subscription:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
