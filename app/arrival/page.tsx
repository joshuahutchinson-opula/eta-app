// app/arrival/page.tsx — the arrival flow, one step per screen, on first open
// at an airport or hotel (lib/arrival-client.ts sends people here):
//   1 Welcome     animated background, "Welcome to Jamaica." and the
//                 welcome gift as the hero; one button
//   2 Stay        "Where are you staying?" — search, town chips, partners
//                 first, or drop a pin; picking one sets the region
//   3 Ride        "Need a ride?" — three vetted fixed-price transfers
//   4 Checked in  the property, the host's gift and where it is
// Hotel arrivals skip 2 and 3. Onboarding still asks the travel dates and
// vibe afterwards, without the stay step (lib/arrival-client arrivalDone). The step survives a trip to the login screen
// (?step=). Motion stops when the phone asks for reduced motion.
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import Price from '@/components/Price'
import GiftBox from '@/components/arrival/GiftBox'
import PartnerBadge from '@/components/PartnerBadge'
import { useRegion } from '@/components/RegionProvider'
import { getCurrentUser, setCurrentUser } from '@/lib/auth-client'
import { apiJson } from '@/lib/api-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { finishArrival, readArrival, type ArrivalPayload } from '@/lib/arrival-client'
import { saveTrip, setPendingWelcome, setPlanDay } from '@/lib/trip-mode'
import { jamaicaDayKey } from '@/lib/trip-dates'
import { isCityCode, nearestTown, parishFor, TOWNS, townFor } from '@/lib/regions'
import { haversineKm } from '@/lib/routing'
import { hapticBookingConfirmed, hapticRewardRedeemed, triggerHaptic } from '@/lib/haptics'
import type { StayResult } from '@/lib/stays'

const PinDropMap = dynamic(() => import('@/components/arrival/PinDropMap'), { ssr: false })

type Step = 'welcome' | 'stay' | 'ride' | 'checkin'
const FLOW_KEY = 'eta_arrival_flow'

interface ChosenStay { name: string; city: string; lat: number | null; lng: number | null; image: string | null; accommodationId: string | null; partnerCode: string | null }
interface RideOption { id: string; vendor: { id: string; name: string; image: string | null }; vehicle: string; seats: number; readyMinutes: number; driverName: string | null; driverPhoto: string | null; price: number }
interface Rides { airport: { code: string; name: string }; km: number; minutes: number; options: RideOption[] }
interface HostGift { name: string; description: string; vendor: { name: string; lat: number; lng: number } | null }

function readFlow(): { step?: Step; stay?: ChosenStay | null; ride?: { vendor: string; price: number } | null } {
  try { return JSON.parse(sessionStorage.getItem(FLOW_KEY) || '{}') } catch { return {} }
}
function writeFlow(patch: Record<string, unknown>) {
  try { sessionStorage.setItem(FLOW_KEY, JSON.stringify({ ...readFlow(), ...patch })) } catch {}
}

export default function ArrivalFlow() {
  const router = useRouter()
  const { t } = useLang()
  const errorText = useErrorText()
  const { setCity, town } = useRegion()
  const [arrival, setArrival] = useState<ArrivalPayload | null>(null)
  const [step, setStepState] = useState<Step>('welcome')
  const [stay, setStay] = useState<ChosenStay | null>(null)
  const [booked, setBooked] = useState<{ vendor: string; price: number } | null>(null)

  useEffect(() => {
    const a = readArrival()
    if (!a) { router.replace('/'); return }
    setArrival(a)
    if (isCityCode(a.city)) setCity(a.city)
    const flow = readFlow()
    const asked = new URLSearchParams(window.location.search).get('step') as Step | null
    setStay(flow.stay ?? (a.place.kind === 'hotel' ? { name: a.place.name, city: a.place.city, lat: a.place.lat ?? null, lng: a.place.lng ?? null, image: a.place.image ?? null, accommodationId: null, partnerCode: a.place.partnerCode ?? null } : null))
    setBooked(flow.ride ?? null)
    const s = asked ?? flow.step
    if (s && ['welcome', 'stay', 'ride', 'checkin'].includes(s)) setStepState(s)
  }, [router, setCity])

  const go = useCallback((next: Step) => {
    triggerHaptic('light')
    setStepState(next)
    writeFlow({ step: next })
    window.scrollTo({ top: 0 })
  }, [])

  const exit = (to: string) => {
    finishArrival()
    try { sessionStorage.removeItem(FLOW_KEY) } catch {}
    router.replace(to)
  }

  if (!arrival) return <main className="arrival-bg" />

  return (
    <main style={{ minHeight: '100dvh', position: 'relative', zIndex: 1, color: 'white' }}>
      <div className="arrival-bg" />
      {step === 'welcome' && (
        <WelcomeScreen arrival={arrival} onSkip={() => exit('/')} onNext={() => go(arrival.place.kind === 'airport' ? 'stay' : 'checkin')} />
      )}
      {step === 'stay' && (
        <StayScreen
          arrival={arrival}
          onPick={async picked => {
            setStay(picked)
            writeFlow({ stay: picked })
            if (isCityCode(picked.city)) setCity(picked.city)
            await saveTrip({ stayName: picked.name, stayCity: picked.city, stayAccommodationId: picked.accommodationId, stayLat: picked.lat, stayLng: picked.lng, stayImage: picked.image, ...(picked.partnerCode ? { partnerCode: picked.partnerCode } : {}) }).catch(() => {})
            go(picked.lat !== null && picked.lng !== null && arrival.place.airport ? 'ride' : 'checkin')
          }}
        />
      )}
      {step === 'ride' && stay && (
        <RideScreen
          arrival={arrival}
          stay={stay}
          errorText={errorText}
          onDone={ride => { setBooked(ride); writeFlow({ ride }); go('checkin') }}
        />
      )}
      {step === 'checkin' && (
        <CheckedInScreen
          stay={stay}
          townName={stay && isCityCode(stay.city) ? townFor(stay.city).name : town.name}
          booked={booked}
          onPlan={() => { setPlanDay(jamaicaDayKey()); exit('/experiences') }}
          onExplore={() => exit('/')}
        />
      )}
      {/* The ride step needs a stay; fall through to the stay picker without one. */}
      {step === 'ride' && !stay && <StayRedirect onGo={() => go('stay')} />}
    </main>
  )
}

function StayRedirect({ onGo }: { onGo: () => void }) {
  useEffect(() => { onGo() }, [onGo])
  return null
}

/* ---------- 1 · Welcome ---------- */

function WelcomeScreen({ arrival, onSkip, onNext }: { arrival: ArrivalPayload; onSkip: () => void; onNext: () => void }) {
  const { t } = useLang()
  const [busy, setBusy] = useState(false)
  const reward = arrival.reward

  const claim = async () => {
    if (!reward) return onNext()
    setBusy(true)
    if (getCurrentUser()) await apiJson('/api/welcome', { method: 'POST', body: { rewardId: reward.id } }).catch(() => {})
    else setPendingWelcome(reward.id)
    hapticRewardRedeemed()
    setBusy(false)
    onNext()
  }

  return (
    <section className="arrival-screen" style={{ position: 'relative', minHeight: '100dvh', display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 24px calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onSkip} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: '15px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', minHeight: '44px', padding: '0 4px' }}>{t('m.arrival.skip')}</button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
        <p className="arrival-rise" style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
          {arrival.place.kind === 'airport' ? t('m.arrival.landedAt', { place: arrival.place.name }) : t('m.arrival.arrivedAt', { place: arrival.place.name })}
        </p>
        <h1 className="arrival-rise-2" style={{ fontSize: '40px', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: reward ? '28px' : '0' }}>{t('m.arrival.welcome')}</h1>
        {reward && (
          <div className="arrival-rise-3">
            <GiftBox size={170} />
            <p className="section-eyebrow" style={{ color: 'var(--gold)', marginTop: '8px' }}>{t('m.arrival.yourGift')}</p>
            <p style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>{reward.name}</p>
          </div>
        )}
      </div>
      <button className="btn btn-primary" onClick={claim} disabled={busy} style={{ width: '100%', minHeight: '54px', fontSize: '17px' }}>
        {busy ? '…' : reward ? t('m.arrival.claimContinue') : t('m.partner.continue')}
      </button>
    </section>
  )
}

/* ---------- 2 · Where are you staying? ---------- */

function StayScreen({ arrival, onPick }: { arrival: ArrivalPayload; onPick: (s: ChosenStay) => void }) {
  const { t } = useLang()
  const [q, setQ] = useState('')
  const [townPick, setTownPick] = useState<string | null>(null)
  const [results, setResults] = useState<StayResult[] | null>(null)
  const [pinMode, setPinMode] = useState(false)
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null)

  // Towns in the arrival's parish plus any within an hour or so of it.
  const towns = useMemo(() => {
    const home = townFor(arrival.city)
    const parish = parishFor(arrival.city)
    return TOWNS.filter(tn => parish.towns.some(p => p.city === tn.city) || haversineKm(home, tn) <= 60)
      .sort((a, b) => haversineKm(home, a) - haversineKm(home, b))
  }, [arrival.city])

  useEffect(() => {
    let cancelled = false
    const cities = townPick ? [townPick] : towns.map(tn => tn.city)
    const timer = setTimeout(() => {
      fetch(`/api/stays?q=${encodeURIComponent(q.trim())}&city=${cities.join(',')}&limit=30`)
        .then(r => (r.ok ? r.json() : []))
        .then(d => { if (!cancelled) setResults(Array.isArray(d) ? d : []) })
        .catch(() => { if (!cancelled) setResults([]) })
    }, 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [q, townPick, towns])

  const choose = (s: StayResult) => {
    triggerHaptic('selection')
    const centre = townFor(s.city)
    onPick({ name: s.name, city: s.city, lat: s.lat ?? centre.lat, lng: s.lng ?? centre.lng, image: s.image, accommodationId: s.accommodationId, partnerCode: s.partner?.code ?? null })
  }

  const centre = townFor(townPick ?? arrival.city)

  return (
    <section style={{ position: 'relative', minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div className="arrival-sheet" style={{ background: 'var(--system-bg)', color: 'var(--label-primary)', borderRadius: '24px 24px 0 0', padding: '10px 16px calc(env(safe-area-inset-bottom, 0px) + 20px)', maxHeight: '88dvh', display: 'flex', flexDirection: 'column' }}>
        <div className="sheet-grabber" />
        <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '4px 0 12px' }}>{t('m.onb.stayTitle')}</h2>

        {pinMode ? (
          <>
            <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '10px' }}>{t('m.arrival.pinHelp')}</p>
            <div style={{ height: '46dvh', borderRadius: '16px', overflow: 'hidden', marginBottom: '12px' }}>
              <PinDropMap center={[centre.lat, centre.lng]} pin={pin} onPick={setPin} />
            </div>
            <button className="btn btn-primary" disabled={!pin} onClick={() => pin && onPick({ name: t('m.arrival.pinName'), city: nearestTown(pin).city, lat: pin.lat, lng: pin.lng, image: null, accommodationId: null, partnerCode: null })} style={{ width: '100%', marginBottom: '8px' }}>{t('m.arrival.usePin')}</button>
            <button className="btn btn-tertiary" onClick={() => setPinMode(false)} style={{ width: '100%' }}>{t('m.arrival.backToList')}</button>
          </>
        ) : (
          <>
            <label className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', minHeight: '44px', marginBottom: '10px', cursor: 'text' }}>
              <Icon name="search" size={16} style={{ color: 'var(--label-secondary)' }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('m.onb.stayPlaceholder')} aria-label={t('m.onb.stayTitle')} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', fontSize: '17px', fontFamily: 'inherit', color: 'var(--label-primary)' }} />
            </label>
            <div className="horizontal-scroll" style={{ gap: '8px', padding: '0 0 10px' }}>
              {towns.map(tn => (
                <button key={tn.city} className={`chip ${townPick === tn.city ? 'active' : ''}`} aria-pressed={townPick === tn.city} onClick={() => { triggerHaptic('selection'); setTownPick(townPick === tn.city ? null : tn.city) }} style={{ flexShrink: 0 }}>{tn.name}</button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: '160px' }}>
              {results === null ? (
                [0, 1, 2].map(i => <div key={i} className="skeleton-card" style={{ height: '64px', marginBottom: '8px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>)
              ) : results.length === 0 ? (
                <p style={{ fontSize: '14px', color: 'var(--label-secondary)', padding: '12px 0' }}>{t('m.arrival.noStays')}</p>
              ) : results.map(s => (
                <button key={`${s.partner?.code ?? ''}${s.accommodationId ?? s.name}`} onClick={() => choose(s)} className="card" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', marginBottom: '8px', border: 'none', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}>
                  <span style={{ width: '48px', height: '48px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, background: 'var(--system-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-tertiary)' }}>
                    {s.image ? <Img src={s.image} alt="" width={96} height={96} sizes="48px" /> : <Icon name="home" size={18} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                    <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>{townFor(s.city).name}</span>
                  </span>
                  {s.partner && <PartnerBadge />}
                </button>
              ))}
            </div>
            <button onClick={() => setPinMode(true)} style={{ background: 'none', border: 'none', color: 'var(--rum-text)', fontSize: '15px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', minHeight: '44px', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Icon name="mapPin" size={14} /> {t('m.arrival.dropPin')}
            </button>
          </>
        )}
      </div>
    </section>
  )
}

/* ---------- 3 · Need a ride? ---------- */

function RideScreen({ arrival, stay, errorText, onDone }: { arrival: ArrivalPayload; stay: ChosenStay; errorText: (e: unknown) => string; onDone: (ride: { vendor: string; price: number } | null) => void }) {
  const { t } = useLang()
  const router = useRouter()
  const [rides, setRides] = useState<Rides | null>(null)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/transfers?airport=${arrival.place.airport}&lat=${stay.lat}&lng=${stay.lng}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('rides'))))
      .then((d: Rides) => { setRides(d); setSelected(d.options[0]?.id ?? null) })
      .catch(() => setFailed(true))
  }, [arrival.place.airport, stay.lat, stay.lng])

  const choice = rides?.options.find(o => o.id === selected) ?? null

  const book = async () => {
    if (!choice) return
    if (!getCurrentUser()) { router.push(`/login?next=${encodeURIComponent('/arrival?step=ride')}`); return }
    setBusy(true)
    setError(null)
    try {
      const wallet = getCurrentUser()?.walletBalance ?? 0
      const result = await apiJson<{ walletBalance: number | null }>('/api/transfers/book', {
        method: 'POST',
        body: { serviceId: choice.id, lat: stay.lat, lng: stay.lng, dropoff: stay.name, partySize: 1, payWith: wallet >= choice.price ? 'wallet' : 'driver' }
      })
      const u = getCurrentUser()
      if (u && typeof result.walletBalance === 'number') setCurrentUser({ ...u, walletBalance: result.walletBalance })
      hapticBookingConfirmed()
      onDone({ vendor: choice.vendor.name, price: choice.price })
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="arrival-screen" style={{ position: 'relative', minHeight: '100dvh', display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top, 0px) + 32px) 16px 0' }}>
      <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em' }}>{t('m.arrival.rideTitle')}</h2>
      <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.8)', marginBottom: '20px' }}>
        {rides ? t('m.arrival.rideSub', { stay: stay.name, time: t('m.arrival.minutes', { n: rides.minutes }) }) : t('m.arrival.rideTo', { stay: stay.name })}
      </p>

      <div role="radiogroup" aria-label={t('m.arrival.rideTitle')} style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
        {failed ? (
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.85)' }}>{t('m.arrival.noRides')}</p>
        ) : rides === null ? (
          [0, 1, 2].map(i => <div key={i} className="skeleton-card" style={{ height: '78px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>)
        ) : rides.options.length === 0 ? (
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.85)' }}>{t('m.arrival.noRides')}</p>
        ) : rides.options.map(o => {
          const on = selected === o.id
          const photo = o.driverPhoto ?? o.vendor.image
          return (
            <button key={o.id} role="radio" aria-checked={on} onClick={() => { triggerHaptic('selection'); setSelected(o.id) }} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', border: on ? '2px solid var(--rum)' : '2px solid transparent', transform: on ? 'scale(1.01)' : 'none', transition: 'transform 0.2s ease, border-color 0.2s ease' }}>
              <span style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--rum-tint)', color: 'var(--rum-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '18px' }}>
                {photo ? <Img src={photo} alt="" width={96} height={96} sizes="48px" /> : (o.driverName ?? o.vendor.name).charAt(0)}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)' }}>{o.driverName ? `${o.driverName} · ${o.vendor.name}` : o.vendor.name}</span>
                <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>{t('m.arrival.rideMeta', { vehicle: o.vehicle, seats: o.seats, min: o.readyMinutes })}</span>
              </span>
              <Price usd={o.price} style={{ fontSize: '17px', fontWeight: 800, color: 'var(--label-primary)' }} />
              <span aria-hidden style={{ width: '22px', height: '22px', borderRadius: '50%', border: on ? '7px solid var(--rum)' : '2px solid var(--separator)', flexShrink: 0, transition: 'border 0.2s ease' }} />
            </button>
          )
        })}
        <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.85)', marginTop: '6px' }}>
          <Icon name="shield" size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} /> {t('m.arrival.trust')}
        </p>
        {error && <p role="alert" style={{ fontSize: '14px', color: '#FFB4A3' }}>{error}</p>}
      </div>

      <div style={{ position: 'sticky', bottom: 0, margin: '16px -16px 0', padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px)', background: 'var(--system-bg-elevated)', borderTop: '0.5px solid var(--separator)', display: 'flex', gap: '10px' }}>
        <button className="btn btn-secondary" onClick={() => onDone(null)} style={{ flex: 1 }}>{t('m.arrival.sorted')}</button>
        <button className="btn btn-primary" onClick={book} disabled={!choice || busy} style={{ flex: 1.4 }}>
          {busy ? '…' : choice ? <>{t('m.vendor.book')} · <Price usd={choice.price} style={{ color: 'white' }} /></> : t('m.vendor.book')}
        </button>
      </div>
    </section>
  )
}

/* ---------- 4 · Checked in ---------- */

function CheckedInScreen({ stay, townName, booked, onPlan, onExplore }: { stay: ChosenStay | null; townName: string; booked: { vendor: string; price: number } | null; onPlan: () => void; onExplore: () => void }) {
  const { t } = useLang()
  const [gift, setGift] = useState<HostGift | null>(null)

  useEffect(() => {
    const code = stay?.partnerCode
    if (!code) return
    apiJson<{ perk: { name: string; description: string; vendors: Array<{ name: string; lat: number; lng: number }> } | null }>(`/api/partners/${encodeURIComponent(code)}`)
      .then(p => p.perk && setGift({ name: p.perk.name, description: p.perk.description, vendor: p.perk.vendors[0] ?? null }))
      .catch(() => {})
    // Signed in: join the property now (records the referral, claims the perk).
    if (getCurrentUser()) {
      apiJson(`/api/partners/${encodeURIComponent(code)}`, { method: 'POST' })
        .then(() => { try { localStorage.setItem('eta_partner_claimed', code) } catch {} })
        .catch(() => {})
    }
  }, [stay?.partnerCode])

  const walkMin = gift?.vendor && stay?.lat != null && stay?.lng != null
    ? Math.max(1, Math.ceil((haversineKm({ lat: stay.lat, lng: stay.lng }, gift.vendor) * 1000 * 1.25) / 80))
    : null

  return (
    <section className="arrival-screen" style={{ position: 'relative', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', height: '42dvh', overflow: 'hidden' }}>
        {stay?.image && <Img src={stay.image} alt={stay.name} width={1080} height={800} priority />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,22,40,0.1), rgba(10,22,40,0.85))' }} />
        <div style={{ position: 'absolute', left: '20px', right: '20px', bottom: '36px' }}>
          <p className="arrival-rise" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', background: 'var(--success)', marginBottom: '10px' }}>
            <Icon name="check" size={12} /> {t('m.arrival.checkedIn')}
          </p>
          <h1 className="arrival-rise-2" style={{ fontSize: '32px', fontWeight: 800, lineHeight: 1.1 }}>{t('m.arrival.welcomeTo', { place: stay?.name ?? townName })}</h1>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', marginTop: '-20px', borderRadius: '24px 24px 0 0', background: 'var(--system-bg)', padding: '20px 16px calc(env(safe-area-inset-bottom, 0px) + 24px)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {gift && (
          <div className="card arrival-rise-2" style={{ padding: '16px', cursor: 'default', border: '1.5px solid var(--gold)', display: 'flex', gap: '14px', alignItems: 'center' }}>
            <span style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, #FFE08A, #D69A17)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="gift" size={24} style={{ color: '#8E1608' }} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="section-eyebrow" style={{ display: 'block' }}>{t('m.arrival.hostGift')}</span>
              <span style={{ display: 'block', fontSize: '17px', fontWeight: 700, color: 'var(--label-primary)' }}>{gift.name}</span>
              {gift.vendor && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--label-secondary)' }}>
                  <Icon name="mapPin" size={12} /> {walkMin ? t('m.arrival.giftWhere', { vendor: gift.vendor.name, min: walkMin }) : gift.vendor.name}
                </span>
              )}
            </span>
          </div>
        )}
        {booked && (
          <div className="card arrival-rise-2" style={{ padding: '14px 16px', cursor: 'default', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Icon name="route" size={20} style={{ color: 'var(--rum-text)' }} />
            <span style={{ flex: 1, fontSize: '15px', color: 'var(--label-primary)' }}>{t('m.arrival.rideBooked', { vendor: booked.vendor })}</span>
            <Price usd={booked.price} style={{ fontWeight: 700, color: 'var(--label-primary)' }} />
          </div>
        )}
        <p className="arrival-rise-3" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: 'var(--label-primary)', padding: '4px 2px' }}>
          <Icon name="mapPin" size={16} style={{ color: 'var(--rum-text)' }} /> {t('m.arrival.setTo', { town: townName })}
        </p>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={onPlan} style={{ width: '100%', minHeight: '54px', fontSize: '17px' }}>{t('m.arrival.planTonight')}</button>
        <button className="btn btn-secondary" onClick={onExplore} style={{ width: '100%' }}>{t('m.arrival.justExplore')}</button>
      </div>
    </section>
  )
}
