import { NextResponse } from 'next/server'
import { getBounceSuggestion } from '@/lib/context-engine'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const suggestion = getBounceSuggestion(
      body.currentVendorCategory || null,
      body.userLocation || null,
      body.hour,
      body.tempC,
      body.justBoughtFood,
      body.atVendorForHours
    )
    return NextResponse.json(suggestion)
  } catch (error) {
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}