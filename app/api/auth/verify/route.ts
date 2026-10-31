// POST — check a session and return the current user. The token comes from
// the Authorization header, or { token } in the body (the OAuth hand-off on
// /login, before the app has stored it). Expired or revoked → 401 with the
// X-Session: expired header, which signs the app out.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decodeSession, publicUser, sessionExpired, unauthorized } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : typeof body.token === 'string' ? body.token : null
  if (!token) return unauthorized()
  const decoded = decodeSession(token)
  if (!decoded.ok) return decoded.expired ? sessionExpired() : unauthorized()
  try {
    const user = await prisma.user.findUnique({ where: { id: decoded.claims.userId } })
    if (!user || user.deletedAt || user.tokenVersion !== decoded.claims.tv) return sessionExpired()
    return NextResponse.json({ user: publicUser(user) })
  } catch (error) {
    console.error('Session check failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
