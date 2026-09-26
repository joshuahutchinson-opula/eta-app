// app/api/auth/demo/route.ts — signs the mobile app into the demo account so
// every feature is visible without logging in. On unless DEMO_AUTO_LOGIN=false;
// turn it off before real users arrive — everyone shares this one account.
// DEMO_USER_EMAIL picks the account (default: Jordan from the seed).
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST() {
  if (process.env.DEMO_AUTO_LOGIN === 'false') {
    return NextResponse.json({ error: 'Demo login is off' }, { status: 404 })
  }
  const email = process.env.DEMO_USER_EMAIL || 'jordan@eta.app'
  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return NextResponse.json({ error: 'Demo account not found' }, { status: 404 })
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'eta-secret',
      { expiresIn: '7d' }
    )
    const { password: _password, ...safeUser } = user
    return NextResponse.json({ token, user: safeUser })
  } catch (error) {
    console.error('Demo login failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
