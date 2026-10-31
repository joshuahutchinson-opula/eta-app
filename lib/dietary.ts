// lib/dietary.ts — dietary tags on menu items (MenuItem.dietaryTags) and
// the filter chips on vendor pages. Labels are in lib/i18n.ts (m.diet.*).
export const DIETARY_TAGS = ['VEGETARIAN', 'VEGAN', 'SEAFOOD', 'HALAL', 'GLUTEN_FREE'] as const
export type DietaryTag = (typeof DIETARY_TAGS)[number]

export const DIETARY_ICON: Record<DietaryTag, string> = {
  VEGETARIAN: 'spa',
  VEGAN: 'spa',
  SEAFOOD: 'wave',
  HALAL: 'check',
  GLUTEN_FREE: 'check'
}

/** An item matches when it has every selected tag. */
export function matchesDiet(tags: string[], selected: string[]): boolean {
  return selected.every(s => tags.includes(s))
}
