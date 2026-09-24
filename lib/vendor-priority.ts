// lib/vendor-priority.ts
// Editorial display order for the web app. Vendors listed here surface
// first, in this order, in every web listing whose order the user hasn't
// explicitly chosen (Explore's default "Recommended", Home rails, guides,
// best-of pages, "You might also like"). The Featured Destinations carousel
// is deliberately exempt. This only changes position — ratings, review
// counts and every other field are untouched.

export const PRIORITY_VENDOR_NAMES = [
  'Xtabi',
  "Ivan's Bar & Restaurant",
  'Margaritaville Negril',
  'Border Jerk',
  'Rutland Point & Negril Craft Market',
  'The Lodge Restaurant',
  "Natasha's One Love Massage Spa",
  'Rockhouse Restaurant',
  'Zimbali Retreats',
  'Sweet Spice Restaurant',
  "Kamara's"
]

const RANK = new Map(PRIORITY_VENDOR_NAMES.map((name, i) => [name.toLowerCase(), i]))

/** Position in the priority list, or Infinity for everyone else. */
export function priorityRank(name: string): number {
  return RANK.get(name.toLowerCase()) ?? Infinity
}

/** Stable re-sort: priority vendors first (in list order), everyone else keeps their existing order. */
export function applyVendorPriority<T>(items: T[], nameOf: (item: T) => string | null | undefined): T[] {
  return items
    .map((item, i) => ({ item, i, rank: priorityRank(nameOf(item) ?? '') }))
    .sort((a, b) => (a.rank === b.rank ? a.i - b.i : a.rank - b.rank))
    .map(x => x.item)
}
