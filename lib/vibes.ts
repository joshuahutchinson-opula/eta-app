// lib/vibes.ts — the onboarding vibe pick (localStorage eta_vibe) and the
// seeded moods it stands for. Home and the planning survey preselect these.
'use client'

export const VIBES = ['Party', 'Chill', 'Adventure', 'Romance'] as const
export type Vibe = (typeof VIBES)[number]

const VIBE_MOODS: Record<Vibe, string[]> = {
  Party: ['Out Til Sunrise', 'Rum & Bass', 'Party Time'],
  Chill: ['R&R', 'Hangover Cures'],
  Adventure: ['Water Life', 'Solo Missions'],
  Romance: ['Just The Two Of Us', 'Golden Hour', 'Sunset Chaser']
}

export function readVibe(): Vibe | null {
  try {
    const v = localStorage.getItem('eta_vibe')
    return (VIBES as readonly string[]).includes(v ?? '') ? (v as Vibe) : null
  } catch {
    return null
  }
}

/** Mood names (seeded or Home's display names) that match the saved vibe. */
export function vibeMoodNames(vibe: Vibe | null = readVibe()): string[] {
  return vibe ? VIBE_MOODS[vibe] : []
}
