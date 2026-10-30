// lib/saved.ts — saved vendors and experiences, kept on this device
// (the same localStorage keys the Market heart and the results long-press use).
'use client'

const KEYS = { vendors: 'savedVendors', experiences: 'savedBundles' } as const
type Kind = keyof typeof KEYS

export function readSaved(kind: Kind): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS[kind]) || '[]')
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Toggles an id and returns whether it's saved now. */
export function toggleSaved(kind: Kind, id: string): boolean {
  const list = readSaved(kind)
  const next = list.includes(id) ? list.filter(x => x !== id) : [...list, id]
  try { localStorage.setItem(KEYS[kind], JSON.stringify(next)) } catch {}
  return next.includes(id)
}
