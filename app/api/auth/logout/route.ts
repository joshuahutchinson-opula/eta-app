// POST — log out. Bumps tokenVersion so this token (and any other copy of
// it) stops working; the app clears its own storage (lib/auth-client.ts).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireUser(request)
  // Already signed out or expired: nothing to revoke.
  if (!auth.ok) return NextResponse.json({ ok: true })
  try {
    await prisma.user.update({ where: { id: auth.user.id }, data: { tokenVersion: { increment: 1 } } })
    await prisma.alertSubscription.updateMany({ where: { userId: auth.user.id }, data: { userId: null } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Logout failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
