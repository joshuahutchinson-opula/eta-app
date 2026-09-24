// lib/accessibility.ts
// Keys stored in Vendor.accessibility / Experience.accessibility. A vendor
// only carries a key once it has been confirmed for that vendor — an empty
// array means "not yet verified", never "not accessible".

export interface AccessibilityOption {
  key: string
  label: string
  short: string
}

export const ACCESSIBILITY_OPTIONS: AccessibilityOption[] = [
  { key: 'WHEELCHAIR_ACCESSIBLE', label: 'Wheelchair accessible', short: 'Wheelchair' },
  { key: 'STEP_FREE_ENTRY', label: 'Step-free entry', short: 'Step-free' },
  { key: 'ACCESSIBLE_RESTROOM', label: 'Accessible restroom', short: 'Restroom' },
  { key: 'LOW_WALKING', label: 'Minimal walking required', short: 'Low walking' },
  { key: 'SEATING_AVAILABLE', label: 'Seating available throughout', short: 'Seating' }
]

export const ACCESSIBILITY_KEYS = ACCESSIBILITY_OPTIONS.map(o => o.key)

export function accessibilityLabel(key: string): string {
  return ACCESSIBILITY_OPTIONS.find(o => o.key === key)?.label ?? key
}

/** Keeps only known keys, so a vendor PUT can't store arbitrary strings. */
export function sanitizeAccessibility(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((v): v is string => typeof v === 'string' && ACCESSIBILITY_KEYS.includes(v))))
}
