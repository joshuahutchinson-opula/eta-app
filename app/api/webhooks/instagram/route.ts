// /api/webhooks/instagram — Instagram Messaging webhook (lib/instagram.ts).
// GET  — Meta's subscription check: echoes hub.challenge when
//        hub.verify_token matches INSTAGRAM_VERIFY_TOKEN.
// POST — signed (X-Hub-Signature-256) events; story mentions of @ETA are
//        matched to a recent QR scan and queued for the vendor's approval.
// Answers 404 until the INSTAGRAM_* settings are present.
import { NextResponse } from 'next/server'
import { instagramConfigured, mentionsIn, recordMention, validSignature } from '@/lib/instagram'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!instagramConfigured()) return NextResponse.json({ error: 'Instagram is not configured' }, { status: 404 })
  const q = new URL(request.url).searchParams
  if (q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === process.env.INSTAGRAM_VERIFY_TOKEN) {
    return new NextResponse(q.get('hub.challenge') ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(request: Request) {
  if (!instagramConfigured()) return NextResponse.json({ error: 'Instagram is not configured' }, { status: 404 })
  const limited = rateLimit('webhook', clientIp(request))
  if (limited) return limited
  const raw = await request.text()
  if (!validSignature(raw, request.headers.get('x-hub-signature-256'))) return NextResponse.json({ error: 'Bad signature' }, { status: 401 })
  let payload: unknown
  try { payload = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }
  const results: string[] = []
  for (const m of mentionsIn(payload)) {
    try { results.push(await recordMention(m)) } catch (error) { console.error('Instagram mention failed:', error); results.push('error') }
  }
  // Always 200 once verified, so Meta doesn't keep retrying events we chose to skip.
  return NextResponse.json({ received: results.length, results })
}
