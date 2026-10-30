// GET ?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD → { available, nights, unavailable: [dates] }
import { NextResponse } from 'next/server'
import { nightsOf, unavailableNights } from '@/lib/availability'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const q = new URL(request.url).searchParams
  const checkIn = q.get('checkIn') ?? ''
  const checkOut = q.get('checkOut') ?? ''
  const nights = nightsOf(checkIn, checkOut).length
  if (nights === 0) return NextResponse.json({ error: 'Pick a check-out after check-in' }, { status: 400 })
  try {
    const unavailable = await unavailableNights(params.id, checkIn, checkOut)
    return NextResponse.json({ available: unavailable.length === 0, nights, unavailable })
  } catch (error) {
    console.error('Error checking availability:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
