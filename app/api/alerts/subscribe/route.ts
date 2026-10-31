import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pushConfigured } from '@/lib/alerts'
import { userIdFromRequest } from '@/lib/auth-server'
import { parseBody, z } from '@/lib/validate'

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(1000).refine(u => u.startsWith('https://')),
    keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) })
  }),
  savedVendorIds: z.array(z.string().max(64)).max(200).optional(),
  lat: z.number().finite().min(-90).max(90).optional(),
  lng: z.number().finite().min(-180).max(180).optional(),
  liveAlerts: z.boolean().optional(),
  dealAlerts: z.boolean().optional()
})

export const dynamic = 'force-dynamic'

// GET — the VAPID public key the browser needs to subscribe (null if push isn't configured on this server).
export async function GET() {
  return NextResponse.json({ publicKey: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null })
}

function cleanIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return Array.from(new Set(value.filter((v): v is string => typeof v === 'string' && v.length <= 64))).slice(0, 200)
}

// POST { subscription: PushSubscriptionJSON, savedVendorIds, lat, lng, liveAlerts, dealAlerts }
// Creates or updates this device's subscription. Also used to sync saved vendors and location.
// The device is linked to the signed-in account from the token (never from the body).
export async function POST(request: Request) {
  try {
    const parsed = await parseBody(request, subscribeSchema)
    if (!parsed.ok) return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 })
    const body = parsed.data
    const { endpoint, keys: { p256dh, auth } } = body.subscription
    const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : undefined)
    const userId = userIdFromRequest(request) ?? undefined
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
    const parsed = await parseBody(request, z.object({ endpoint: z.string().max(1000) }))
    if (parsed.ok) await prisma.alertSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error removing alert subscription:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
