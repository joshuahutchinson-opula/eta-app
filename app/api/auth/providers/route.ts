// GET → which social sign-ins are configured, so the login screen only shows those.
import { NextResponse } from 'next/server'
import { providerConfigured } from '@/lib/oauth'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ google: providerConfigured('google'), apple: providerConfigured('apple') })
}
