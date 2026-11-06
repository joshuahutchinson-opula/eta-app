// GET /api/home/fresh?city=&since=ISO — for Home's "What's new" toast after
// a refresh: how many stories and events went up in the town since then.
import { NextResponse } from 'next/server'
import { whatsNew } from '@/lib/home'
import { parseCity } from '@/lib/regions'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const since = new Date(q.get('since') ?? '')
  if (isNaN(since.getTime())) return NextResponse.json({ stories: 0, events: 0 })
  try {
    return NextResponse.json(await whatsNew(parseCity(q.get('city')), new Date(Math.max(since.getTime(), Date.now() - 7 * 86400000))))
  } catch (error) {
    console.error('Whats new failed:', error)
    return NextResponse.json({ stories: 0, events: 0 })
  }
}
