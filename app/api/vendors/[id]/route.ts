import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: params.id },
      include: {
        stories: true,
        reviews: {
          include: {
            user: { select: { name: true } }
          }
        }
      }
    })
    if (!vendor) {
      return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    }
    return NextResponse.json(vendor)
  } catch (error) {
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}