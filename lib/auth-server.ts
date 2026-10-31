// lib/auth-server.ts — who's calling, from the JWT the app keeps in
// localStorage (eta_token) and sends as "Authorization: Bearer …".
//
// Every write route and every route that returns a user's own data goes
// through requireUser(). Public reads (vendors, experiences, events...) can
// use userIdFromRequest() to personalise without requiring a login.
//
// Sessions last SESSION_TTL. A token stops working early when the user logs
// out (or deletes their account): both bump User.tokenVersion, and the token
// carries the version it was issued with.
import jwt from 'jsonwebtoken'
import { NextResponse } from 'next/server'
import type { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const SESSION_TTL = '7d'

/** Fails loudly when the secret is missing — there is no fallback. */
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set. Add it to the environment (any long random string) before starting ETA.')
  return secret
}

interface SessionClaims {
  userId: string
  role: Role
  tv: number
}

export function signSession(user: { id: string; role: Role; tokenVersion: number }): string {
  return jwt.sign({ userId: user.id, role: user.role, tv: user.tokenVersion } satisfies SessionClaims, jwtSecret(), { expiresIn: SESSION_TTL })
}

function bearer(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

type Decoded = { ok: true; claims: SessionClaims } | { ok: false; expired: boolean }

export function decodeSession(token: string): Decoded {
  try {
    const claims = jwt.verify(token, jwtSecret()) as Partial<SessionClaims>
    if (typeof claims.userId !== 'string') return { ok: false, expired: false }
    return { ok: true, claims: { userId: claims.userId, role: claims.role ?? 'EXPLORER', tv: typeof claims.tv === 'number' ? claims.tv : 0 } }
  } catch (e) {
    return { ok: false, expired: e instanceof jwt.TokenExpiredError }
  }
}

/** The caller's id when they sent a valid token; null otherwise. For optional personalisation only. */
export function userIdFromRequest(request: Request): string | null {
  const token = bearer(request)
  if (!token) return null
  const decoded = decodeSession(token)
  return decoded.ok ? decoded.claims.userId : null
}

export interface AuthedUser {
  id: string
  role: Role
  email: string
  name: string
  emailVerified: boolean
}

type AuthResult = { ok: true; user: AuthedUser } | { ok: false; response: NextResponse }

/**
 * The response the app's session guard (components/SessionGuard) watches for:
 * the X-Session: expired header signs the user out with a message.
 */
export function sessionExpired(): NextResponse {
  return NextResponse.json({ error: 'Your session has expired — log in again', code: 'SESSION_EXPIRED' }, { status: 401, headers: { 'X-Session': 'expired' } })
}

export function unauthorized(message = 'Log in first'): NextResponse {
  return NextResponse.json({ error: message, code: 'LOGIN_REQUIRED' }, { status: 401 })
}

/**
 * Requires a signed-in user.
 *  verified: the email must be confirmed (booking, reviewing, posting).
 *  role: 'ADMIN' for admin-only writes.
 */
export async function requireUser(
  request: Request,
  opts: { verified?: boolean; role?: 'ADMIN'; message?: string } = {}
): Promise<AuthResult> {
  const token = bearer(request)
  if (!token) return { ok: false, response: unauthorized(opts.message) }
  const decoded = decodeSession(token)
  if (!decoded.ok) return { ok: false, response: decoded.expired ? sessionExpired() : unauthorized(opts.message) }

  const user = await prisma.user.findUnique({
    where: { id: decoded.claims.userId },
    select: { id: true, role: true, email: true, name: true, emailVerifiedAt: true, tokenVersion: true, deletedAt: true }
  })
  if (!user || user.deletedAt || user.tokenVersion !== decoded.claims.tv) return { ok: false, response: sessionExpired() }

  if (opts.role === 'ADMIN' && user.role !== 'ADMIN') {
    return { ok: false, response: NextResponse.json({ error: 'Only ETA admins can do that', code: 'FORBIDDEN' }, { status: 403 }) }
  }
  if (opts.verified && !user.emailVerifiedAt) {
    return { ok: false, response: NextResponse.json({ error: 'Verify your email first — check your inbox for the link', code: 'EMAIL_UNVERIFIED' }, { status: 403 }) }
  }
  return { ok: true, user: { id: user.id, role: user.role, email: user.email, name: user.name, emailVerified: Boolean(user.emailVerifiedAt) } }
}

/**
 * For the vendor app (not built yet): ADMIN, or a VENDOR-role user who owns
 * the given vendor.
 */
export async function canActForVendor(user: AuthedUser, vendorId: string | null | undefined): Promise<boolean> {
  if (user.role === 'ADMIN') return true
  if (user.role !== 'VENDOR' || !vendorId) return false
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { ownerId: true } })
  return vendor?.ownerId === user.id
}

/** What the app stores as the signed-in user (never the password hash). */
export function publicUser<T extends { password?: string | null; tokenVersion?: number }>(user: T) {
  const { password: _password, tokenVersion: _tv, ...rest } = user
  return rest
}
