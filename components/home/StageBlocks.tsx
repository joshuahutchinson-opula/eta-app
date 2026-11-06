// components/home/StageBlocks.tsx — the parts of Home that change with the
// trip stage (lib/stage.ts). The rest of Home stays the same; only the top
// changes:
//   StagePrompts    the confirm-first switches ("Starting your trip?",
//                   "Landed?", "Still here? Extend your trip", …)
//   GuestCard       "Sign up to save and earn points"
//   BrowsingCard    "Planning a trip? Add your dates"
//   CountdownBlock  live countdown tiles, Book Your Ride, Gift Waiting, On
//                   During Your Trip, Book Ahead, and for a returning
//                   traveler Places You Haven't Tried / Saved Last Time
//   LastTripCard    between trips: Your Last Trip, Plan My Next Trip, Recap
//   CruiseBlock     cruise day: rides back to the port, pinned
//   heroLines()     what the hero says for the stage
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import Price from '@/components/Price'
import { SaveHeart, SectionHead } from '@/components/home/bits'
import { DateTile } from '@/components/home/HomeEvents'
import { openPlanTrip } from '@/components/PlanTripSheet'
import { useRegion } from '@/components/RegionProvider'
import { apiJson } from '@/lib/api-client'
import { getCurrentUser, setCurrentUser } from '@/lib/auth-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { hapticBookingConfirmed, triggerHaptic } from '@/lib/haptics'
import { countdownParts, type Prompt, type StageResult } from '@/lib/stage'
import { dismissPrompt, setCruise, setDayTrip, setTravelerType, type TripView } from '@/lib/stage-client'
import { endTrip, extendTrip, prepareArrival, shiftTrip, startTrip, startTripToday } from '@/lib/stage-actions'
import { AIRPORTS, cruisePortFor, nearestAirport } from '@/lib/places-geo'
import { jamaicaDayKey } from '@/lib/trip-dates'
import { townFor, type CityCode } from '@/lib/regions'

const DAY = 86400000
const TZ = 'America/Jamaica'

function useLocale() {
  const { lang } = useLang()
  return lang === 'en' ? 'en-US' : lang
}

/** "Nov 14 – 21" in the traveler's language. */
export function useDateRange() {
  const locale = useLocale()
  return (start: string, end: string) => {
    const a = new Date(`${start}T12:00:00-05:00`)
    const b = new Date(`${end}T12:00:00-05:00`)
    const sameMonth = a.getUTCMonth() === b.getUTCMonth()
    const f = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString(locale, { timeZone: TZ, ...o })
    return `${f(a, { month: 'short', day: 'numeric' })} – ${sameMonth ? f(b, { day: 'numeric' }) : f(b, { month: 'short', day: 'numeric' })}`
  }
}

// ---------- Prompts ----------

export function StagePrompts({ result, trips, legCity }: { result: StageResult; trips: TripView[]; legCity: CityCode | null }) {
  const { t } = useLang()
  const router = useRouter()
  const { city, setCity } = useRegion()
  const errorText = useErrorText()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aboard, setAboard] = useState('16:30')
  const find = (id?: string) => trips.find(tr => tr.id === id) ?? (result.trip as TripView | null)

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    setError(null)
    triggerHaptic('medium')
    try { await fn() } catch (e) { setError(errorText(e)) } finally { setBusy(null) }
  }
  const later = (p: Prompt, ms: number) => { triggerHaptic('light'); dismissPrompt(p, ms) }

  if (!result.prompts.length) return null
  return (
    <div className="stage-prompts">
      {result.prompts.map(p => {
        const trip = find(p.tripId)
        const town = p.city ? townFor(p.city).name : trip ? townFor(trip.city).name : ''
        const key = `${p.kind}:${p.tripId ?? p.city ?? ''}`
        const actions = (...btns: Array<[string, () => void, 'primary' | 'secondary'] | false>) => (
          <div className="stage-prompt-actions">
            {btns.filter(Boolean).map(b => { const [label, on, kind] = b as [string, () => void, string]; return <button key={label} className={`btn btn-${kind} press`} disabled={busy !== null} onClick={on}>{busy === key && kind === 'primary' ? '…' : label}</button> })}
          </div>
        )
        switch (p.kind) {
          case 'arrival':
            return trip && (
              <div key={key} className="stage-prompt rum">
                <p className="stage-prompt-title"><Icon name="plane" size={18} /> {t('m.stage.arrivalTitle', { town })}</p>
                <p className="stage-prompt-sub">{trip.start === jamaicaDayKey() ? t('m.stage.arrivalSub') : t('m.stage.arrivalEarly')}</p>
                {actions([t('m.stage.startTrip'), () => run(key, async () => router.push(await startTrip(trip, { shiftToToday: true })) ), 'primary'], [t('m.stage.notYet'), () => later(p, 3 * 3600000), 'secondary'])}
              </div>
            )
          case 'landed':
            return trip && (
              <div key={key} className="stage-prompt rum">
                <p className="stage-prompt-title"><Icon name="plane" size={18} /> {t('m.stage.landedTitle')}</p>
                <p className="stage-prompt-sub">{t('m.stage.landedSub', { town })}</p>
                {actions([t('m.stage.landedYes'), () => run(key, async () => router.push(await startTrip(trip))), 'primary'], [t('m.stage.notYet'), () => later(p, 2 * 3600000), 'secondary'])}
              </div>
            )
          case 'arrivingToday':
            return (
              <div key={key} className="stage-prompt">
                <p className="stage-prompt-title"><Icon name="plane" size={18} /> {t('m.stage.arrivingToday')}</p>
                <p className="stage-prompt-sub">{t('m.stage.arrivingTodaySub', { town })}</p>
              </div>
            )
          case 'startGetaway':
            return trip && (
              <div key={key} className="stage-prompt rum">
                <p className="stage-prompt-title"><Icon name="route" size={18} /> {t('m.stage.getawayTitle', { town })}</p>
                {actions([t('m.stage.startTrip'), () => run(key, async () => { await startTrip(trip); if (trip.city !== city) setCity(trip.city) }), 'primary'], [t('m.stage.notYet'), () => later(p, 3 * 3600000), 'secondary'])}
              </div>
            )
          case 'inJamaica':
            return (
              <div key={key} className="stage-prompt rum">
                <p className="stage-prompt-title"><Icon name="sun" size={18} /> {t('m.stage.inJamaicaTitle')}</p>
                {actions(
                  [t('m.stage.inJamaicaYes'), () => run(key, async () => router.push(await startTripToday(city))), 'primary'],
                  [t('m.stage.liveHere'), () => run('local', () => setTravelerType('LOCAL')), 'secondary'],
                  [t('m.stage.notNow'), () => later(p, 7 * DAY), 'secondary']
                )}
              </div>
            )
          case 'shiftDates':
            return trip && (
              <div key={key} className="stage-prompt">
                <p className="stage-prompt-title"><Icon name="calendar" size={18} /> {(p.days ?? 0) < 0 ? t('m.stage.earlyTitle', { n: Math.abs(p.days ?? 0) }) : t('m.stage.lateTitle', { n: p.days ?? 0 })}</p>
                <p className="stage-prompt-sub">{t('m.stage.shiftSub')}</p>
                {actions([t('m.stage.shift'), () => run(key, async () => { await shiftTrip(trip, p.days ?? 0); dismissPrompt(p, 3650 * DAY) }), 'primary'], [t('m.stage.keepDates'), () => later(p, 3650 * DAY), 'secondary'])}
              </div>
            )
          case 'extend':
            return trip && (
              <div key={key} className="stage-prompt rum">
                <p className="stage-prompt-title"><Icon name="sun" size={18} /> {t('m.stage.extendTitle')}</p>
                {actions([t('m.stage.extend2'), () => run(key, () => extendTrip(trip, 2)), 'primary'], [t('m.stage.tripOver'), () => run('end', () => endTrip(trip, false)), 'secondary'])}
              </div>
            )
          case 'endEarly':
            return trip && (
              <div key={key} className="stage-prompt">
                <p className="stage-prompt-title"><Icon name="plane" size={18} /> {t('m.stage.endEarlyTitle')}</p>
                {actions([t('m.stage.endIt'), () => run(key, () => endTrip(trip, true)), 'primary'], [t('m.stage.notYet'), () => later(p, DAY), 'secondary'])}
              </div>
            )
          case 'dayTrip':
            return p.city && (
              <div key={key} className="stage-prompt">
                <p className="stage-prompt-title"><Icon name="compass" size={18} /> {t('m.stage.dayTripTitle', { town })}</p>
                <p className="stage-prompt-sub">{t('m.stage.dayTripSub')}</p>
                {actions([t('m.stage.dayTripYes'), () => { triggerHaptic('medium'); setDayTrip({ city: p.city!, day: jamaicaDayKey(), back: legCity ?? city }); setCity(p.city!); dismissPrompt(p, DAY) }, 'primary'], [t('m.stage.no'), () => later(p, DAY), 'secondary'])}
              </div>
            )
          case 'goingTo':
            return (
              <button key={key} className="stage-prompt red press" onClick={() => { triggerHaptic('light'); openPlanTrip({ city: p.city }) }}>
                <p className="stage-prompt-title"><Icon name="plane" size={18} /> {t('m.stage.goingTo', { town })}</p>
                <Icon name="chevronRight" size={16} />
              </button>
            )
          case 'cruise':
            return p.city && (
              <div key={key} className="stage-prompt rum">
                <p className="stage-prompt-title"><Icon name="ship" size={18} /> {t('m.stage.cruiseTitle', { port: cruisePortFor(p.city)?.name ?? town })}</p>
                <label className="stage-prompt-sub" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {t('m.stage.cruiseAboard')}
                  <input type="time" value={aboard} onChange={e => setAboard(e.target.value)} className="stage-time num-font" />
                </label>
                {actions([t('m.stage.cruiseStart'), () => run(key, async () => {
                  const day = jamaicaDayKey()
                  await setCruise({ port: p.city!, day, allAboardAt: new Date(`${day}T${aboard}:00-05:00`).toISOString() })
                  setCity(p.city!)
                }), 'primary'], [t('m.stage.notNow'), () => later(p, DAY), 'secondary'])}
              </div>
            )
          default:
            return null
        }
      })}
      {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', padding: '0 4px' }}>{error}</p>}
    </div>
  )
}

// ---------- Guest / Browsing ----------

export function GuestCard() {
  const { t } = useLang()
  return (
    <Link href="/register?next=/" className="stage-card press" onClick={() => triggerHaptic('light')}>
      <span className="stage-card-icon gold"><Icon name="star" size={20} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="stage-card-title">{t('m.stage.guestTitle')}</span>
        <span className="stage-card-sub">{t('m.stage.guestSub')}</span>
      </span>
      <Icon name="chevronRight" size={16} style={{ color: 'var(--label-tertiary)' }} />
    </Link>
  )
}

export function BrowsingCard() {
  const { t } = useLang()
  const { city } = useRegion()
  return (
    <button className="stage-card press" onClick={() => { triggerHaptic('light'); openPlanTrip({ city }) }}>
      <span className="stage-card-icon"><Icon name="plane" size={20} /></span>
      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span className="stage-card-title">{t('m.stage.browsingTitle')}</span>
        <span className="stage-card-sub">{t('m.stage.browsingSub')}</span>
      </span>
      <Icon name="chevronRight" size={16} style={{ color: 'var(--label-tertiary)' }} />
    </button>
  )
}

// ---------- Hero lines ----------

export function useHeroLines(result: StageResult, firstName: string | null, daypartLine: string, now: number) {
  const { t } = useLang()
  const range = useDateRange()
  const name = firstName ? `, ${firstName}` : ''
  const trip = result.trip
  if (result.stage === 'countdown' && trip) {
    const town = townFor(trip.city).name
    const d = Math.max(0, Math.ceil((Date.parse(`${trip.start}T00:00:00-05:00`) - now) / DAY))
    return {
      over: trip.returning ? t('m.stage.welcomeBack', { name }) : null,
      title: d === 0 ? t('m.stage.todayTo', { town }) : d === 1 ? t('m.stage.dayTo', { town }) : t('m.stage.daysTo', { n: d, town }),
      line: [range(trip.start, trip.end), trip.stayName].filter(Boolean).join(' · ')
    }
  }
  if (result.stage === 'between') return { over: null, title: t('m.stage.welcomeBackTitle', { name }), line: daypartLine }
  if (result.stage === 'cruise') return { over: null, title: t('m.home.greeting', { name }), line: daypartLine }
  return { over: null, title: t('m.home.greeting', { name }), line: daypartLine }
}

// ---------- Countdown ----------

interface CountdownData {
  returning: boolean
  visitedTown: boolean
  events: Array<{ id: string; title: string; venueName: string; startAt: string; imageUrl: string | null; isFree: boolean; price: number | null }>
  bookAhead: Array<{ id: string; name: string; image: string; price: number; spotsLeft: number | null; fullyBooked: string | null }>
  gift: { id: string; name: string; description: string; welcomeBack: boolean } | null
  notTried: Array<{ id: string; name: string; image: string | null; category: string; neighborhood: string }>
  savedLast: Array<{ id: string; name: string; image: string | null; category: string; neighborhood: string }>
}

function Tiles({ start }: { start: string }) {
  const { t } = useLang()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  const p = countdownParts(start, now)
  const cells: Array<[number, string]> = [[p.days, t('m.stage.tDays')], [p.hours, t('m.stage.tHrs')], [p.minutes, t('m.stage.tMin')], [p.seconds, t('m.stage.tSec')]]
  return (
    <div className="cd-tiles" role="timer" aria-label={t('m.stage.daysTo', { n: p.days, town: '' })}>
      {cells.map(([n, label]) => (
        <span key={label} className="cd-tile"><span className="cd-num num-font">{String(n).padStart(2, '0')}</span><span className="cd-label">{label}</span></span>
      ))}
    </div>
  )
}

function PlaceRow({ title, eyebrow, items }: { title: string; eyebrow: string; items: CountdownData['notTried'] }) {
  const labels = useLabels()
  if (!items.length) return null
  return (
    <div className="home-section">
      <SectionHead eyebrow={eyebrow} title={title} />
      <div className="horizontal-scroll" style={{ padding: '0 20px 6px', gap: '12px' }}>
        {items.map(v => (
          <Link key={v.id} href={`/vendor/${v.id}`} className="mini-card press" onClick={() => triggerHaptic('light')}>
            <span className="mini-card-media">{v.image ? <Img src={v.image} alt="" width={320} height={240} sizes="44vw" /> : <Icon name="mapPin" size={22} />}</span>
            <span className="mini-card-title">{v.name}</span>
            <span className="mini-card-sub">{[labels.category(v.category), v.neighborhood].filter(Boolean).join(' · ')}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function CountdownBlock({ trip }: { trip: TripView }) {
  const { t } = useLang()
  const locale = useLocale()
  const [data, setData] = useState<CountdownData | null>(null)
  const [rideOpen, setRideOpen] = useState(false)
  const citiesKey = Array.from(new Set([trip.city, ...trip.legs.map(l => l.city)])).join(',')

  useEffect(() => {
    let cancelled = false
    apiJson<CountdownData>(`/api/home/stage?stage=countdown&cities=${citiesKey}&start=${trip.start}&end=${trip.end}`)
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData(null) })
    // Within three days of landing: keep the arrival ready for the airport (offline there).
    if (Date.parse(`${trip.start}T00:00:00-05:00`) - Date.now() < 3 * DAY) prepareArrival(trip)
    return () => { cancelled = true }
  }, [citiesKey, trip.id, trip.start, trip.end]) // eslint-disable-line react-hooks/exhaustive-deps

  const fmtDay = (d: string) => new Date(`${d}T12:00:00-05:00`).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ })

  return (
    <section className="home-section" style={{ marginTop: '18px' }} aria-label={t('m.stage.countdownAria')}>
      <div style={{ padding: '0 20px' }}><Tiles start={trip.start} /></div>
      <div className="cd-cards">
        {trip.kind === 'VISIT' && (
          <button className="cd-card press" onClick={() => { triggerHaptic('light'); setRideOpen(true) }}>
            <span className="cd-card-icon"><Icon name="car" size={20} /></span>
            <span className="cd-card-title">{t('m.stage.bookRide')}</span>
            <span className="cd-card-sub">{t('m.stage.bookRideSub', { stay: trip.stayName ?? townFor(trip.city).name })}</span>
          </button>
        )}
        <div className="cd-card gold">
          <span className="cd-card-icon"><Icon name="gift" size={20} /></span>
          <span className="cd-card-title">{t('m.stage.giftWaiting')}</span>
          <span className="cd-card-sub">{data?.gift ? `${data.gift.name} · ${t('m.stage.giftUnlocks')}` : t('m.stage.giftUnlocks')}</span>
        </div>
      </div>

      {data && data.events.length > 0 && (
        <div className="home-section">
          <SectionHead eyebrow={t('m.stage.onEyebrow')} title={t('m.stage.onTitle')} href="/events" linkLabel={t('m.events.seeAll')} />
          <div className="horizontal-scroll" style={{ padding: '0 20px 6px', gap: '12px' }}>
            {data.events.map(ev => (
              <Link key={ev.id} href={`/events/${ev.id}`} className="cd-event press" onClick={() => triggerHaptic('light')}>
                <DateTile iso={ev.startAt} small />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="cd-event-title">{ev.title}</span>
                  <span className="cd-event-sub">{ev.venueName}</span>
                </span>
                <SaveHeart kind="events" id={ev.id} size={16} className="save-btn cd-save" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {data && data.bookAhead.length > 0 && (
        <div className="home-section">
          <SectionHead eyebrow={t('m.stage.aheadEyebrow')} title={t('m.stage.aheadTitle')} />
          <div className="home-card" style={{ margin: '0 20px' }}>
            {data.bookAhead.map(x => (
              <Link key={x.id} href={`/experiences/${x.id}`} className="ahead-row press" onClick={() => triggerHaptic('light')}>
                <span className="ahead-img"><Img src={x.image} alt="" width={120} height={120} sizes="56px" /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="ahead-title">{x.name}</span>
                  <span className={`ahead-left ${x.fullyBooked ? 'full' : ''}`}>{x.fullyBooked ? t('m.stage.fullyBooked', { date: fmtDay(x.fullyBooked) }) : t('m.stage.spotsLeft', { n: x.spotsLeft ?? 0 })}</span>
                </span>
                <Price usd={x.price} style={{ fontWeight: 700, color: 'var(--label-primary)' }} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {data && <PlaceRow eyebrow={t('m.stage.backEyebrow')} title={t('m.stage.notTried')} items={data.notTried} />}
      {data && <PlaceRow eyebrow={t('m.stage.backEyebrow')} title={t('m.stage.savedLast')} items={data.savedLast} />}

      {rideOpen && <RideSheet trip={trip} onClose={() => setRideOpen(false)} />}
    </section>
  )
}

// ---------- Book Your Ride ----------

interface RideOption { id: string; vendor: { id: string; name: string; image: string | null }; vehicle: string; seats: number; driverName: string | null; driverPhoto: string | null; price: number }

function RideSheet({ trip, onClose }: { trip: TripView; onClose: () => void }) {
  const { t } = useLang()
  const router = useRouter()
  const errorText = useErrorText()
  const town = townFor(trip.stayCity ?? trip.city)
  const to = trip.stayLat !== null && trip.stayLng !== null ? { lat: trip.stayLat, lng: trip.stayLng } : town
  const [airport, setAirport] = useState(trip.arrivalAirport ?? nearestAirport(to).code)
  const [landing, setLanding] = useState('14:00')
  const [rides, setRides] = useState<{ minutes: number; options: RideOption[] } | null>(null)
  const [pick, setPick] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setRides(null)
    fetch(`/api/transfers?airport=${airport}&lat=${to.lat}&lng=${to.lng}`)
      .then(r => (r.ok ? r.json() : { minutes: 0, options: [] }))
      .then(d => { setRides(d); setPick(d.options?.[0]?.id ?? null) })
      .catch(() => setRides({ minutes: 0, options: [] }))
  }, [airport, to.lat, to.lng])

  const book = async () => {
    const choice = rides?.options.find(o => o.id === pick)
    if (!choice) return
    if (!getCurrentUser()) { router.push('/register?next=/'); return }
    setBusy(true)
    setMsg(null)
    try {
      const wallet = getCurrentUser()?.walletBalance ?? 0
      const res = await apiJson<{ walletBalance: number | null }>('/api/transfers/book', { method: 'POST', body: { serviceId: choice.id, lat: to.lat, lng: to.lng, dropoff: trip.stayName ?? town.name, partySize: Math.max(1, trip.members.length), payWith: wallet >= choice.price ? 'wallet' : 'driver', pickupAt: new Date(`${trip.start}T${landing}:00-05:00`).toISOString() } })
      const u = getCurrentUser()
      if (u && typeof res.walletBalance === 'number') setCurrentUser({ ...u, walletBalance: res.walletBalance })
      hapticBookingConfirmed()
      setDone(true)
      prepareArrival(trip)
    } catch (e) {
      setMsg(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="bottom-sheet-overlay open" onClick={onClose} />
      <div className="bottom-sheet open" role="dialog" aria-modal="true" aria-label={t('m.stage.bookRide')} style={{ maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="sheet-grabber" />
        <div style={{ padding: '0 20px 24px', color: 'var(--label-primary)' }}>
          <h3 style={{ fontSize: '22px', fontWeight: 800 }}>{t('m.stage.bookRide')}</h3>
          <p style={{ fontSize: '14px', color: 'var(--label-secondary)', margin: '4px 0 14px' }}>{t('m.stage.bookRideSub', { stay: trip.stayName ?? town.name })}</p>
          {done ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <Icon name="check" size={32} style={{ color: 'var(--success)' }} />
              <p style={{ fontSize: '17px', fontWeight: 700, color: 'var(--label-primary)' }}>{t('m.stage.rideBooked')}</p>
              <button className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>{t('m.profile.done')}</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <label className="field-label">{t('m.stage.airport')}
                  <select value={airport} onChange={e => setAirport(e.target.value)} className="field">
                    {AIRPORTS.map(a => <option key={a.code} value={a.code}>{a.code}</option>)}
                  </select>
                </label>
                <label className="field-label">{t('m.stage.landing')}
                  <input type="time" value={landing} onChange={e => setLanding(e.target.value)} className="field num-font" />
                </label>
              </div>
              {trip.stayLat === null && <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '10px' }}>{t('m.stage.addStayForFare')}</p>}
              <div role="radiogroup" aria-label={t('m.stage.bookRide')} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {rides === null ? [0, 1].map(i => <div key={i} className="home-skel" style={{ height: '64px' }} aria-hidden />)
                  : rides.options.length === 0 ? <p style={{ fontSize: '14px', color: 'var(--label-secondary)' }}>{t('m.arrival.noRides')}</p>
                  : rides.options.map(o => (
                    <button key={o.id} role="radio" aria-checked={pick === o.id} onClick={() => { triggerHaptic('selection'); setPick(o.id) }} className={`ride-opt ${pick === o.id ? 'on' : ''}`}>
                      <span className="ride-avatar">{o.driverPhoto ?? o.vendor.image ? <Img src={(o.driverPhoto ?? o.vendor.image)!} alt="" width={96} height={96} sizes="44px" /> : (o.driverName ?? o.vendor.name).charAt(0)}</span>
                      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <span style={{ display: 'block', fontWeight: 700 }}>{o.driverName ? `${o.driverName} · ${o.vendor.name}` : o.vendor.name}</span>
                        <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>{o.vehicle} · {t('m.stage.seats', { n: o.seats })}{rides.minutes ? ` · ${t('m.arrival.minutes', { n: rides.minutes })}` : ''}</span>
                      </span>
                      <Price usd={o.price} style={{ fontWeight: 800 }} />
                    </button>
                  ))}
              </div>
              {msg && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginTop: '8px' }}>{msg}</p>}
              <button className="btn btn-primary press" onClick={book} disabled={busy || !pick} style={{ width: '100%', marginTop: '14px' }}>{busy ? '…' : t('m.stage.bookRideCta')}</button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ---------- Between trips ----------

interface Stats { places: number; sunsets: number; explored: number; points: number; photos: string[] }

export function LastTripCard({ trip }: { trip: TripView }) {
  const { t } = useLang()
  const range = useDateRange()
  const [stats, setStats] = useState<Stats | null>(null)
  useEffect(() => {
    if (trip.local || !getCurrentUser()) { setStats({ places: 0, sunsets: Math.max(1, Math.round((Date.parse(trip.end) - Date.parse(trip.start)) / DAY)), explored: 0, points: 0, photos: [] }); return }
    apiJson<{ stats: Stats | null }>(`/api/travel-trips/${trip.id}`).then(d => setStats(d.stats)).catch(() => setStats(null))
  }, [trip.id, trip.start, trip.end]) // eslint-disable-line react-hooks/exhaustive-deps
  const town = townFor(trip.city).name
  return (
    <section className="home-section" style={{ marginTop: '18px' }}>
      <SectionHead eyebrow={t('m.stage.lastEyebrow')} title={t('m.stage.lastTitle')} href="/trips" linkLabel={t('m.trips.all')} />
      <div className="home-card last-trip" style={{ margin: '0 20px' }}>
        <div className="last-strip" aria-hidden>
          {(stats?.photos.length ? stats.photos : [null, null, null]).slice(0, 3).map((p, i) => <span key={p ?? i}>{p ? <Img src={p} alt="" width={300} height={300} sizes="33vw" /> : <Icon name="image" size={20} />}</span>)}
        </div>
        <div style={{ padding: '14px 16px 16px' }}>
          <p className="last-title">{town} · <span className="num-font">{range(trip.start, trip.end)}</span></p>
          <div className="last-stats">
            {([[stats?.places, t('m.stage.statPlaces')], [stats?.sunsets, t('m.stage.statSunsets')], [stats ? `${stats.explored}%` : undefined, t('m.stage.statExplored')], [stats?.points?.toLocaleString(), t('m.stage.statPoints')]] as Array<[string | number | undefined, string]>).map(([v, label]) => (
              <span key={label} className="last-stat"><span className="num-font">{v ?? '–'}</span><span>{label}</span></span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <button className="btn btn-primary press" style={{ flex: 1.3 }} onClick={() => { triggerHaptic('light'); openPlanTrip({}) }}>{t('m.plan.title')}</button>
            <Link href="/recap" className="btn btn-secondary press" style={{ flex: 1, textDecoration: 'none' }}>{t('m.stage.recap')}</Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------- Cruise day ----------

export function useAboard(allAboardAt: string | null) {
  const { t } = useLang()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id) }, [])
  if (!allAboardAt) return null
  const mins = Math.max(0, Math.round((Date.parse(allAboardAt) - now) / 60000))
  return mins === 0 ? t('m.cruise.aboardNow') : t('m.cruise.aboardIn', { h: Math.floor(mins / 60), m: mins % 60 })
}

export function CruiseBlock({ port, allAboardAt }: { port: CityCode; allAboardAt: string }) {
  const { t, lang } = useLang()
  const [rides, setRides] = useState<Array<{ id: string; name: string; image: string | null; phone: string | null; whatsapp: string | null; neighborhood: string }> | null>(null)
  const label = useAboard(allAboardAt)
  useEffect(() => {
    apiJson<{ rides: NonNullable<typeof rides> }>(`/api/home/stage?stage=cruise&port=${port}`).then(d => setRides(d.rides)).catch(() => setRides([]))
  }, [port])
  const portInfo = cruisePortFor(port)
  const time = new Date(allAboardAt).toLocaleTimeString(lang === 'en' ? 'en-US' : lang, { hour: 'numeric', minute: '2-digit', timeZone: TZ })
  return (
    <section className="home-section" style={{ marginTop: '18px' }}>
      <SectionHead eyebrow={t('m.cruise.eyebrow')} title={t('m.cruise.ridesBack')} />
      <div className="home-card" style={{ margin: '0 20px', padding: '14px 16px' }}>
        <p className="cruise-aboard"><Icon name="ship" size={18} /> <span className="num-font">{label}</span> · {t('m.cruise.at', { time, port: portInfo?.name ?? '' })}</p>
        <button className="section-link" style={{ background: 'none', border: 'none', padding: 0, marginTop: '4px', fontFamily: 'inherit', cursor: 'pointer' }} onClick={() => setCruise(null)}>{t('m.cruise.endDay')}</button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
          {rides === null ? <div className="home-skel" style={{ height: '56px' }} aria-hidden />
            : rides.length === 0 ? <p style={{ fontSize: '14px', color: 'var(--label-secondary)' }}>{t('m.cruise.noRides')}</p>
            : rides.map(r => (
              <div key={r.id} className="cruise-ride">
                <span className="ride-avatar">{r.image ? <Img src={r.image} alt="" width={96} height={96} sizes="44px" /> : <Icon name="car" size={18} />}</span>
                <Link href={`/vendor/${r.id}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'var(--label-primary)', fontWeight: 700 }}>{r.name}</Link>
                {r.phone && <a className="icon-btn" href={`tel:${r.phone}`} aria-label={t('m.cruise.call', { name: r.name })}><Icon name="phone" size={16} /></a>}
                {r.whatsapp && <a className="icon-btn" href={`https://wa.me/${r.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" aria-label={t('m.cruise.whatsapp', { name: r.name })}><Icon name="message" size={16} /></a>}
              </div>
            ))}
        </div>
      </div>
    </section>
  )
}
