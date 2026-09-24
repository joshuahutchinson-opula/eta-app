// lib/vendor-query.ts
// One query layer for every vendor listing on the web: the Explore
// directory (and its /api/web/vendors endpoint), vendor-card rows inside
// destination guides and best-of pages, and "You might also like". A filter
// is a plain serializable object, so the same definition can live in a URL,
// in an editorial page config, or in an API request.

import type { Prisma, VendorCategory } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AREAS, areaForNeighborhood, type AreaSlug } from '@/lib/areas'
import { CATEGORY_LABELS, PRICE_TIERS, type VendorFilter, type VendorSort, type VendorCardData, type VendorFacets } from '@/lib/vendor-types'

export type { VendorFilter, VendorSort, VendorCardData, FacetCount, VendorFacets } from '@/lib/vendor-types'
export { CATEGORY_LABELS, PRICE_TIERS } from '@/lib/vendor-types'

const BASE_WHERE: Prisma.VendorWhereInput = { visibleInMarketplace: true, isTransport: false }

type Dimension = 'categories' | 'areas' | 'priceTiers' | 'accessibility'

async function neighborhoodsForAreas(areas: string[]): Promise<string[]> {
  const rows = await prisma.vendor.findMany({
    where: BASE_WHERE,
    distinct: ['neighborhood', 'city'],
    select: { neighborhood: true, city: true }
  })
  return rows.filter(r => areas.includes(areaOfRow(r))).map(r => r.neighborhood)
}

function areaOfRow(r: { neighborhood: string; city: string }): AreaSlug {
  return areaForNeighborhood(r.neighborhood, r.city)
}

async function buildWhere(filter: VendorFilter, skip?: Dimension): Promise<Prisma.VendorWhereInput> {
  const and: Prisma.VendorWhereInput[] = [BASE_WHERE]
  if (filter.city) and.push({ city: filter.city })
  if (filter.liveOnly) and.push({ live: true })
  if (filter.premiumOnly) and.push({ isPremium: true })
  if (filter.excludeIds?.length) and.push({ id: { notIn: filter.excludeIds } })
  if (skip !== 'categories' && filter.categories?.length) {
    and.push({ category: { in: filter.categories as VendorCategory[] } })
  }
  if (skip !== 'priceTiers' && filter.priceTiers?.length) {
    and.push({ priceRange: { in: filter.priceTiers } })
  }
  if (skip !== 'accessibility' && filter.accessibility?.length) {
    and.push({ accessibility: { hasEvery: filter.accessibility } })
  }
  if (skip !== 'areas' && filter.areas?.length) {
    and.push({ neighborhood: { in: await neighborhoodsForAreas(filter.areas) } })
  }
  if (filter.keywords?.length) {
    and.push({
      OR: filter.keywords.flatMap(k => [
        { name: { contains: k, mode: 'insensitive' as const } },
        { description: { contains: k, mode: 'insensitive' as const } }
      ])
    })
  }
  const q = filter.q?.trim()
  if (q) {
    const categoryMatches = Object.entries(CATEGORY_LABELS)
      .filter(([, label]) => label.toLowerCase().startsWith(q.toLowerCase()))
      .map(([key]) => key as VendorCategory)
    and.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { neighborhood: { contains: q, mode: 'insensitive' } },
        ...(categoryMatches.length ? [{ category: { in: categoryMatches } }] : [])
      ]
    })
  }
  return { AND: and }
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

/**
 * Filters run in Postgres; sorting happens after, because "rating" is an
 * average over the Review relation that Prisma can't order by. At the
 * current catalog size (~50 vendors) that's a single cheap query.
 */
export async function queryVendors(
  filter: VendorFilter,
  opts: { sort?: VendorSort; skip?: number; take?: number } = {}
): Promise<{ total: number; items: VendorCardData[] }> {
  const rows = await prisma.vendor.findMany({ where: await buildWhere(filter), select: CARD_SELECT })
  const sorted = sortCards(rows.map(toCard), opts.sort ?? 'recommended')
  const skip = opts.skip ?? 0
  const page = opts.take !== undefined ? sorted.slice(skip, skip + opts.take) : sorted.slice(skip)
  return { total: sorted.length, items: page.map(({ createdAt: _c, ...card }) => card) }
}

/** Live counts per filter option, each computed with every *other* active filter applied. */
export async function vendorFacets(filter: VendorFilter): Promise<VendorFacets> {
  const [catRows, areaRows, priceRows, accessRows] = await Promise.all([
    prisma.vendor.findMany({ where: await buildWhere(filter, 'categories'), select: { category: true } }),
    prisma.vendor.findMany({ where: await buildWhere(filter, 'areas'), select: { neighborhood: true, city: true } }),
    prisma.vendor.findMany({ where: await buildWhere(filter, 'priceTiers'), select: { priceRange: true } }),
    prisma.vendor.findMany({ where: await buildWhere(filter, 'accessibility'), select: { accessibility: true } })
  ])
  const tally = (values: string[]) => values.reduce<Record<string, number>>((m, v) => { m[v] = (m[v] || 0) + 1; return m }, {})
  const cat = tally(catRows.map(r => r.category))
  const area = tally(areaRows.map(r => areaForNeighborhood(r.neighborhood, r.city)))
  const price = tally(priceRows.map(r => r.priceRange))
  const access = tally(accessRows.flatMap(r => r.accessibility))
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
