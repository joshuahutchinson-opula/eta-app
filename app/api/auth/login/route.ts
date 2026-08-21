import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Nuttin nuh go suh' },
        { status: 401 }
      )
    }

    const valid = await bcrypt.compare(password, user.password || '')

    if (!valid) {
      return NextResponse.json(
        { error: 'Nuttin nuh go suh' },
        { status: 401 }
      )
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'eta-secret',
      { expiresIn: '7d' }
    )

    return NextResponse.json({ token, user })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}