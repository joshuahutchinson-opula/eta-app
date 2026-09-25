// app/api/experiences/generate/route.ts — three multi-stop options for the
// Experiences survey, built from live vendors and photo spots (see
// lib/experience-generator.ts). POST the survey answers; nothing is saved.
import { NextResponse } from 'next/server'
import { generateBundles, type GeneratorInput, type TimeBudget } from '@/lib/experience-generator'

export const dynamic = 'force-dynamic'

const TIMES: TimeBudget[] = ['2hr', 'half', 'full', 'night']

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const input: GeneratorInput = {
    moods: Array.isArray(body.moods) ? body.moods.filter((m: unknown) => typeof m === 'string').slice(0, 5) : [],
    time: TIMES.includes(body.time) ? body.time : 'half',
    crewSize: Math.min(20, Math.max(1, Math.round(Number(body.crewSize) || 1))),
    budget: [1, 2, 3, 4].includes(Number(body.budget)) ? Number(body.budget) : undefined,
    occasion: typeof body.occasion === 'string' ? body.occasion.slice(0, 40) : undefined,
    city: body.city === 'MONTEGO_BAY' ? 'MONTEGO_BAY' : 'NEGRIL',
    transport: ['drive', 'walk', 'handled'].includes(body.transport) ? body.transport : undefined
  }
  try {
    const bundles = await generateBundles(input)
    return NextResponse.json({ bundles })
  } catch (error) {
    console.error('Error generating experiences:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
