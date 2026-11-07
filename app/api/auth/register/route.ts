// POST { name, email, password, acceptTerms: true, referralCode?, phone? } → { token, user }.
// A phone number can only be on one account.
// The account starts unverified and a verification link is emailed; the
// user can browse straight away but must verify before booking or posting.
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { findReferrer } from '@/lib/referrals'
import { normalizePhone } from '@/lib/whatsapp'
import { publicUser, signSession } from '@/lib/auth-server'
import { sendVerification } from '@/lib/auth-tokens'
import { TERMS_VERSION } from '@/lib/legal'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(1, 'Add your name').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Agree to the Terms and Privacy Policy to continue' }) }),
  referralCode: z.string().trim().max(32).optional(),
  phone: z.string().trim().max(24).optional()
})

export async function POST(request: Request) {
  const limited = rateLimit('register', clientIp(request))
  if (limited) return limited
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const { name, email, password, referralCode } = parsed.data
  // One account per phone number.
  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null
  if (parsed.data.phone && !phone) return NextResponse.json({ error: 'Use a phone number with country code', code: 'INVALID_BODY' }, { status: 400 })

  try {
    const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } })
    if (existing) return NextResponse.json({ error: 'There’s already an account with that email — log in instead' }, { status: 409 })
    if (phone && await prisma.user.findUnique({ where: { phone }, select: { id: true } })) {
      return NextResponse.json({ error: 'That phone number is already on another ETA account', code: 'PHONE_TAKEN' }, { status: 409 })
    }

    // A valid referral code links the new account to whoever invited them;
    // the referrer gets points on this user's first visit (lib/visit-earn.ts).
    const referrer = await findReferrer(referralCode)
    const user = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 10),
        name,
        phone,
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: new Date(),
        referredById: referrer?.id,
        referralJoin: referrer ? { create: { referrerId: referrer.id } } : undefined
      }
    })
    await sendVerification(user).catch(err => console.error('Verification email failed:', err))
    return NextResponse.json({ token: signSession(user), user: publicUser(user) })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
