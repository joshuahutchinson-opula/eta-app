import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  try {
    const { userId, vendorId } = await request.json()
    const checkIn = await prisma.checkIn.create({
      data: { userId, vendorId }
    })
    await prisma.vendor.update({
      where: { id: vendorId },
      data: { whoThere: { increment: 1 } }
    })
    return NextResponse.json(checkIn)
  } catch (error) {
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}