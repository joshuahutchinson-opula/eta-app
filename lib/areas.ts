// lib/areas.ts
// Vendor.neighborhood is free text scraped from real listings ("West End
// (Rockhouse)", "Norman Manley Blvd, opposite Coco La Palm", ...), so it's
// too granular to filter or build guides on directly. Every neighborhood is
// classified into one of a handful of real areas here — the single place
// that mapping lives, shared by the web Explore sidebar, destination guides
// and best-of pages.

export type AreaSlug = 'seven-mile-beach' | 'west-end' | 'negril-town' | 'inland-negril' | 'montego-bay'

export interface Area {
  slug: AreaSlug
  label: string
  city: 'NEGRIL' | 'MONTEGO_BAY'
}

export const AREAS: Area[] = [
  { slug: 'seven-mile-beach', label: 'Seven Mile Beach', city: 'NEGRIL' },
  { slug: 'west-end', label: 'West End & the Cliffs', city: 'NEGRIL' },
  { slug: 'negril-town', label: 'Negril Town', city: 'NEGRIL' },
  { slug: 'inland-negril', label: 'Inland Negril', city: 'NEGRIL' },
  { slug: 'montego-bay', label: 'Montego Bay', city: 'MONTEGO_BAY' }
]

export function getArea(slug: string): Area | undefined {
  return AREAS.find(a => a.slug === slug)
}

export function areaForNeighborhood(neighborhood: string, city: string): AreaSlug {
  if (city === 'MONTEGO_BAY') return 'montego-bay'
  const n = neighborhood.toLowerCase()
  // Order matters: "Inland / jungle, off West End" is inland, and the
  // roundabout sits at the town end of West End Road.
  if (/inland|jungle|river|golf/.test(n)) return 'inland-negril'
  if (/roundabout/.test(n)) return 'negril-town'
  if (/seven mile|norman manley|beachfront|bourbon|wavz/.test(n)) return 'seven-mile-beach'
  if (/west end|cliff|tensing|lighthouse/.test(n)) return 'west-end'
  return 'negril-town'
}

export function areaLabel(slug: string): string {
  return getArea(slug)?.label ?? slug
}
