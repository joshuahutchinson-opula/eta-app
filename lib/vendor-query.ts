// lib/vendor-query.ts
// One query layer for every vendor listing on the web: the Explore
// directory (and its /api/web/vendors endpoint), vendor-card rows inside
// destination guides and best-of pages, and "You might also like". A filter
// is a plain serializable object, so the same definition can live in a URL,
// in an editorial page config, or in an API request.
//
// The whole visible catalog (~50 vendors) is read ONCE per request —
// memoized with React cache() — and every listing, facet count and editorial
// row on the page filters that one result in memory. Pages used to issue a
// separate full-table query per row (Home fired ~20 at once), which
// exhausted the connection pool against the remote database and crashed
// server renders.

import { cache } from 'react'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AREAS, areaForNeighborhood, type AreaSlug } from '@/lib/areas'
import { applyVendorPriority } from '@/lib/vendor-priority'
import { CATEGORY_LABELS, PRICE_TIERS, type VendorFilter, type VendorSort, type VendorCardData, type VendorFacets } from '@/lib/vendor-types'

export type { VendorFilter, VendorSort, VendorCardData, FacetCount, VendorFacets } from '@/lib/vendor-types'
export { CATEGORY_LABELS, PRICE_TIERS } from '@/lib/vendor-types'

/** Sorts a user picks explicitly in Explore — editorial priority stays out of these. */
export const USER_SORTS: VendorSort[] = ['rating', 'price', 'price-desc']

const BASE_WHERE: Prisma.VendorWhereInput = { visibleInMarketplace: true, isTransport: false }

type Dimension = 'categories' | 'areas' | 'priceTiers' | 'accessibility'

function includesCI(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

/** In-memory equivalent of the filter; `skip` leaves one dimension out (for facet counts). */
function matches(c: VendorCardData, filter: VendorFilter, skip?: Dimension): boolean {
  if (filter.city && c.city !== filter.city) return false
  if (filter.liveOnly && !c.live) return false
  if (filter.premiumOnly && !c.isPremium) return false
  if (filter.excludeIds?.includes(c.id)) return false
  if (skip !== 'categories' && filter.categories?.length && !filter.categories.includes(c.category)) return false
  if (skip !== 'priceTiers' && filter.priceTiers?.length && !filter.priceTiers.includes(c.priceRange)) return false
  if (skip !== 'accessibility' && filter.accessibility?.length && !filter.accessibility.every(k => c.accessibility.includes(k))) return false
  if (skip !== 'areas' && filter.areas?.length && !filter.areas.includes(c.area)) return false
  if (filter.keywords?.length && !filter.keywords.some(k => includesCI(c.name, k) || includesCI(c.description, k))) return false
  const q = filter.q?.trim()
  if (q) {
    const categoryHit = (CATEGORY_LABELS[c.category] ?? '').toLowerCase().startsWith(q.toLowerCase())
    if (!categoryHit && !includesCI(c.name, q) && !includesCI(c.description, q) && !includesCI(c.neighborhood, q)) return false
  }
  return true
}

const CARD_SELECT = {
  id: true,
  name: true,
  category: true,
  neighborhood: true,
  city: true,
  priceRange: true,
  description: true,
  images: true,
  videos: true,
  open: true,
  live: true,
  isPremium: true,
  whoThere: true,
  accessibility: true,
  createdAt: true,
  reviews: { select: { rating: true } }
} satisfies Prisma.VendorSelect

type CardRow = Prisma.VendorGetPayload<{ select: typeof CARD_SELECT }>

function toCard(v: CardRow): VendorCardData & { createdAt: Date } {
  const reviewCount = v.reviews.length
  const rating = reviewCount > 0
    ? Math.round((v.reviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10
    : null
  return {
    id: v.id,
    name: v.name,
    category: v.category,
    neighborhood: v.neighborhood,
    area: areaForNeighborhood(v.neighborhood, v.city),
    city: v.city,
    priceRange: v.priceRange,
    description: v.description,
    image: v.images[0] ?? null,
    video: v.videos[0] ?? null,
    open: v.open,
    live: v.live,
    isPremium: v.isPremium,
    whoThere: v.whoThere,
    rating,
    reviewCount,
    accessibility: v.accessibility,
    createdAt: v.createdAt
  }
}

function sortCards(cards: Array<VendorCardData & { createdAt: Date }>, sort: VendorSort) {
  const byRecommended = (a: VendorCardData & { createdAt: Date }, b: VendorCardData & { createdAt: Date }) =>
    Number(b.isPremium) - Number(a.isPremium) ||
    Number(b.live) - Number(a.live) ||
    (b.rating ?? 0) - (a.rating ?? 0) ||
    b.createdAt.getTime() - a.createdAt.getTime()
  return [...cards].sort((a, b) => {
    switch (sort) {
      case 'rating':
        return (b.rating ?? -1) - (a.rating ?? -1) || b.reviewCount - a.reviewCount || byRecommended(a, b)
      case 'price':
        return a.priceRange.length - b.priceRange.length || byRecommended(a, b)
      case 'price-desc':
        return b.priceRange.length - a.priceRange.length || byRecommended(a, b)
      case 'trending':
        return Number(b.live) - Number(a.live) || b.whoThere - a.whoThere || byRecommended(a, b)
      default:
        return byRecommended(a, b)
    }
  })
}

/** Every listed vendor as a card, read once per request. */
const loadCatalog = cache(async (): Promise<Array<VendorCardData & { createdAt: Date }>> => {
  const rows = await prisma.vendor.findMany({ where: BASE_WHERE, select: CARD_SELECT })
  return rows.map(toCard)
})

/**
 * Filters and sorts the per-request catalog. Sorting is done here anyway,
 * because "rating" is an average over the Review relation that Prisma can't
 * order by.
 */
export async function queryVendors(
  filter: VendorFilter,
  opts: { sort?: VendorSort; skip?: number; take?: number; prioritize?: boolean } = {}
): Promise<{ total: number; items: VendorCardData[] }> {
  const catalog = await loadCatalog()
  const base = sortCards(catalog.filter(c => matches(c, filter)), opts.sort ?? 'recommended')
  // Editorial priority applies unless the caller says the order was an
  // explicit user choice (Explore's Rating / Price sorts).
  const sorted = opts.prioritize === false ? base : applyVendorPriority(base, c => c.name)
  const skip = opts.skip ?? 0
  const page = opts.take !== undefined ? sorted.slice(skip, skip + opts.take) : sorted.slice(skip)
  return { total: sorted.length, items: page.map(({ createdAt: _c, ...card }) => card) }
}

/** Live counts per filter option, each computed with every *other* active filter applied. */
export async function vendorFacets(filter: VendorFilter): Promise<VendorFacets> {
  const catalog = await loadCatalog()
  const without = (dim: Dimension) => catalog.filter(c => matches(c, filter, dim))
  const tally = (values: string[]) => values.reduce<Record<string, number>>((m, v) => { m[v] = (m[v] || 0) + 1; return m }, {})
  const cat = tally(without('categories').map(c => c.category))
  const area = tally(without('areas').map(c => c.area))
  const price = tally(without('priceTiers').map(c => c.priceRange))
  const access = tally(without('accessibility').flatMap(c => c.accessibility))
  return {
    categories: Object.keys(CATEGORY_LABELS)
      .filter(k => cat[k] || filter.categories?.includes(k))
      .map(k => ({ value: k, label: CATEGORY_LABELS[k], count: cat[k] || 0 })),
    areas: AREAS
      .filter(a => !filter.city || a.city === filter.city)
      .map(a => ({ value: a.slug, label: a.label, count: area[a.slug] || 0 })),
    priceTiers: PRICE_TIERS.map(p => ({ value: p, label: p, count: price[p] || 0 })),
    accessibility: access
  }
}

export async function getVendorCards(ids: string[]): Promise<VendorCardData[]> {
  if (ids.length === 0) return []
  const rows = await prisma.vendor.findMany({ where: { id: { in: ids } }, select: CARD_SELECT })
  const cards = rows.map(toCard).map(({ createdAt: _c, ...c }) => c)
  return ids.map(id => cards.find(c => c.id === id)).filter((c): c is VendorCardData => Boolean(c))
}

/** Parses Explore's URL search params (also used by /api/web/vendors). */
export function filterFromParams(params: URLSearchParams | Record<string, string | string[] | undefined>): { filter: VendorFilter; sort: VendorSort } {
  const get = (k: string): string[] => {
    const raw = params instanceof URLSearchParams ? params.getAll(k) : ([] as string[]).concat(params[k] ?? [])
    return raw.flatMap(v => v.split(',')).map(v => v.trim()).filter(Boolean)
  }
  const sortRaw = get('sort')[0]
  const sort: VendorSort = (['recommended', 'rating', 'price', 'price-desc', 'trending'] as const).includes(sortRaw as VendorSort)
    ? (sortRaw as VendorSort)
    : 'recommended'
  const city = get('city')[0]
  return {
    sort,
    filter: {
      q: get('q')[0],
      categories: get('category'),
      areas: get('area'),
      priceTiers: get('price'),
      accessibility: get('access'),
      city: city === 'NEGRIL' || city === 'MONTEGO_BAY' ? city : undefined
    }
  }
}
