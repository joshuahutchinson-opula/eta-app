// components/market/bits.tsx — small shared pieces for the Market sections:
// clock and countdown formatting (Jamaica time), walk/drive minutes from
// you, a ticking "now", the section head, the chapter separator, the heat
// scale and a few line icons Market needs.
'use client'

import { useEffect, useState } from 'react'
import { estimateMinutes, haversineKm, type LatLng } from '@/lib/routing'

const TZ = 'America/Jamaica'

export function useNow(everyMs = 30000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return now
}

/** "3:00 AM" style, Jamaica time, in the app's language. */
export function clockAt(at: Date | string | number, locale: string): string {
  return new Date(at).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: TZ })
}

/** "21:00" → a localized clock for today. */
export function clockHHMM(hhmm: string, locale: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(2000, 0, 1, h + 5, m || 0)).toLocaleTimeString(locale, { hour: 'numeric', minute: m ? '2-digit' : undefined, timeZone: TZ })
}

/** "1:52:10" until then. */
export function countdown(iso: string, now: number): string {
  const s = Math.max(0, Math.floor((Date.parse(iso) - now) / 1000))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${Math.floor(s / 60)}:${ss}`
}

/** Minutes from `from` to the place: walking when it's a reasonable walk, else driving. */
export function minutesTo(from: LatLng, to: { lat: number | null; lng: number | null }): { min: number; walk: boolean } | null {
  if (to.lat == null || to.lng == null) return null
  const km = haversineKm(from, { lat: to.lat, lng: to.lng })
  const walk = estimateMinutes(km, 'WALKING')
  return walk <= 25 ? { min: walk, walk: true } : { min: estimateMinutes(km, 'TAXI'), walk: false }
}

export function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mk-head">
      <div><h2 className="mk-st">{title}</h2></div>
      {action}
    </div>
  )
}

export function Chapter({ id, title, first }: { id: string; title: string; first?: boolean }) {
  return (
    <div id={id} className={`mk-chapter ${first ? 'first' : ''}`} role="separator" aria-label={title}>
      <p>{title}</p>
      <span aria-hidden />
    </div>
  )
}

const PEPPERS = ['#FFB800', '#FF7A00', '#FF3B30', '#B82010']

/** The scotch-bonnet heat scale, 1–4 filled. */
export function Heat({ level, onPhoto, label }: { level: number; onPhoto?: boolean; label: string }) {
  return (
    <span role="img" aria-label={label} style={{ display: 'inline-flex' }}>
      {PEPPERS.map((c, i) => (
        <span key={c} className="mk-pep" style={{ background: i < level ? c : onPhoto ? 'rgba(255,255,255,0.3)' : 'var(--label-quaternary)' }} />
      ))}
    </span>
  )
}

const AVATAR_TONES = ['#2E7D8C', '#C4654F', '#3B3F6B', '#B82010', '#2E8C6E', '#C98A2B']
export function avatarTone(name: string): string {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_TONES[h % AVATAR_TONES.length]
}

const LINE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export function MkIcon({ name, size = 18 }: { name: 'map' | 'cart' | 'cross' | 'phone' | 'heart' | 'pin' | 'quote'; size?: number }) {
  if (name === 'quote') {
    return <svg width="28" height="22" viewBox="0 0 28 22" aria-hidden><path d="M0 22V12C0 5 4 1 11 0l1 3C8 4 6 7 6 10h5v12zM16 22V12c0-7 4-11 11-12l1 3c-4 1-6 4-6 7h5v12z" fill="currentColor" opacity=".2" /></svg>
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...LINE}>
      {name === 'map' && <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>}
      {name === 'cart' && <><path d="M3 4h2l2.5 11h11L21 7H7" /><circle cx="10" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /></>}
      {name === 'cross' && <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></>}
      {name === 'phone' && <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>}
      {name === 'heart' && <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />}
      {name === 'pin' && <><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>}
    </svg>
  )
}
