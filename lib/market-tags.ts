// lib/market-tags.ts — the Market sections a vendor can opt into
// (Vendor.marketTags). Vendors pick them in the vendor app
// (/api/vendor-app/vendors/:id/market); ETA admins can edit them too.
// A section with no vendors in the town is hidden (lib/market.ts).

export const MARKET_TAGS = ['jerk', 'rum_bar', 'beach_bar', 'crafts', 'souvenirs', 'grocery', 'pharmacy', 'phone_topup'] as const
export type MarketTag = (typeof MARKET_TAGS)[number]

/** Which tags put a vendor in which section. */
export const SECTION_TAGS = {
  jerk: ['jerk'],
  bars: ['rum_bar', 'beach_bar'],
  crafts: ['crafts', 'souvenirs'],
  essentials: ['grocery', 'pharmacy', 'phone_topup']
} as const satisfies Record<string, readonly MarketTag[]>

export function isMarketTag(v: unknown): v is MarketTag {
  return typeof v === 'string' && (MARKET_TAGS as readonly string[]).includes(v)
}

/** Heat scale for Jerk Spots: 1 (mild) to 4 (fire). */
export const HEAT_MIN = 1
export const HEAT_MAX = 4
