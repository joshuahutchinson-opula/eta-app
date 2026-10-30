// GET — start Google / Apple sign-in: remember a random state in a cookie and
// send the browser to the provider.
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { authorizeUrl, providerConfigured, type Provider } from '@/lib/oauth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { provider: string } }) {
  const provider = params.provider as Provider
  if ((provider !== 'google' && provider !== 'apple') || !providerConfigured(provider)) {
    return NextResponse.redirect(new URL('/login?error=provider', request.url))
  }
  const state = crypto.randomBytes(16).toString('hex')
  const res = NextResponse.redirect(authorizeUrl(request, provider, state))
  // Apple posts back cross-site, so the cookie must allow that.
  res.cookies.set('eta_oauth_state', state, { httpOnly: true, secure: true, sameSite: provider === 'apple' ? 'none' : 'lax', path: '/', maxAge: 600 })
  return res
}
