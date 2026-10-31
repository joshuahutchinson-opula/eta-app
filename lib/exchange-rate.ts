// lib/exchange-rate.ts — the USD→JMD rate, fetched at most once a day from a
// free rates API (no key needed) and cached in memory and in the
// ExchangeRate table so restarts don't refetch. If the fetch fails, the last
// stored rate is used, and failing that FALLBACK_USD_TO_JMD (157).
// Override the source with EXCHANGE_RATE_URL (must return { rates: { JMD } }).
import { prisma } from '@/lib/prisma'
import { FALLBACK_USD_TO_JMD } from '@/lib/money'

const SOURCE = process.env.EXCHANGE_RATE_URL || 'https://open.er-api.com/v6/latest/USD'
const MAX_AGE_MS = 24 * 3600000
const ID = 'USD_JMD'

export interface RateInfo { rate: number; fetchedAt: string | null; source: string }

let memo: RateInfo | null = null
let inflight: Promise<RateInfo> | null = null

async function fetchRate(): Promise<number | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(SOURCE, { signal: controller.signal, cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const rate = Number(data?.rates?.JMD)
    // Sanity range: JMD has traded around 150–165 per USD; reject nonsense.
    return Number.isFinite(rate) && rate > 50 && rate < 500 ? rate : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function load(): Promise<RateInfo> {
  const stored = await prisma.exchangeRate.findUnique({ where: { id: ID } }).catch(() => null)
  if (stored && Date.now() - stored.fetchedAt.getTime() < MAX_AGE_MS) {
    return { rate: stored.rate, fetchedAt: stored.fetchedAt.toISOString(), source: stored.source }
  }
  const fresh = await fetchRate()
  if (fresh !== null) {
    const fetchedAt = new Date()
    await prisma.exchangeRate.upsert({ where: { id: ID }, create: { id: ID, rate: fresh, source: SOURCE, fetchedAt }, update: { rate: fresh, source: SOURCE, fetchedAt } }).catch(() => {})
    return { rate: fresh, fetchedAt: fetchedAt.toISOString(), source: SOURCE }
  }
  if (stored) return { rate: stored.rate, fetchedAt: stored.fetchedAt.toISOString(), source: stored.source }
  return { rate: FALLBACK_USD_TO_JMD, fetchedAt: null, source: 'fallback' }
}

export async function getUsdToJmd(): Promise<RateInfo> {
  if (memo && memo.fetchedAt && Date.now() - Date.parse(memo.fetchedAt) < MAX_AGE_MS) return memo
  if (!inflight) inflight = load().then(r => { memo = r; return r }).finally(() => { inflight = null })
  return inflight
}
