// POST { email } — start a password reset. Creates a one-hour token (only its
// hash is stored) and "sends" the reset link. Email isn't wired up yet, so the
// link is written to the server log; outside production it's also returned so
// the flow can be tested. The response is the same whether or not the email
// has an account.
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { siteOrigin } from '@/lib/oauth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email) return NextResponse.json({ error: 'Enter your email' }, { status: 400 })
  try {
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true, email: true } })
    let resetUrl: string | undefined
    if (user) {
      const token = crypto.randomBytes(32).toString('base64url')
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 3600000) }
      })
      resetUrl = `${siteOrigin(request)}/reset-password?token=${token}`
      // Stub for the email: swap this log for a real send when email is set up.
      console.log(`[password reset] ${user.email}: ${resetUrl}`)
    }
    return NextResponse.json({ ok: true, ...(process.env.NODE_ENV !== 'production' && resetUrl ? { resetUrl } : {}) })
  } catch (error) {
    console.error('Forgot password failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
