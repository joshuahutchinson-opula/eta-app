import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWeather } from '@/lib/weather'
import { parseCity } from '@/lib/regions'
import { getBounceSuggestion } from '@/lib/context-engine'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

async function buildContext(body: { city?: string; hour?: number; currentVendorCategory?: string | null; justBoughtFood?: boolean; atVendorForHours?: number }) {
  const city = parseCity(body.city)
  // Suggestions follow Jamaica time, not the server's clock.
  const hour = typeof body.hour === 'number'
    ? body.hour
    : Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Jamaica' }).format(new Date())) % 24

  const [vendors, weather] = await Promise.all([
    prisma.vendor.findMany({
      where: { city, open: true, visibleInMarketplace: true, isTransport: false },
      orderBy: [{ live: 'desc' }, { isPremium: 'desc' }],
      take: 40
    }),
    getWeather(city)
  ])

  const suggestion = getBounceSuggestion(
    body.currentVendorCategory ?? null,
    null,
    hour,
    weather?.tempC ?? 28,
    Boolean(body.justBoughtFood),
    Number(body.atVendorForHours) || 0,
    { weather, vendors }
  )
  const suggestedVendor = suggestion.vendorId ? vendors.find(v => v.id === suggestion.vendorId) : undefined

  return {
    vendors: vendors.slice(0, 10),
    weather,
    suggestion: {
      ...suggestion,
      vendor: suggestedVendor ? { id: suggestedVendor.id, name: suggestedVendor.name, image: suggestedVendor.images[0] ?? null } : null
    }
  }
}

// GET /api/context?city=NEGRIL — weather + a context-aware suggestion for right now.
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    return NextResponse.json(await buildContext({ city: params.get('city') ?? undefined }))
  } catch (error) {
    console.error('Error in context engine:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const parsed = await parseBody(request, z.object({
      city: z.string().max(32).optional(),
      hour: z.number().int().min(0).max(23).optional(),
      currentVendorCategory: z.string().max(32).nullable().optional(),
      justBoughtFood: z.boolean().optional(),
      atVendorForHours: z.number().min(0).max(24).optional()
    }))
    if (!parsed.ok) return parsed.response
    return NextResponse.json(await buildContext(parsed.data))
  } catch (error) {
    console.error('Error in context engine:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
