// lib/money.ts — formatting USD amounts, safe on server and client.
// The exchange rate comes from lib/exchange-rate.ts (server) or
// /api/exchange-rate (client, via lib/currency.ts).

/** Used only when the daily rate hasn't loaded and nothing is cached. */
export const FALLBACK_USD_TO_JMD = 157

export type Currency = 'USD' | 'JMD'

export function formatMoney(usd: number, currency: Currency, rate = FALLBACK_USD_TO_JMD): string {
  if (currency === 'JMD') return `J$${Math.round(usd * rate).toLocaleString('en-US')}`
  const rounded = Math.round(usd * 100) / 100
  return `$${Number.isInteger(rounded) ? rounded.toLocaleString('en-US') : rounded.toFixed(2)}`
}
