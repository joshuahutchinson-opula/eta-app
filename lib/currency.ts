// lib/currency.ts — every price in the data is USD. The traveler picks which
// currency leads (Profile → Settings); the other is shown smaller.
'use client'

import { useCallback, useEffect, useState } from 'react'

/** The one exchange rate in the app. Update it here only. */
export const USD_TO_JMD = 157

export type Currency = 'USD' | 'JMD'

const STORAGE_KEY = 'eta_currency'
const EVENT = 'eta-currency-change'

export function readCurrency(): Currency {
  try { return localStorage.getItem(STORAGE_KEY) === 'JMD' ? 'JMD' : 'USD' } catch { return 'USD' }
}

export function formatMoney(usd: number, currency: Currency): string {
  if (currency === 'JMD') return `J$${Math.round(usd * USD_TO_JMD).toLocaleString('en-US')}`
  const rounded = Math.round(usd * 100) / 100
  return `$${Number.isInteger(rounded) ? rounded.toLocaleString('en-US') : rounded.toFixed(2)}`
}

export function useCurrency(): { currency: Currency; setCurrency: (c: Currency) => void; format: (usd: number) => string; formatOther: (usd: number) => string } {
  const [currency, setState] = useState<Currency>('USD')
  useEffect(() => {
    setState(readCurrency())
    const onChange = (e: Event) => setState((e as CustomEvent<Currency>).detail)
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])
  const setCurrency = useCallback((c: Currency) => {
    try { localStorage.setItem(STORAGE_KEY, c) } catch {}
    window.dispatchEvent(new CustomEvent(EVENT, { detail: c }))
  }, [])
  const format = useCallback((usd: number) => formatMoney(usd, currency), [currency])
  const formatOther = useCallback((usd: number) => formatMoney(usd, currency === 'USD' ? 'JMD' : 'USD'), [currency])
  return { currency, setCurrency, format, formatOther }
}
