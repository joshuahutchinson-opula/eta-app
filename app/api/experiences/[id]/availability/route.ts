// GET ?date=YYYY-MM-DD — each start time's capacity, spots taken and left,
// sold out, closed, and whether it has already passed (Jamaica time).
import { NextResponse } from 'next/server'
import { slotStates } from '@/lib/slots'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const date = new URL(request.url).searchParams.get('date') ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Pick a date' }, { status: 400 })
  try {
    return NextResponse.json({ date, slots: await slotStates(params.id, date) })
  } catch (error) {
    console.error('Error checking slots:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
