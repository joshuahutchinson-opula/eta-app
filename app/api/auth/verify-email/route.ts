// POST { token } — confirm an email from the link in the verification email.
// Works whether or not the user is signed in on this device.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashToken } from '@/lib/auth-tokens'
import { publicUser } from '@/lib/auth-server'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({ token: z.string().min(10).max(200) })

export async function POST(request: Request) {
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return NextResponse.json({ error: 'This link is incomplete' }, { status: 400 })
  try {
    const row = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(parsed.data.token) } })
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'This link has expired — send a new one from your profile', code: 'TOKEN_EXPIRED' }, { status: 410 })
    }
    const user = await prisma.$transaction(async tx => {
      await tx.emailVerificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } })
      const current = await tx.user.findUniqueOrThrow({ where: { id: row.userId }, select: { emailVerifiedAt: true } })
      return tx.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: current.emailVerifiedAt ?? new Date() } })
    })
    return NextResponse.json({ ok: true, user: publicUser(user) })
  } catch (error) {
    console.error('Email verification failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
