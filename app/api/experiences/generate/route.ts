// app/api/experiences/generate/route.ts — three multi-stop options for the
// Experiences planner, built from live vendors and photo spots (see
// lib/experience-generator.ts). POST the planner answers; nothing is saved.
// The planner sends one `mood`; the older `moods` list still works.
import { NextResponse } from 'next/server'
import { parseCity } from '@/lib/regions'
import { generateBundles, type GeneratorInput, type TimeBudget } from '@/lib/experience-generator'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const TIMES: TimeBudget[] = ['2hr', 'half', 'full', 'night']

export async function POST(request: Request) {
  const parsed = await parseBody(request, z.object({
    mood: z.string().max(60).optional(),
    moods: z.array(z.string().max(60)).max(5).default([]),
    time: z.enum(TIMES as [TimeBudget, ...TimeBudget[]]).catch('half').default('half'),
    crewSize: z.number().int().min(1).max(20).catch(1).default(1),
    budget: z.number().int().min(1).max(4).optional().catch(undefined),
    occasion: z.string().max(40).optional(),
    city: z.string().max(32).optional(),
    transport: z.enum(['drive', 'walk', 'handled']).optional().catch(undefined),
    anchor: z.object({ type: z.enum(['vendor', 'photospot']), id: z.string().min(1).max(40) }).optional().catch(undefined)
  }))
  if (!parsed.ok) return parsed.response
  const { mood, ...body } = parsed.data
  const input: GeneratorInput = { ...body, moods: mood ? [mood] : body.moods, city: parseCity(body.city) }
  try {
    const bundles = await generateBundles(input)
    return NextResponse.json({ bundles })
  } catch (error) {
    console.error('Error generating experiences:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
