// lib/rate-limit.ts — the one place request throttling lives.
// In-memory fixed windows per key, which is fine for a single Railway
// instance. To scale out, swap the Map for Redis (INCR + PEXPIRE on the same
// key) behind the same hit() signature; callers don't change.
import { NextResponse } from 'next/server'

interface Bucket { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()

function sweep(now: number) {
  if (now - lastSweep < 60000) return
  lastSweep = now
  buckets.forEach((b, k) => { if (b.resetAt <= now) buckets.delete(k) })
}

/** Counts one hit; returns how long to wait (ms) when over the limit, else 0. */
export function hit(key: string, limit: number, windowMs: number): number {
  const now = Date.now()
  sweep(now)
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return 0
  }
  b.count++
  return b.count > limit ? b.resetAt - now : 0
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  return (fwd ? fwd.split(',')[0] : request.headers.get('x-real-ip') ?? 'local').trim()
}

/** Named limits, so every route throttles the same action the same way. */
export const LIMITS = {
  login: { limit: 10, windowMs: 15 * 60000 },
  register: { limit: 5, windowMs: 60 * 60000 },
  forgot: { limit: 5, windowMs: 60 * 60000 },
  reset: { limit: 10, windowMs: 60 * 60000 },
  verifyResend: { limit: 5, windowMs: 60 * 60000 },
  upload: { limit: 30, windowMs: 60 * 60000 },
  review: { limit: 10, windowMs: 60 * 60000 },
  story: { limit: 20, windowMs: 60 * 60000 },
  report: { limit: 20, windowMs: 60 * 60000 },
  webTrip: { limit: 20, windowMs: 60 * 60000 },
  message: { limit: 60, windowMs: 10 * 60000 }
} as const

export type LimitName = keyof typeof LIMITS

/**
 * Returns a 429 response when `who` (an IP or user id) has used up `name`,
 * or null to carry on.
 */
export function rateLimit(name: LimitName, who: string): NextResponse | null {
  const { limit, windowMs } = LIMITS[name]
  const wait = hit(`${name}:${who}`, limit, windowMs)
  if (!wait) return null
  const minutes = Math.max(1, Math.ceil(wait / 60000))
  return NextResponse.json(
    { error: `Too many tries — wait ${minutes} min and try again`, code: 'RATE_LIMITED' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(wait / 1000)) } }
  )
}
