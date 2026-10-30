// lib/oauth.ts — Google and Apple sign-in, each switched on by env vars:
//   Google: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//   Apple:  APPLE_CLIENT_ID (Services ID), APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (.p8 contents)
// Unconfigured providers report false from /api/auth/providers and the login
// screen hides their buttons. Callbacks land on /api/auth/oauth/<provider>/callback.
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

export type Provider = 'google' | 'apple'

export function providerConfigured(p: Provider): boolean {
  if (p === 'google') return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  return Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY)
}

export function siteOrigin(request: Request): string {
  return process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : new URL(request.url).origin)
}

export function callbackUrl(request: Request, p: Provider): string {
  return `${siteOrigin(request)}/api/auth/oauth/${p}/callback`
}

export function authorizeUrl(request: Request, p: Provider, state: string): string {
  if (p === 'google') {
    const q = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: callbackUrl(request, p), response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' })
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
  }
  const q = new URLSearchParams({ client_id: process.env.APPLE_CLIENT_ID!, redirect_uri: callbackUrl(request, p), response_type: 'code', response_mode: 'form_post', scope: 'name email', state })
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
export async function exchangeCode(request: Request, p: Provider, code: string): Promise<{ email: string; name: string | null; picture: string | null }> {
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    redirect_uri: callbackUrl(request, p),
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
  const claims = jwt.decode(data.id_token) as { email?: string; name?: string; picture?: string } | null
  if (!claims?.email) throw new Error('Your account didn’t share an email address')
  return { email: claims.email.toLowerCase(), name: claims.name ?? null, picture: claims.picture ?? null }
}

/** Finds or creates the ETA account for this email and returns a session token. */
export async function sessionFor(identity: { email: string; name: string | null; picture: string | null }) {
  const user = await prisma.user.upsert({
    where: { email: identity.email },
    update: {},
    create: { email: identity.email, name: identity.name ?? identity.email.split('@')[0], avatarUrl: identity.picture }
  })
  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'eta-secret', { expiresIn: '7d' })
  return token
}
