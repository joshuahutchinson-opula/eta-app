// lib/saved.ts — saved vendors, experiences and events. The account
// (/api/saved) is the source of truth; localStorage is an offline cache
// under the same keys the Market heart and results long-press always used,
// and is where saves made while logged out wait until the first sign-in
// moves them onto the account (syncSavedToAccount, run by SessionGuard).
'use client'

import { authHeaders } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'

const KEYS = { vendors: 'savedVendors', experiences: 'savedBundles', events: 'savedEvents' } as const
export type SavedKind = keyof typeof KEYS
const SYNCED_KEY = 'eta_saved_synced'
export const SAVED_EVENT = 'eta-saved-change'

export function readSaved(kind: SavedKind): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS[kind]) || '[]')
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeCache(kind: SavedKind, ids: string[]) {
  try { localStorage.setItem(KEYS[kind], JSON.stringify(Array.from(new Set(ids)))) } catch {}
  window.dispatchEvent(new CustomEvent(SAVED_EVENT, { detail: kind }))
}

export interface SavedState { vendors: string[]; experiences: string[]; events: string[] }

function writeAll(state: SavedState) {
  writeCache('vendors', state.vendors)
  writeCache('experiences', state.experiences)
  writeCache('events', state.events)
}

/** Toggles an id and returns whether it's saved now. Signed in, the account is updated too. */
export function toggleSaved(kind: SavedKind, id: string): boolean {
  const list = readSaved(kind)
  const saved = !list.includes(id)
  writeCache(kind, saved ? [...list, id] : list.filter(x => x !== id))
  if (getCurrentUser()) {
    fetch('/api/saved', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ kind, refId: id, saved })
    }).catch(() => {})
  }
  return saved
}

/** Refreshes the cache from the account (no-op when logged out or offline). */
export async function loadSaved(): Promise<SavedState | null> {
  if (!getCurrentUser()) return null
  try {
    const res = await fetch('/api/saved', { headers: authHeaders() })
    if (!res.ok) return null
    const state: SavedState = await res.json()
    writeAll(state)
    return state
  } catch {
    return null
  }
}

/** Once per account on this device: move local saves onto the account, then mirror it. */
export async function syncSavedToAccount(): Promise<void> {
  const user = getCurrentUser()
  if (!user) return
  try {
    if (localStorage.getItem(SYNCED_KEY) === user.id) { await loadSaved(); return }
    const res = await fetch('/api/saved/sync', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ vendors: readSaved('vendors'), experiences: readSaved('experiences'), events: readSaved('events') })
    })
    if (!res.ok) return
    writeAll(await res.json())
    localStorage.setItem(SYNCED_KEY, user.id)
  } catch {}
}
