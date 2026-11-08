// GET ?city=NEGRIL — the Market tab for a town (lib/market.ts): every
// section's vendors, deals, dishes, local favourites, open-late hours and stays.
import { NextResponse } from 'next/server'
import { parseCity } from '@/lib/regions'
import { marketFor } from '@/lib/market'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const city = parseCity(new URL(request.url).searchParams.get('city'))
  try {
    return NextResponse.json(await marketFor(city))
  } catch (error) {
    console.error('Error building market:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
