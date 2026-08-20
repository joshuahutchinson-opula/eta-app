import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const accommodation = await prisma.accommodation.findUnique({
      where: { id: params.id }
    })
    if (!accommodation) {
      return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    }
    return NextResponse.json(accommodation)
  } catch (error) {
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}