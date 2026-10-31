// lib/currency.ts — every price in the data is USD. The traveler picks which
// currency leads (Profile -> Settings); the other is shown smaller. The JMD
// rate comes from /api/exchange-rate (refreshed daily), cached on the device
// for a day; until it loads the last cached rate, or 157, is used.
'use client'

import { useCallback, useEffect, useState } from 'react'
import { FALLBACK_USD_TO_JMD, formatMoney as format$, type Currency } from '@/lib/money'

export type { Currency }

const STORAGE_KEY = 'eta_currency'
const EVENT = 'eta-currency-change'
const RATE_KEY = 'eta_usd_jmd'
const RATE_EVENT = 'eta-rate-change'
const RATE_MAX_AGE_MS = 24 * 3600000

let rate = FALLBACK_USD_TO_JMD
let rateLoading: Promise<void> | null = null

function readCachedRate(): { rate: number; at: number } | null {
  try {
    const c = JSON.parse(localStorage.getItem(RATE_KEY) || 'null')
    return c && Number.isFinite(c.rate) && c.rate > 0 ? c : null
  } catch { return null }
}

/** Load the daily rate once per page load (or skip if the cache is fresh). */
function ensureRate() {
  if (rateLoading) return
  const cached = readCachedRate()
  if (cached) rate = cached.rate
  if (cached && Date.now() - cached.at < RATE_MAX_AGE_MS) { rateLoading = Promise.resolve(); return }
  rateLoading = fetch('/api/exchange-rate')
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      const n = Number(d?.rate)
      if (!Number.isFinite(n) || n <= 0) return
      rate = n
      try { localStorage.setItem(RATE_KEY, JSON.stringify({ rate: n, at: Date.now() })) } catch {}
      window.dispatchEvent(new CustomEvent(RATE_EVENT, { detail: n }))
    })
    .catch(() => {})
}

/** The USD->JMD rate currently in use on this device. */
export function currentRate(): number {
  return rate
}

export function readCurrency(): Currency {
  try { return localStorage.getItem(STORAGE_KEY) === 'JMD' ? 'JMD' : 'USD' } catch { return 'USD' }
}

export function formatMoney(usd: number, currency: Currency): string {
  return format$(usd, currency, rate)
}

export function useCurrency(): { currency: Currency; setCurrency: (c: Currency) => void; format: (usd: number) => string; formatOther: (usd: number) => string } {
  const [currency, setState] = useState<Currency>('USD')
  const [usdJmd, setUsdJmd] = useState(rate)
  useEffect(() => {
    setState(readCurrency())
    ensureRate()
    setUsdJmd(rate)
    const onChange = (e: Event) => setState((e as CustomEvent<Currency>).detail)
    const onRate = (e: Event) => setUsdJmd((e as CustomEvent<number>).detail)
    window.addEventListener(EVENT, onChange)
    window.addEventListener(RATE_EVENT, onRate)
    return () => {
      window.removeEventListener(EVENT, onChange)
      window.removeEventListener(RATE_EVENT, onRate)
    }
  }, [])
  const setCurrency = useCallback((c: Currency) => {
    try { localStorage.setItem(STORAGE_KEY, c) } catch {}
    window.dispatchEvent(new CustomEvent(EVENT, { detail: c }))
  }, [])
  const format = useCallback((usd: number) => format$(usd, currency, usdJmd), [currency, usdJmd])
  const formatOther = useCallback((usd: number) => format$(usd, currency === 'USD' ? 'JMD' : 'USD', usdJmd), [currency, usdJmd])
  return { currency, setCurrency, format, formatOther }
}
