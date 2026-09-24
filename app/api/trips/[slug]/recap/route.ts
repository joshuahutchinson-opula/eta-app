import { NextResponse } from 'next/server'
import { getTripRecap } from '@/lib/recap'

export const dynamic = 'force-dynamic'

// GET — recap data for a completed trip (feeds the Edge-rendered share image).
export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const recap = await getTripRecap(params.slug)
    if (!recap) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    return NextResponse.json(recap)
  } catch (error) {
    console.error('Error building recap:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
