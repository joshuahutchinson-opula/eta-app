import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { findReferrer } from '@/lib/referrals'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email, password, name, referralCode } = await request.json()

    const existing = await prisma.user.findUnique({
      where: { email }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Already exists' },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // A valid referral code links the new account to whoever invited them;
    // both get points once this user completes their first booking.
    const referrer = await findReferrer(referralCode)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        referredById: referrer?.id,
        referralJoin: referrer ? { create: { referrerId: referrer.id } } : undefined
      }
    })

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'eta-secret',
      { expiresIn: '7d' }
    )

    const { password: _password, ...safeUser } = user

    return NextResponse.json({ token, user: safeUser })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}