// lib/sky.ts — the living hero's sky (components/home/LivingHero.tsx): the
// sun and moon at the town's coordinates right now (suncalc), and a palette
// that follows the sun's altitude — night with stars, dawn pinks, bright
// midday blue, golden hour, burning sunset, dusk purple. Morning and evening
// have their own colours at the same altitude.
import SunCalc from 'suncalc'

type RGB = [number, number, number]

export interface SkyPalette {
  top: RGB
  mid: RGB
  horizon: RGB
  seaTop: RGB
  seaBottom: RGB
  /** 0..1 how visible the stars are. */
  stars: number
  /** Cloud colour and opacity. */
  cloud: RGB
  cloudAlpha: number
  /** Sun glow colour. */
  glow: RGB
}

export interface SkyScene {
  palette: SkyPalette
  /** Sun and moon: x 0..1 across the view (east → west), altitude in degrees. */
  sun: { x: number; alt: number }
  moon: { x: number; alt: number; fraction: number; waxing: boolean }
}

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

interface Key { alt: number; top: string; mid: string; horizon: string; seaTop: string; seaBottom: string; stars: number; cloud: string; cloudAlpha: number; glow: string }

const NIGHT: Key = { alt: -18, top: '#050816', mid: '#0B1230', horizon: '#1B2148', seaTop: '#0C1434', seaBottom: '#03050F', stars: 1, cloud: '#2A3360', cloudAlpha: 0.35, glow: '#4A5A9A' }
const MIDDAY: Key = { alt: 35, top: '#1C74D6', mid: '#5AA6EE', horizon: '#C4E6FF', seaTop: '#1AA3C6', seaBottom: '#0A5A84', stars: 0, cloud: '#FFFFFF', cloudAlpha: 0.85, glow: '#FFF6D8' }

const EVENING: Key[] = [
  NIGHT,
  { alt: -8, top: '#181242', mid: '#3B2566', horizon: '#8C4F8E', seaTop: '#2E2254', seaBottom: '#0E0A24', stars: 0.6, cloud: '#5A3D78', cloudAlpha: 0.5, glow: '#B56AA0' },
  { alt: -2, top: '#3A2A6C', mid: '#B4466A', horizon: '#FF7440', seaTop: '#7E3C5A', seaBottom: '#2A1636', stars: 0.12, cloud: '#F08A6A', cloudAlpha: 0.75, glow: '#FF6A2E' },
  { alt: 3, top: '#4A78C0', mid: '#E8926A', horizon: '#FFB347', seaTop: '#C47A4E', seaBottom: '#3B3A5E', stars: 0, cloud: '#FFC08A', cloudAlpha: 0.8, glow: '#FF9A3C' },
  { alt: 10, top: '#3C84D4', mid: '#9AC2E8', horizon: '#FFD38E', seaTop: '#3D8DB6', seaBottom: '#15486C', stars: 0, cloud: '#FFE7C4', cloudAlpha: 0.85, glow: '#FFC46B' },
  MIDDAY
]
const MORNING: Key[] = [
  NIGHT,
  { alt: -8, top: '#1B1A48', mid: '#4A3A7A', horizon: '#C47A9A', seaTop: '#352C5E', seaBottom: '#100C28', stars: 0.5, cloud: '#7A5A8E', cloudAlpha: 0.5, glow: '#E08AA8' },
  { alt: -2, top: '#4A4C94', mid: '#D88AA6', horizon: '#FFC4A8', seaTop: '#8A6C9A', seaBottom: '#2C2A52', stars: 0.08, cloud: '#FFC6C0', cloudAlpha: 0.75, glow: '#FFB4A0' },
  { alt: 3, top: '#6C9FDA', mid: '#F2B6B0', horizon: '#FFE2BE', seaTop: '#7AA6C8', seaBottom: '#2A4E78', stars: 0, cloud: '#FFE4DA', cloudAlpha: 0.8, glow: '#FFD2A0' },
  { alt: 10, top: '#4892DC', mid: '#A4CEF0', horizon: '#FFF0D8', seaTop: '#3A9CC4', seaBottom: '#13527A', stars: 0, cloud: '#FFFFFF', cloudAlpha: 0.85, glow: '#FFEBC2' },
  MIDDAY
]

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

function paletteAt(alt: number, evening: boolean): SkyPalette {
  const keys = evening ? EVENING : MORNING
  let i = keys.findIndex(k => alt < k.alt)
  if (i === -1) i = keys.length - 1
  const a = keys[Math.max(0, i - 1)]
  const b = keys[i]
  const t = a === b ? 1 : Math.min(1, Math.max(0, (alt - a.alt) / (b.alt - a.alt)))
  const m = (x: keyof Key) => mix(hex(a[x] as string), hex(b[x] as string), t)
  return {
    top: m('top'), mid: m('mid'), horizon: m('horizon'), seaTop: m('seaTop'), seaBottom: m('seaBottom'),
    stars: a.stars + (b.stars - a.stars) * t, cloud: m('cloud'), cloudAlpha: a.cloudAlpha + (b.cloudAlpha - a.cloudAlpha) * t, glow: m('glow')
  }
}

/** suncalc azimuth (from south, west positive) → 0 (east) .. 1 (west) across the view. */
const across = (azimuth: number) => Math.min(1, Math.max(0, 0.5 + azimuth / Math.PI))

export function skyScene(lat: number, lng: number, at: Date = new Date()): SkyScene {
  const sun = SunCalc.getPosition(at, lat, lng)
  const moon = SunCalc.getMoonPosition(at, lat, lng)
  const illum = SunCalc.getMoonIllumination(at)
  const alt = (sun.altitude * 180) / Math.PI
  // Afternoon/evening when the sun is in the west.
  const evening = sun.azimuth > 0
  return {
    palette: paletteAt(alt, evening),
    sun: { x: across(sun.azimuth), alt },
    moon: { x: across(moon.azimuth), alt: (moon.altitude * 180) / Math.PI, fraction: illum.fraction, waxing: illum.phase < 0.5 }
  }
}

export const rgb = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`
export const darken = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k]
export { mix as mixRgb }
export type { RGB }
