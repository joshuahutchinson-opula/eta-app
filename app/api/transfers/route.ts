// GET /api/transfers?airport=MBJ&lat=&lng= — up to three vetted transfers
// from the airport to the stay at (lat, lng), each with its fixed price, plus
// the distance and roughly how long the drive takes.
import { NextResponse } from 'next/server'
import { transferOptions } from '@/lib/transfers'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const lat = Number(q.get('lat'))
  const lng = Number(q.get('lng'))
  if (!q.get('lat') || !q.get('lng') || !Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  try {
    const result = await transferOptions(q.get('airport') ?? '', { lat, lng })
    return result ? NextResponse.json(result) : NextResponse.json({ error: 'Unknown airport' }, { status: 404 })
  } catch (error) {
    console.error('Transfer options failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
