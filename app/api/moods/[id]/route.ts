import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mood = await prisma.mood.findUnique({
      where: { id: params.id },
      include: { media: true }
    })
    if (!mood) {
      return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    }
    return NextResponse.json(mood)
  } catch (error) {
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}