// POST { token, password } — finish a password reset and sign the user in.
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!token) return NextResponse.json({ error: 'This reset link is missing its code' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Use at least 8 characters' }, { status: 400 })
  try {
    const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: crypto.createHash('sha256').update(token).digest('hex') } })
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'This reset link has expired — ask for a new one' }, { status: 410 })
    }
    const user = await prisma.$transaction(async tx => {
      await tx.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } })
      return tx.user.update({ where: { id: row.userId }, data: { password: await bcrypt.hash(password, 10) } })
    })
    const session = jwt.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'eta-secret', { expiresIn: '7d' })
    const { password: _password, ...safeUser } = user
    return NextResponse.json({ token: session, user: safeUser })
  } catch (error) {
    console.error('Password reset failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
