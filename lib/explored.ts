// lib/explored.ts — fog of war on Discover: the ground this device has
// covered, as ~200 m grid cells kept in localStorage (eta_explored). Each
// position fix clears its cell; the map draws the fog with holes there.
'use client'

import type { MapPoint } from '@/components/map/EtaMap'

const KEY = 'eta_explored'
/** Grid size in degrees (~200 m). */
const CELL = 0.002
const MAX_CELLS = 4000

const keyOf = (p: MapPoint) => `${Math.round(p.lat / CELL)}:${Math.round(p.lng / CELL)}`

export function readExplored(): MapPoint[] {
  try {
    const keys: string[] = JSON.parse(localStorage.getItem(KEY) || '[]')
    return keys.map(k => { const [i, j] = k.split(':').map(Number); return { lat: i * CELL, lng: j * CELL } })
  } catch {
    return []
  }
}

/** Records a position; returns true when it cleared new ground. */
export function markExplored(p: MapPoint): boolean {
  try {
    const keys: string[] = JSON.parse(localStorage.getItem(KEY) || '[]')
    const k = keyOf(p)
    if (keys.includes(k)) return false
    keys.push(k)
    localStorage.setItem(KEY, JSON.stringify(keys.slice(-MAX_CELLS)))
    return true
  } catch {
    return false
  }
}
