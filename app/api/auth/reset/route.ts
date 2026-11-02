// POST { token, password } — finish a password reset and sign the user in.
// Changing the password ends every other session (tokenVersion bump), and
// opening the emailed link proves the inbox, so the email counts as verified.
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publicUser, signSession } from '@/lib/auth-server'
import { hashToken } from '@/lib/auth-tokens'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({
  token: z.string().min(10, 'This reset link is missing its code').max(200),
  password: z.string().min(8, 'Use at least 8 characters').max(200)
})

export async function POST(request: Request) {
  const limited = rateLimit('reset', clientIp(request))
  if (limited) return limited
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const { token, password } = parsed.data
  try {
    const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } })
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'This reset link has expired — ask for a new one' }, { status: 410 })
    }
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.$transaction(async tx => {
      await tx.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } })
      const u = await tx.user.findUniqueOrThrow({ where: { id: row.userId }, select: { emailVerifiedAt: true } })
      return tx.user.update({
        where: { id: row.userId },
        data: { password: hash, tokenVersion: { increment: 1 }, emailVerifiedAt: u.emailVerifiedAt ?? new Date() }
      })
    })
    return NextResponse.json({ token: signSession(user), user: publicUser(user) })
  } catch (error) {
    console.error('Password reset failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
