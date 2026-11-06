// GET /api/vibe?city= — the Vibe feed for a region (lib/vibe-feed.ts):
// { enabled, items }. enabled is false until the region has enough fresh
// video, and then the app hides every way into the feed.
import { NextResponse } from 'next/server'
import { vibeFeed } from '@/lib/vibe-feed'
import { parseCity } from '@/lib/regions'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    return NextResponse.json(await vibeFeed(parseCity(new URL(request.url).searchParams.get('city'))))
  } catch (error) {
    console.error('Vibe feed failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
