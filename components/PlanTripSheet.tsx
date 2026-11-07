// components/PlanTripSheet.tsx — "Plan My Next Trip", a sheet opened from
// anywhere with openPlanTrip(): the Between-trips card, the "Add your
// dates" prompts, Browsing's card and Profile → Trips (also to edit a trip).
//   Where To?    a searchable town list with photos (components/TownPicker):
//                "Been here · 34% explored" or "New for you"; more towns
//                can be added as legs, each with its dates inside the trip
//   When?        one range calendar (components/RangeCalendar)
//   Where Are You Staying? · optional — search, or add later
//   a gold note  the welcome(-back) gift and "your points come with you"
//   Start The Countdown
// It only ever scrolls vertically. Works signed out (the trip stays on the
// device until they sign up). A local planning a getaway gets a GETAWAY
// trip (no airport, no arrival).
'use client'

import { useEffect, useMemo, useState } from 'react'
import Icon from '@/lib/icons'
import { useRegion } from '@/components/RegionProvider'
import { DateRangeField, RangeSheet, useRangeLabel } from '@/components/RangeCalendar'
import { TownField, TownSheet, useTravelHistory } from '@/components/TownPicker'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { getCurrentUser } from '@/lib/auth-client'
import { addTrip, allTrips, readDevice, updateTrip, type NewTrip } from '@/lib/stage-client'
import { addDays, jamaicaDayKey } from '@/lib/trip-dates'
import { isCityCode, townFor, type CityCode } from '@/lib/regions'
import { hapticBookingConfirmed, triggerHaptic } from '@/lib/haptics'
import type { StayResult } from '@/lib/stays'

const EVENT = 'eta-plan-trip'

export interface PlanTripDetail { city?: CityCode; tripId?: string }

export function openPlanTrip(detail: PlanTripDetail = {}) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail }))
}

interface Leg { city: CityCode; start: string; end: string }

export default function PlanTripSheet() {
  const { t, lang } = useLang()
  const errorText = useErrorText()
  const range = useRangeLabel()
  const { setCity } = useRegion()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [town, setTown] = useState<CityCode>('NEGRIL')
  const today = jamaicaDayKey()
  const [dates, setDates] = useState({ start: addDays(today, 30), end: addDays(today, 37) })
  const [legs, setLegs] = useState<Leg[]>([])
  // Adding another town: pick the town, then its dates inside the trip.
  const [legTown, setLegTown] = useState<CityCode | null>(null)
  const [pickingLegTown, setPickingLegTown] = useState(false)
  const [q, setQ] = useState('')
  const [stays, setStays] = useState<StayResult[]>([])
  const [stay, setStay] = useState<StayResult | null>(null)
  const [stayName, setStayName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { visited, explored } = useTravelHistory(open)

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

  const returning = visited.size > 0
  const points = getCurrentUser()?.points ?? 0
  const local = readDevice().travelerType === 'LOCAL' || getCurrentUser()?.travelerType === 'LOCAL'
  const close = () => { setOpen(false) }
  const usedTowns = useMemo(() => [town, ...legs.map(l => l.city)], [town, legs])

  // New trip dates: keep the extra towns inside them.
  const changeDates = (start: string, end: string) => {
    setDates({ start, end })
    setLegs(ls => ls.filter(l => l.start >= start && l.end <= end))
  }

  const save = async () => {
    setError(null)
    if (dates.end < dates.start) { setError(t('m.onb.datesOrder')); return }
    for (const l of legs) if (l.start < dates.start || l.end > dates.end || l.end < l.start) { setError(t('m.plan.legDates')); return }
    setBusy(true)
    const sorted = [...legs].sort((a, b) => a.start.localeCompare(b.start))
    const allLegs = sorted.length ? [{ city: town, start: dates.start, end: sorted[0].start }, ...sorted] : []
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
      <div className={`bottom-sheet plan-sheet-wrap ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open} aria-label={t('m.plan.title')} style={{ zIndex: 641 }}>
        <div className="sheet-grabber" />
        {open && (
          <div className="plan-sheet">
            <h2 className="plan-title">{editing ? t('m.plan.editTitle') : t('m.plan.title')}</h2>

            <p className="plan-label">{t('m.plan.whereTo')}</p>
            <TownField value={town} onChange={c => { setTown(c); setStay(null); setLegs(ls => ls.filter(l => l.city !== c)) }} title={t('m.plan.whereTo')} visited={visited} explored={explored} />

            <p className="plan-label">{t('m.plan.when')}</p>
            <DateRangeField start={dates.start} end={dates.end} onChange={changeDates} title={t('m.plan.when')} />

            {legs.map((l, i) => (
              <div key={`${l.city}${i}`} className="plan-leg">
                <Icon name="route" size={16} style={{ color: 'var(--rum-text)', flexShrink: 0 }} />
                <span className="plan-leg-text">
                  <span className="plan-leg-town">{townFor(l.city).name}</span>
                  <span className="plan-leg-dates num-font">{range(l.start, l.end)}</span>
                </span>
                <button type="button" className="icon-btn" aria-label={t('m.plan.removeTown')} onClick={() => setLegs(ls => ls.filter((_, j) => j !== i))}><Icon name="close" size={14} /></button>
              </div>
            ))}
            <button type="button" className="section-link plan-add" onClick={() => { triggerHaptic('light'); setPickingLegTown(true) }}>
              <Icon name="plus" size={14} /> {t('m.plan.addTown')}
            </button>

            <p className="plan-label">{t('m.plan.stay')} <span className="plan-optional">· {t('m.plan.optional')}</span></p>
            {stay || stayName ? (
              <div className="plan-stay-picked">
                <Icon name="home" size={16} /> <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stay?.name ?? stayName}</span>
                <button type="button" className="icon-btn" aria-label={t('m.plan.clearStay')} onClick={() => { setStay(null); setStayName(null) }}><Icon name="close" size={14} /></button>
              </div>
            ) : (
              <>
                <label className="plan-search">
                  <Icon name="search" size={16} style={{ color: 'var(--label-secondary)' }} />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('m.plan.stayPlaceholder')} aria-label={t('m.plan.stay')} />
                </label>
                {stays.length > 0 && (
                  <div className="plan-results">
                    {stays.map(s => <button type="button" key={`${s.accommodationId ?? s.name}`} onClick={() => { triggerHaptic('selection'); setStay(s); setQ('') }}><Icon name="home" size={14} /> <span className="plan-result-name">{s.name}</span> <span>{townFor(s.city).name}</span></button>)}
                  </div>
                )}
                {q.trim().length >= 2 && <button type="button" className="section-link" style={{ marginTop: '6px', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', cursor: 'pointer' }} onClick={() => { setStayName(q.trim()); setQ('') }}>{t('m.plan.useTyped', { name: q.trim() })}</button>}
                <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '6px' }}>{t('m.plan.addLater')}</p>
              </>
            )}

            <p className="plan-note">
              <Icon name="gift" size={16} />
              <span>{returning ? t('m.plan.noteBack', { points: points.toLocaleString(locale) }) : t('m.plan.noteNew')}</span>
            </p>
            {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginTop: '8px' }}>{error}</p>}
            <button type="button" className="btn btn-primary press" onClick={save} disabled={busy} style={{ width: '100%', marginTop: '14px', minHeight: '52px', fontSize: '17px' }}>
              {busy ? '…' : editing ? t('m.profile.save') : t('m.plan.start')}
            </button>
          </div>
        )}
      </div>

      {/* Another town: which, then its dates inside the trip */}
      <TownSheet open={pickingLegTown} title={t('m.plan.addTown')} value={null} visited={visited} explored={explored} exclude={usedTowns} onClose={() => setPickingLegTown(false)} onPick={c => { setPickingLegTown(false); setLegTown(c) }} />
      <RangeSheet
        open={legTown !== null}
        title={legTown ? t('m.plan.legWhen', { town: townFor(legTown).name }) : ''}
        start={null}
        end={null}
        min={dates.start}
        max={dates.end}
        onClose={() => setLegTown(null)}
        onDone={(s, e) => { if (legTown) setLegs(ls => [...ls, { city: legTown, start: s, end: e }]); setLegTown(null) }}
      />
    </>
  )
}
