// lib/cron.ts — scheduled jobs (alert sweep, reminders) call protected
// routes with the x-cron-secret header. CRON_SECRET must be set; without it
// those routes refuse every call rather than running unprotected.
import crypto from 'crypto'
import { NextResponse } from 'next/server'

/** Null when the request carries the right secret; otherwise the response to send. */
export function cronAuthorized(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured on this server' }, { status: 503 })
  const given = request.headers.get('x-cron-secret') ?? ''
  const a = Buffer.from(secret)
  const b = Buffer.from(given)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}
