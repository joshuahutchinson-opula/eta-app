// components/PlanTripSheet.tsx — "Plan My Next Trip", a sheet opened from
// anywhere with openPlanTrip(): the Between-trips card, the "Add your
// dates" prompts, Browsing's card and Profile → Trips (also to edit a trip).
//   Where To?    town tiles: "Been here · 34% explored" or "New for you";
//                more towns can be added as legs of the same trip
//   When?        arrive / leave
//   Where Are You Staying? · optional — search, or add later
//   a gold note  the welcome(-back) gift and "your points come with you"
//   Start The Countdown
// Works signed out (the trip stays on the device until they sign up). A
// local planning a getaway gets a GETAWAY trip (no airport, no arrival).
'use client'

import { useEffect, useMemo, useState } from 'react'
import Icon from '@/lib/icons'
import { useRegion } from '@/components/RegionProvider'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { getCurrentUser } from '@/lib/auth-client'
import { addTrip, allTrips, readDevice, updateTrip, type NewTrip } from '@/lib/stage-client'
import { addDays, jamaicaDayKey } from '@/lib/trip-dates'
import { isCityCode, townFor, type CityCode } from '@/lib/regions'
import { hapticBookingConfirmed, triggerHaptic } from '@/lib/haptics'
import type { StayResult } from '@/lib/stays'

const EVENT = 'eta-plan-trip'
const POPULAR: CityCode[] = ['NEGRIL', 'MONTEGO_BAY', 'OCHO_RIOS', 'KINGSTON', 'PORT_ANTONIO', 'TREASURE_BEACH', 'RUNAWAY_BAY', 'FALMOUTH']

export interface PlanTripDetail { city?: CityCode; tripId?: string }

export function openPlanTrip(detail: PlanTripDetail = {}) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail }))
}

interface Leg { city: CityCode; start: string; end: string }

export default function PlanTripSheet() {
  const { t, lang } = useLang()
  const errorText = useErrorText()
  const { setCity } = useRegion()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [town, setTown] = useState<CityCode>('NEGRIL')
  const today = jamaicaDayKey()
  const [dates, setDates] = useState({ start: addDays(today, 30), end: addDays(today, 37) })
  const [legs, setLegs] = useState<Leg[]>([])
  const [q, setQ] = useState('')
  const [stays, setStays] = useState<StayResult[]>([])
  const [stay, setStay] = useState<StayResult | null>(null)
  const [stayName, setStayName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [explored, setExplored] = useState<Record<string, number>>({})

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<PlanTripDetail>).detail ?? {}
      const trip = d.tripId ? allTrips().find(x => x.id === d.tripId) : null
      setEditing(trip?.id ?? null)
      setTown(trip?.city ?? (d.city && isCityCode(d.city) ? d.city : 'NEGRIL'))
      setDates(trip ? { start: trip.start, end: trip.end } : { start: addDays(jamaicaDayKey(), 30), end: addDays(jamaicaDayKey(), 37) })
      setLegs(trip?.legs.slice(1) ?? [])
      setStay(null)
      setStayName(trip?.stayName ?? null)
      setQ('')
      setError(null)
      try { setExplored(JSON.parse(localStorage.getItem('eta_travel_trips') || '{}').explored ?? {}) } catch { setExplored({}) }
      setOpen(true)
    }
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])

  // Stay search, in the picked town.
  useEffect(() => {
    if (!open || q.trim().length < 2) { setStays([]); return }
    let cancelled = false
    const timer = setTimeout(() => {
      fetch(`/api/stays?q=${encodeURIComponent(q.trim())}&city=${town}&limit=8`).then(r => (r.ok ? r.json() : [])).then(d => { if (!cancelled) setStays(Array.isArray(d) ? d : []) }).catch(() => {})
    }, 220)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [q, town, open])

  const visited = useMemo(() => {
    const past = allTrips().filter(x => x.status === 'ENDED' || x.end < jamaicaDayKey())
    return new Set<string>([...past.map(x => x.city), ...past.flatMap(x => x.legs.map(l => l.city)), ...Object.keys(explored)])
  }, [explored, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const returning = visited.size > 0
  const points = getCurrentUser()?.points ?? 0
  const local = readDevice().travelerType === 'LOCAL' || getCurrentUser()?.travelerType === 'LOCAL'
  const close = () => { setOpen(false) }
  const nights = Math.max(0, Math.round((Date.parse(dates.end) - Date.parse(dates.start)) / 86400000))

  const save = async () => {
    setError(null)
    if (dates.end < dates.start) { setError(t('m.onb.datesOrder')); return }
    for (const l of legs) if (l.start < dates.start || l.end > dates.end || l.end < l.start) { setError(t('m.plan.legDates')); return }
    setBusy(true)
    const allLegs = legs.length ? [{ city: town, start: dates.start, end: legs[0].start }, ...legs] : []
    const input: NewTrip = {
      kind: local ? 'GETAWAY' : 'VISIT',
      city: town, start: dates.start, end: dates.end, legs: allLegs,
      ...(stay ? { stayName: stay.name, stayCity: stay.city as CityCode, stayAccommodationId: stay.accommodationId, stayLat: stay.lat ?? null, stayLng: stay.lng ?? null } : stayName !== null ? { stayName } : {})
    }
    try {
      if (editing) await updateTrip(editing, input)
      else await addTrip(input)
      hapticBookingConfirmed()
      if (dates.start <= jamaicaDayKey()) setCity(town)
      setOpen(false)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const locale = lang === 'en' ? 'en-US' : lang

  return (
    <>
      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={close} style={{ zIndex: 640 }} />
      <div className={`bottom-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open} aria-label={t('m.plan.title')} style={{ zIndex: 641, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="sheet-grabber" />
        {open && (
          <div className="plan-sheet">
            <h2 className="plan-title">{editing ? t('m.plan.editTitle') : t('m.plan.title')}</h2>

            <p className="plan-label">{t('m.plan.whereTo')}</p>
            <div className="plan-towns">
              {POPULAR.map(c => {
                const been = visited.has(c)
                return (
                  <button key={c} className={`plan-town press ${town === c ? 'on' : ''}`} aria-pressed={town === c} onClick={() => { triggerHaptic('selection'); setTown(c); setStay(null) }}>
                    <span className="plan-town-name">{townFor(c).name}</span>
                    <span className="plan-town-sub">{been ? t('m.plan.beenHere', { n: explored[c] ?? 0 }) : t('m.plan.newForYou')}</span>
                  </button>
                )
              })}
            </div>

            <p className="plan-label">{t('m.plan.when')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <label className="field-label">{t('m.onb.arrive')}
                <input type="date" className="field" value={dates.start} onChange={e => setDates(d => ({ start: e.target.value, end: d.end < e.target.value ? e.target.value : d.end }))} />
              </label>
              <label className="field-label">{t('m.onb.leave')}
                <input type="date" className="field" value={dates.end} min={dates.start} onChange={e => setDates(d => ({ ...d, end: e.target.value }))} />
              </label>
            </div>
            <p className="num-font" style={{ fontSize: '13px', color: 'var(--label-secondary)', margin: '6px 0 0' }}>{t('m.onb.nights', { n: nights + 1 })}</p>

            {legs.map((l, i) => (
              <div key={i} className="plan-leg">
                <select className="field" value={l.city} aria-label={t('m.plan.town')} onChange={e => setLegs(ls => ls.map((x, j) => (j === i ? { ...x, city: e.target.value as CityCode } : x)))}>
                  {POPULAR.map(c => <option key={c} value={c}>{townFor(c).name}</option>)}
                </select>
                <input type="date" className="field" aria-label={t('m.onb.arrive')} value={l.start} min={dates.start} max={dates.end} onChange={e => setLegs(ls => ls.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                <input type="date" className="field" aria-label={t('m.onb.leave')} value={l.end} min={l.start} max={dates.end} onChange={e => setLegs(ls => ls.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                <button className="icon-btn" aria-label={t('m.plan.removeTown')} onClick={() => setLegs(ls => ls.filter((_, j) => j !== i))}><Icon name="close" size={14} /></button>
              </div>
            ))}
            <button className="section-link plan-add" onClick={() => setLegs(ls => [...ls, { city: POPULAR.find(c => c !== town) ?? 'KINGSTON', start: addDays(dates.start, Math.ceil(nights / 2)), end: dates.end }])}>
              <Icon name="plus" size={14} /> {t('m.plan.addTown')}
            </button>

            <p className="plan-label">{t('m.plan.stay')} <span className="plan-optional">· {t('m.plan.optional')}</span></p>
            {stay || stayName ? (
              <div className="plan-stay-picked">
                <Icon name="home" size={16} /> <span style={{ flex: 1 }}>{stay?.name ?? stayName}</span>
                <button className="icon-btn" aria-label={t('m.plan.clearStay')} onClick={() => { setStay(null); setStayName(null) }}><Icon name="close" size={14} /></button>
              </div>
            ) : (
              <>
                <label className="plan-search">
                  <Icon name="search" size={16} style={{ color: 'var(--label-secondary)' }} />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('m.plan.stayPlaceholder')} aria-label={t('m.plan.stay')} />
                </label>
                {stays.length > 0 && (
                  <div className="plan-results">
                    {stays.map(s => <button key={`${s.accommodationId ?? s.name}`} onClick={() => { triggerHaptic('selection'); setStay(s); setQ('') }}><Icon name="home" size={14} /> {s.name} <span>{townFor(s.city).name}</span></button>)}
                  </div>
                )}
                {q.trim().length >= 2 && <button className="section-link" style={{ marginTop: '6px' }} onClick={() => { setStayName(q.trim()); setQ('') }}>{t('m.plan.useTyped', { name: q.trim() })}</button>}
                <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '6px' }}>{t('m.plan.addLater')}</p>
              </>
            )}

            <p className="plan-note">
              <Icon name="gift" size={16} />
              <span>{returning ? t('m.plan.noteBack', { points: points.toLocaleString(locale) }) : t('m.plan.noteNew')}</span>
            </p>
            {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginTop: '8px' }}>{error}</p>}
            <button className="btn btn-primary press" onClick={save} disabled={busy} style={{ width: '100%', marginTop: '14px', minHeight: '52px', fontSize: '17px' }}>
              {busy ? '…' : editing ? t('m.profile.save') : t('m.plan.start')}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
