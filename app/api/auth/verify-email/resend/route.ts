// POST — email a fresh verification link to the signed-in user.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { sendVerification } from '@/lib/auth-tokens'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  if (auth.user.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true })
  const limited = rateLimit('verifyResend', auth.user.id)
  if (limited) return limited
  try {
    await sendVerification(auth.user)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Resend verification failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
