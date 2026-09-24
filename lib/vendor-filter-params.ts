// lib/vendor-filter-params.ts
// Client-safe (no Prisma) serializer for Explore filters, the inverse of
// filterFromParams in lib/vendor-query.ts.
import type { VendorFilter, VendorSort } from '@/lib/vendor-types'

export function filterToSearch(filter: VendorFilter, sort: VendorSort, extra: Record<string, string | number> = {}): string {
  const p = new URLSearchParams()
  if (filter.q?.trim()) p.set('q', filter.q.trim())
  if (filter.categories?.length) p.set('category', filter.categories.join(','))
  if (filter.areas?.length) p.set('area', filter.areas.join(','))
  if (filter.priceTiers?.length) p.set('price', filter.priceTiers.join(','))
  if (filter.accessibility?.length) p.set('access', filter.accessibility.join(','))
  if (filter.city) p.set('city', filter.city)
  if (sort !== 'recommended') p.set('sort', sort)
  for (const [k, v] of Object.entries(extra)) p.set(k, String(v))
  return p.toString()
}

export function activeFilterCount(filter: VendorFilter): number {
  return (filter.categories?.length ?? 0) + (filter.areas?.length ?? 0) + (filter.priceTiers?.length ?? 0) + (filter.accessibility?.length ?? 0) + (filter.q?.trim() ? 1 : 0)
}
