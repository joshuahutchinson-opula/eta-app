// app/api/exchange-rate/route.ts — today's USD->JMD rate for the client.
// Refreshed at most once a day server-side; 157 if no rate has ever loaded.
import { NextResponse } from 'next/server'
import { getUsdToJmd } from '@/lib/exchange-rate'

export const dynamic = 'force-dynamic'

export async function GET() {
  const info = await getUsdToJmd()
  return NextResponse.json(info, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
