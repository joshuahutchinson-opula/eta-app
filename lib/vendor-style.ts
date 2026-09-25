// lib/vendor-style.ts — per-category look for vendor cards and map pins in the mobile app,
// so a food stall, a rum bar and a snorkel trip don't all read as the same card.

export interface CategoryStyle {
  label: string
  icon: string
  /** Accent used for the chip, the image stripe and map pins. Readable on light and dark. */
  color: string
  /** What the $ tier means for this kind of vendor. */
  priceNoun: string
}

export const CATEGORY_STYLE: Record<string, CategoryStyle> = {
  FOOD: { label: 'Food', icon: 'food', color: '#E8743B', priceNoun: 'per plate' },
  DRINKS: { label: 'Drinks', icon: 'glass', color: '#A855F7', priceNoun: 'per round' },
  ACTIVITY: { label: 'Activity', icon: 'compass', color: '#0EA5A4', priceNoun: 'per person' },
  WELLNESS: { label: 'Wellness', icon: 'spa', color: '#22A06B', priceNoun: 'per session' },
  BEACH: { label: 'Beach', icon: 'wave', color: '#1E88E5', priceNoun: 'day pass' },
  ACCOMMODATION: { label: 'Stay', icon: 'home', color: '#D4A017', priceNoun: 'per night' },
  TRANSPORT: { label: 'Transport', icon: 'route', color: '#64748B', priceNoun: 'per ride' },
  OTHER: { label: 'Local', icon: 'sparkle', color: '#8B8B8B', priceNoun: '' }
}

export function categoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLE[category] ?? CATEGORY_STYLE.OTHER
}

/** "$$" → 2, clamped to 1-4. Seed data uses $ … $$$$. */
export function priceTier(priceRange: string | null | undefined): number {
  const n = (priceRange ?? '').replace(/[^$]/g, '').length
  return Math.min(4, Math.max(1, n || 1))
}

/** First sentence of the description, without the "(Instagram: …)" credits some seeds append. */
export function vendorPitch(description: string | null | undefined): string {
  const clean = (description ?? '').replace(/\s*\((?:Instagram|IG)[^)]*\)\s*/gi, ' ').trim()
  const first = clean.split(/(?<=[.!?])\s+/)[0] ?? ''
  return first.replace(/[.!]$/, '')
}
