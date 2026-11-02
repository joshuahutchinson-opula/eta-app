// POST { email } — start a password reset: a one-hour, single-use link is
// emailed (lib/email.ts). The response is the same whether or not the email
// has an account. When email isn't configured (local dev), the link is also
// returned outside production so the flow can still be tested.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPasswordReset } from '@/lib/auth-tokens'
import { emailConfigured } from '@/lib/email'
import { absoluteUrl } from '@/lib/site-url'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({ email: z.string().trim().toLowerCase().email('Enter your email').max(254) })

export async function POST(request: Request) {
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const { email } = parsed.data
  const limited = rateLimit('forgot', clientIp(request)) ?? rateLimit('forgot', email)
  if (limited) return limited
  try {
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null }, select: { id: true, email: true } })
    let devLink: string | undefined
    if (user) {
      const token = await sendPasswordReset(user)
      if (!emailConfigured() && process.env.NODE_ENV !== 'production') devLink = absoluteUrl(`/reset-password?token=${token}`)
    }
    return NextResponse.json({ ok: true, ...(devLink ? { resetUrl: devLink } : {}) })
  } catch (error) {
    console.error('Forgot password failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
