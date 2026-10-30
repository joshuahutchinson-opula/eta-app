// Google returns here with GET ?code&state; Apple with a form POST. On
// success the app gets its session token via /login?oauth=<token>, which
// stores it the same way an email login does.
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeCode, providerConfigured, sessionFor, siteOrigin, type Provider } from '@/lib/oauth'

export const dynamic = 'force-dynamic'

async function finish(request: Request, provider: string, code: string | null, state: string | null) {
  const origin = siteOrigin(request)
  const fail = (reason: string) => NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`, { status: 303 })
  if ((provider !== 'google' && provider !== 'apple') || !providerConfigured(provider as Provider)) return fail('provider')
  const expected = cookies().get('eta_oauth_state')?.value
  if (!code || !state || !expected || state !== expected) return fail('expired')
  try {
    const identity = await exchangeCode(request, provider as Provider, code)
    const token = await sessionFor(identity)
    const res = NextResponse.redirect(`${origin}/login?oauth=${encodeURIComponent(token)}`, { status: 303 })
    res.cookies.delete('eta_oauth_state')
    return res
  } catch (error) {
    console.error('OAuth sign-in failed:', error)
    return fail('failed')
  }
}

export async function GET(request: Request, { params }: { params: { provider: string } }) {
  const q = new URL(request.url).searchParams
  return finish(request, params.provider, q.get('code'), q.get('state'))
}

export async function POST(request: Request, { params }: { params: { provider: string } }) {
  const form = await request.formData().catch(() => null)
  return finish(request, params.provider, form?.get('code')?.toString() ?? null, form?.get('state')?.toString() ?? null)
}
