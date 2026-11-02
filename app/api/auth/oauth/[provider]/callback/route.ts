// Google returns here with GET ?code&state; Apple with a form POST. On
// success the app gets its session token in the URL fragment
// (/login#oauth=<token>) — fragments never reach server logs — and the login
// screen stores it the same way an email login does.
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { appleName, exchangeCode, providerConfigured, sessionFor, type Provider } from '@/lib/oauth'
import { siteUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

async function finish(provider: string, code: string | null, state: string | null, name: string | null) {
  const origin = siteUrl()
  const fail = (reason: string) => NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`, { status: 303 })
  if ((provider !== 'google' && provider !== 'apple') || !providerConfigured(provider as Provider)) return fail('provider')
  const expected = cookies().get('eta_oauth_state')?.value
  if (!code || !state || !expected || state !== expected) return fail('expired')
  try {
    const identity = await exchangeCode(provider as Provider, code)
    const token = await sessionFor({ ...identity, name: identity.name ?? name })
    const res = NextResponse.redirect(`${origin}/login#oauth=${encodeURIComponent(token)}`, { status: 303 })
    res.cookies.delete('eta_oauth_state')
    return res
  } catch (error) {
    console.error('OAuth sign-in failed:', error)
    return fail('failed')
  }
}

export async function GET(request: Request, { params }: { params: { provider: string } }) {
  const q = new URL(request.url).searchParams
  return finish(params.provider, q.get('code'), q.get('state'), null)
}

export async function POST(request: Request, { params }: { params: { provider: string } }) {
  const form = await request.formData().catch(() => null)
  return finish(params.provider, form?.get('code')?.toString() ?? null, form?.get('state')?.toString() ?? null, appleName(form?.get('user')?.toString()))
}
