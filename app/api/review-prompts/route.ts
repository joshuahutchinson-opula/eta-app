// /api/review-prompts — "How was <vendor>?" after a QR visit or an in-app
// payment (lib/review-prompts.ts).
// GET  (signed in) → { prompt } due now, or null.
// POST { id, action: "shown" | "skip" | "done" } → { ok }.
//      The review itself goes to POST /api/reviews.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { answerPrompt, duePrompt } from '@/lib/review-prompts'
import { id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    return NextResponse.json({ prompt: await duePrompt(auth.user.id) })
  } catch (error) {
    console.error('Review prompt failed:', error)
    return NextResponse.json({ prompt: null })
  }
}

export async function POST(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ id, action: z.enum(['shown', 'skip', 'done']) }))
  if (!parsed.ok) return parsed.response
  try {
    await answerPrompt(auth.user.id, parsed.data.id, parsed.data.action)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Review prompt answer failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
