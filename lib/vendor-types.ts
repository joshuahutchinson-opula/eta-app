// lib/vendor-types.ts
// Prisma-free vendor listing types and constants, safe to import from
// client components. The query implementation is in lib/vendor-query.ts.
import type { AreaSlug } from '@/lib/areas'

export interface VendorFilter {
  q?: string
  categories?: string[]
  areas?: string[]
  priceTiers?: string[]
  accessibility?: string[]
  city?: 'NEGRIL' | 'MONTEGO_BAY'
  /** Any-of match against name/description — used by best-of definitions. */
  keywords?: string[]
  liveOnly?: boolean
  premiumOnly?: boolean
  excludeIds?: string[]
}

export type VendorSort = 'recommended' | 'rating' | 'price' | 'price-desc' | 'trending'

export interface VendorCardData {
  id: string
  name: string
  category: string
  neighborhood: string
  area: AreaSlug
  city: string
  priceRange: string
  description: string
  image: string | null
  video: string | null
  open: boolean
  live: boolean
  isPremium: boolean
  whoThere: number
  rating: number | null
  reviewCount: number
  accessibility: string[]
}

export const CATEGORY_LABELS: Record<string, string> = {
  FOOD: 'Food',
  DRINKS: 'Drinks',
  ACTIVITY: 'Activities',
  WELLNESS: 'Wellness',
  BEACH: 'Beach',
  TRANSPORT: 'Transport',
  ACCOMMODATION: 'Stays',
  OTHER: 'Markets & more'
}

export const PRICE_TIERS = ['$', '$$', '$$$', '$$$$']

export interface FacetCount { value: string; label: string; count: number }

export interface VendorFacets {
  categories: FacetCount[]
  areas: FacetCount[]
  priceTiers: FacetCount[]
  accessibility: Record<string, number>
}

