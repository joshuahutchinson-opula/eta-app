// GET ?city= — what people searched for most in the last 30 days (queries
// that found something, searched at least twice). Empty until there's data.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isCityCode } from '@/lib/regions'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get('city')
  try {
    const rows = await prisma.searchLog.groupBy({
      by: ['query'],
      where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) }, results: { gt: 0 }, ...(isCityCode(city) ? { city } : {}) },
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: 12
    })
    return NextResponse.json(rows.filter(r => r._count.query >= 2).slice(0, 8).map(r => r.query))
  } catch (error) {
    console.error('Popular searches failed:', error)
    return NextResponse.json([])
  }
}
