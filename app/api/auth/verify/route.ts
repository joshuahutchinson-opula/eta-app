import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { token } = await request.json()

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'eta-secret')

    const user = await prisma.user.findUnique({
      where: { id: (decoded as any).userId }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Nuttin nuh go suh' },
        { status: 401 }
      )
    }

    return NextResponse.json({ user })
  } catch (error) {
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 401 }
    )
  }
}