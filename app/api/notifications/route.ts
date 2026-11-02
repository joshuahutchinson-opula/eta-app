// app/api/notifications/route.ts — the in-app inbox: alerts sent to the
// signed-in user's devices plus account notifications (bookings, events,
// crew, reservations), newest first.
// GET → { items, unread }.  PATCH { ids?: string[] } → mark read (all when no ids).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const mine = (userId: string) => ({ OR: [{ subscription: { userId } }, { userId }], title: { not: null } })

export async function GET(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to see your alerts' })
  if (!auth.ok) return auth.response
  try {
    const where = mine(auth.user.id)
    const [items, unread] = await Promise.all([
      prisma.notificationLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 60, select: { id: true, type: true, title: true, body: true, url: true, readAt: true, createdAt: true } }),
      prisma.notificationLog.count({ where: { ...where, readAt: null } })
    ])
    return NextResponse.json({ items, unread })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

const schema = z.object({ ids: z.array(z.string().max(64)).max(200).optional() })

export async function PATCH(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    await prisma.notificationLog.updateMany({
      where: { ...mine(auth.user.id), readAt: null, ...(parsed.data.ids ? { id: { in: parsed.data.ids } } : {}) },
      data: { readAt: new Date() }
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error marking notifications read:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
