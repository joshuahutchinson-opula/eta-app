// app/api/notifications/route.ts — the in-app alert inbox: every alert sent
// to the signed-in user's devices (NotificationLog), newest first.
// GET → { items, unread }.  PATCH { ids?: string[] } → mark read (all when no ids).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { userIdFromRequest } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const userId = userIdFromRequest(request)
  if (!userId) return NextResponse.json({ items: [], unread: 0 })
  try {
    const where = { subscription: { userId }, title: { not: null } }
    const [items, unread] = await Promise.all([
      prisma.notificationLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 60, select: { id: true, title: true, body: true, url: true, readAt: true, createdAt: true } }),
      prisma.notificationLog.count({ where: { ...where, readAt: null } })
    ])
    return NextResponse.json({ items, unread })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const userId = userIdFromRequest(request)
  if (!userId) return NextResponse.json({ error: 'Log in first' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const ids = Array.isArray(body.ids) ? body.ids.filter((x: unknown): x is string => typeof x === 'string') : null
  try {
    await prisma.notificationLog.updateMany({
      where: { subscription: { userId }, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() }
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error marking notifications read:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
