// lib/oauth.ts — Google and Apple sign-in, each switched on by env vars:
//   Google: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//   Apple:  APPLE_CLIENT_ID (Services ID), APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (.p8 contents)
// Unconfigured providers report false from /api/auth/providers and the login
// screen hides their buttons. Callbacks land on /api/auth/oauth/<provider>/callback,
// which must be registered with each provider as NEXT_PUBLIC_SITE_URL + that path.
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { signSession } from '@/lib/auth-server'
import { siteUrl } from '@/lib/site-url'
import { TERMS_VERSION } from '@/lib/legal'

export type Provider = 'google' | 'apple'

export function providerConfigured(p: Provider): boolean {
  if (p === 'google') return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  return Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY)
}

export function callbackUrl(p: Provider): string {
  return `${siteUrl()}/api/auth/oauth/${p}/callback`
}

export function authorizeUrl(p: Provider, state: string): string {
  if (p === 'google') {
    const q = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: callbackUrl(p), response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' })
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
  }
  const q = new URLSearchParams({ client_id: process.env.APPLE_CLIENT_ID!, redirect_uri: callbackUrl(p), response_type: 'code', response_mode: 'form_post', scope: 'name email', state })
  return `https://appleid.apple.com/auth/authorize?${q}`
}

function appleClientSecret(): string {
  return jwt.sign({}, process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n'), {
    algorithm: 'ES256',
    expiresIn: '5m',
    audience: 'https://appleid.apple.com',
    issuer: process.env.APPLE_TEAM_ID,
    subject: process.env.APPLE_CLIENT_ID,
    keyid: process.env.APPLE_KEY_ID
  })
}

/** Trades the authorization code for the provider's ID token and reads who signed in. */
export interface OAuthIdentity { email: string; name: string | null; picture: string | null; emailVerified: boolean }

export async function exchangeCode(p: Provider, code: string): Promise<OAuthIdentity> {
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    redirect_uri: callbackUrl(p),
    client_id: p === 'google' ? process.env.GOOGLE_CLIENT_ID! : process.env.APPLE_CLIENT_ID!,
    client_secret: p === 'google' ? process.env.GOOGLE_CLIENT_SECRET! : appleClientSecret()
  })
  const res = await fetch(p === 'google' ? 'https://oauth2.googleapis.com/token' : 'https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  const data = await res.json()
  if (!res.ok || typeof data.id_token !== 'string') throw new Error('Sign-in was cancelled or expired')
  // The ID token came straight from the provider over TLS in exchange for our secret.
  const claims = jwt.decode(data.id_token) as { email?: string; name?: string; picture?: string; email_verified?: boolean | string } | null
  if (!claims?.email) throw new Error('Your account didn’t share an email address')
  // Apple only hands out verified (or private-relay) addresses; Google says so in the claim.
  const emailVerified = p === 'apple' || claims.email_verified === true || claims.email_verified === 'true'
  return { email: claims.email.toLowerCase(), name: claims.name ?? null, picture: claims.picture ?? null, emailVerified }
}

/** Apple sends the user's name only on their first sign-in, as a JSON form field. */
export function appleName(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const u = JSON.parse(raw) as { name?: { firstName?: string; lastName?: string } }
    const full = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(' ').trim()
    return full || null
  } catch {
    return null
  }
}

/**
 * Finds or creates the ETA account for this email and returns a session
 * token. Signing in with the provider counts as accepting the terms (the
 * login screen says so next to the buttons).
 */
export async function sessionFor(identity: OAuthIdentity): Promise<string> {
  const existing = await prisma.user.findFirst({ where: { email: { equals: identity.email, mode: 'insensitive' } } })
  if (existing?.deletedAt) throw new Error('This account was deleted')
  const user = existing
    ? (identity.emailVerified && !existing.emailVerifiedAt
        ? await prisma.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: new Date() } })
        : existing)
    : await prisma.user.create({
        data: {
          email: identity.email,
          name: identity.name ?? identity.email.split('@')[0],
          avatarUrl: identity.picture,
          emailVerifiedAt: identity.emailVerified ? new Date() : null,
          termsVersion: TERMS_VERSION,
          termsAcceptedAt: new Date()
        }
      })
  return signSession(user)
}
