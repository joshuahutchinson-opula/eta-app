// lib/theme.ts — Light, Dark or Auto. Auto goes dark at the real sunset of
// the selected town (lib/daypart.ts sunInfo) and light again at sunrise.
// The choice is the `theme` key in localStorage; app/layout.tsx applies it
// before first paint (Auto from the last sun times saved in eta_sun), and
// components/ThemeAuto keeps Auto in step as the sun moves.
'use client'

import { sunInfo } from '@/lib/daypart'

export type ThemeMode = 'light' | 'dark' | 'auto'
export const THEME_EVENT = 'eta-theme-change'

export function readTheme(): ThemeMode {
  try {
    const t = localStorage.getItem('theme')
    return t === 'dark' || t === 'auto' ? t : 'light'
  } catch { return 'light' }
}

export function applyDark(dark: boolean) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#F2F2F7')
}

/** Is it dark (between sunset and sunrise) in the town right now? Saves the sun times for the first-paint script. */
export function sunIsDown(lat: number, lng: number, now = new Date()): { dark: boolean; next: Date } {
  const s = sunInfo(lat, lng, now)
  try { localStorage.setItem('eta_sun', JSON.stringify({ rise: s.sunrise.toISOString(), set: s.sunset.toISOString() })) } catch {}
  const t = now.getTime()
  if (t < s.sunrise.getTime()) return { dark: true, next: s.sunrise }
  if (t < s.sunset.getTime()) return { dark: false, next: s.sunset }
  const tomorrow = sunInfo(lat, lng, new Date(now.getTime() + 12 * 3600000))
  return { dark: true, next: tomorrow.sunrise.getTime() > t ? tomorrow.sunrise : new Date(t + 3600000) }
}

export function setTheme(mode: ThemeMode, town?: { lat: number; lng: number }) {
  try { localStorage.setItem('theme', mode) } catch {}
  if (mode === 'auto') applyDark(town ? sunIsDown(town.lat, town.lng).dark : false)
  else applyDark(mode === 'dark')
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: mode }))
}
