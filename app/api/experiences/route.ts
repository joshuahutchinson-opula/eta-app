import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const experiences = await prisma.experience.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(experiences)
  } catch (error) {
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}