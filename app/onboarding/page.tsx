// app/onboarding/page.tsx — the first questions, a tap each (lib/stage.ts):
//   "Visiting or live here?"
//     Live here → which town → Local
//     Visiting  → "Got a trip planned?"
//        Yes     → dates + town → where you're staying (optional, a partner
//                  code works too) → vibe → Countdown (or, when the dates
//                  include today and the phone is in Jamaica, Arrival)
//        Not yet → a town to browse (Negril first) → vibe → Browsing
// Nothing here needs an account: the answers stay on the device and move
// onto the account at sign-up (lib/stage-client.ts). Location and
// notifications are asked for later, when first needed.
// ?step=dates jumps straight to planning a trip.
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { useErrorText, useLang, usePatois } from '@/lib/i18n-client'
import { useRegion } from '@/components/RegionProvider'
import { VIBES } from '@/lib/vibes'
import { saveTrip } from '@/lib/trip-mode'
import { addDays, jamaicaDayKey } from '@/lib/trip-dates'
import { markOnboarded } from '@/lib/onboarding'
import { townFor, type CityCode } from '@/lib/regions'
import { apiJson } from '@/lib/api-client'
import { arrivalDone } from '@/lib/arrival-client'
import { addTrip, setTravelerType } from '@/lib/stage-client'
import { startTrip } from '@/lib/stage-actions'
import { inJamaica } from '@/lib/places-geo'
import { triggerHaptic } from '@/lib/haptics'
import type { StayResult } from '@/lib/stays'

type Step = 'who' | 'town' | 'planned' | 'dates' | 'stay' | 'vibe' | 'browse'

const IMAGES: Record<Step, string> = {
  who: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
  town: 'https://images.unsplash.com/photo-1580237541049-2d715a09486e?w=800',
  planned: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800',
  dates: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
  stay: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800',
  vibe: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
  browse: 'https://images.unsplash.com/photo-1580237541049-2d715a09486e?w=800'
}

/** The towns most visitors stay in, first. */
const POPULAR_TOWNS: CityCode[] = ['NEGRIL', 'MONTEGO_BAY', 'OCHO_RIOS', 'KINGSTON', 'PORT_ANTONIO', 'TREASURE_BEACH', 'RUNAWAY_BAY', 'FALMOUTH']
const VIBE_ICON: Record<string, string> = { Party: 'party', Chill: 'spa', Adventure: 'wave', Romance: 'heart' }

const fieldStyle: React.CSSProperties = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(26,24,21,0.8)', color: 'white', fontSize: '16px', fontFamily: 'inherit', colorScheme: 'dark' }
const choiceStyle: React.CSSProperties = { width: '100%', padding: '18px', marginBottom: '10px', background: 'rgba(26,24,21,0.8)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: '18px', cursor: 'pointer', color: 'white', fontFamily: 'inherit', fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }

function position(): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { timeout: 8000, maximumAge: 300000 })
  })
}

export default function OnboardingPage() {
  const patois = usePatois()
  const router = useRouter()
  const { t } = useLang()
  const errorText = useErrorText()
  const { setCity } = useRegion()
  const [path, setPath] = useState<Step[]>(['who'])
  const today = jamaicaDayKey()
  const [town, setTown] = useState<CityCode>('NEGRIL')
  const [dates, setDates] = useState({ start: addDays(today, 14), end: addDays(today, 21) })
  const [q, setQ] = useState('')
  const [stays, setStays] = useState<StayResult[]>([])
  const [stay, setStay] = useState<StayResult | null>(null)
  const [code, setCode] = useState('')
  const [codeState, setCodeState] = useState<{ busy: boolean; ok: string | null; error: string | null }>({ busy: false, ok: null, error: null })
  const [planned, setPlanned] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const step = path[path.length - 1]

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('step') === 'dates') { setPlanned(true); setPath(['who', 'planned', 'dates']) }
  }, [])

  useEffect(() => {
    if (step !== 'stay' || q.trim().length < 2) { setStays([]); return }
    let cancelled = false
    const timer = setTimeout(() => {
      fetch(`/api/stays?q=${encodeURIComponent(q.trim())}&city=${town}&limit=6`).then(r => (r.ok ? r.json() : [])).then(d => { if (!cancelled) setStays(Array.isArray(d) ? d : []) }).catch(() => {})
    }, 220)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [q, town, step])

  const go = (next: Step) => { triggerHaptic('light'); setError(null); setPath(p => [...p, next]) }
  const back = () => { triggerHaptic('light'); setPath(p => (p.length > 1 ? p.slice(0, -1) : p)) }

  const checkCode = async () => {
    setCodeState({ busy: true, ok: null, error: null })
    try {
      const p = await apiJson<{ code: string; name: string; city: string; perk: { name: string } | null }>(`/api/partners/${encodeURIComponent(code.trim())}`)
      setStay({ name: p.name, city: p.city, lat: null, lng: null, image: null, accommodationId: null, partner: { code: p.code } } as unknown as StayResult)
      setTown(p.city as CityCode)
      await saveTrip({ partnerCode: p.code })
      setCodeState({ busy: false, ok: p.perk ? t('m.partner.perkWaiting', { name: p.name, perk: p.perk.name }) : t('m.partner.linked', { name: p.name }), error: null })
    } catch (e) {
      setCodeState({ busy: false, ok: null, error: errorText(e) })
    }
  }

  const finish = async (vibe: string | null) => {
    triggerHaptic('medium')
    try { if (vibe) localStorage.setItem('eta_vibe', vibe) } catch {}
    setBusy(true)
    setError(null)
    try {
      setCity(town)
      if (!planned) {
        await setTravelerType('VISITOR')
        markOnboarded()
        router.push('/')
        return
      }
      const trip = await addTrip({
        city: (stay?.city as CityCode | undefined) ?? town, start: dates.start, end: dates.end < dates.start ? dates.start : dates.end,
        ...(stay ? { stayName: stay.name, stayCity: stay.city as CityCode, stayAccommodationId: stay.accommodationId ?? null, stayLat: stay.lat ?? null, stayLng: stay.lng ?? null } : {})
      })
      markOnboarded()
      // Dates include today and they're in Jamaica: straight into the arrival.
      if (dates.start <= today && dates.end >= today) {
        const pos = await position()
        if (pos && inJamaica(pos) && !arrivalDone()) { router.push(await startTrip(trip)); return }
      }
      router.push('/')
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const liveHere = async (c: CityCode) => {
    setBusy(true)
    setCity(c)
    await setTravelerType('LOCAL').catch(() => {})
    markOnboarded()
    triggerHaptic('medium')
    router.push('/')
  }

  const titles: Record<Step, [string, string]> = {
    who: [t('m.onb2.whoTitle'), t('m.onb2.whoText')],
    town: [t('m.onb2.townTitle'), t('m.onb2.townText')],
    planned: [t('m.onb2.plannedTitle'), t('m.onb2.plannedText')],
    dates: [t('m.onb.datesTitle'), t('m.onb.datesText')],
    stay: [t('m.onb.stayTitle'), t('m.onb2.stayText')],
    vibe: [t('m.onb.vibeTitle'), t('m.onb.vibeText')],
    browse: [t('m.onb2.browseTitle'), t('m.onb2.browseText')]
  }
  const nights = Math.max(0, Math.round((Date.parse(dates.end) - Date.parse(dates.start)) / 86400000))
  const townChips = (onPick: (c: CityCode) => void, selected: CityCode | null) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
      {POPULAR_TOWNS.map(c => (
        <button key={c} onClick={() => { triggerHaptic('selection'); onPick(c) }} disabled={busy} aria-pressed={selected === c} style={{ padding: '10px 14px', borderRadius: '999px', border: selected === c ? 'none' : '1px solid rgba(255,255,255,0.25)', background: selected === c ? 'var(--rum)' : 'rgba(26,24,21,0.8)', color: 'white', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
          {townFor(c).name}
        </button>
      ))}
    </div>
  )

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${IMAGES[step]})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(15,14,12,0.3), rgba(15,14,12,0.95))' }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: '100vh', padding: '24px 24px 40px' }}>
        {path.length > 1 && (
          <button onClick={back} aria-label={t('m.common.back')} style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 16px)', left: '16px', width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.18)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="chevronLeft" size={20} />
          </button>
        )}
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '10px', color: 'white', lineHeight: 1.1 }}>{titles[step][0]}</h1>
        <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.85)', marginBottom: '20px', lineHeight: 1.45 }}>{titles[step][1]}</p>

        {step === 'who' && (
          <>
            <button style={choiceStyle} onClick={() => go('planned')}><Icon name="plane" size={22} style={{ color: 'var(--gold)' }} /> {t('m.onb2.visiting')}</button>
            <button style={choiceStyle} onClick={() => go('town')}><Icon name="home" size={22} style={{ color: 'var(--gold)' }} /> {t('m.onb2.liveHere')}</button>
          </>
        )}

        {step === 'town' && townChips(c => liveHere(c), null)}

        {step === 'planned' && (
          <>
            <button style={choiceStyle} onClick={() => { setPlanned(true); go('dates') }}><Icon name="calendar" size={22} style={{ color: 'var(--gold)' }} /> {t('m.onb2.plannedYes')}</button>
            <button style={choiceStyle} onClick={() => { setPlanned(false); go('browse') }}><Icon name="compass" size={22} style={{ color: 'var(--gold)' }} /> {t('m.onb2.plannedNo')}</button>
          </>
        )}

        {step === 'dates' && (
          <>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>{t('m.onb2.whichTown')}</p>
            {townChips(setTown, town)}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                {t('m.onb.arrive')}
                <input type="date" value={dates.start} onChange={e => setDates(d => ({ start: e.target.value, end: d.end < e.target.value ? e.target.value : d.end }))} style={{ ...fieldStyle, marginTop: '6px' }} />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                {t('m.onb.leave')}
                <input type="date" value={dates.end} min={dates.start} onChange={e => setDates(d => ({ ...d, end: e.target.value }))} style={{ ...fieldStyle, marginTop: '6px' }} />
              </label>
            </div>
            <p className="num-font" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '20px' }}>{t('m.onb.nights', { n: nights + 1 })}</p>
            <button className="btn btn-primary" onClick={() => go(arrivalDone() ? 'vibe' : 'stay')} disabled={!dates.start || !dates.end}>{patois.ctaPrimary}</button>
          </>
        )}

        {step === 'stay' && (
          <>
            {stay ? (
              <p style={{ ...fieldStyle, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Icon name="home" size={16} /> <span style={{ flex: 1 }}>{stay.name}</span>
                <button onClick={() => setStay(null)} aria-label={t('m.plan.clearStay')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><Icon name="close" size={14} /></button>
              </p>
            ) : (
              <>
                <input value={q} maxLength={120} onChange={e => setQ(e.target.value)} placeholder={t('m.onb.stayPlaceholder')} aria-label={t('m.onb.stayTitle')} style={{ ...fieldStyle, marginBottom: '8px' }} />
                {stays.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                    {stays.map(s => <button key={`${s.accommodationId ?? s.name}`} onClick={() => { triggerHaptic('selection'); setStay(s); setTown(s.city as CityCode) }} style={{ ...fieldStyle, textAlign: 'left', cursor: 'pointer' }}>{s.name} · {townFor(s.city).name}</button>)}
                  </div>
                )}
                {q.trim().length >= 2 && stays.length === 0 && (
                  <button className="btn btn-secondary" style={{ marginBottom: '10px' }} onClick={() => setStay({ name: q.trim(), city: town, lat: null, lng: null, image: null, accommodationId: null, partner: null } as unknown as StayResult)}>{t('m.plan.useTyped', { name: q.trim() })}</button>
                )}
                <form onSubmit={e => { e.preventDefault(); if (code.trim().length >= 3) checkCode() }} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                  <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder={t('m.onb.partnerCode')} aria-label={t('m.onb.partnerCode')} autoCapitalize="characters" autoComplete="off" className="num-font" style={{ ...fieldStyle, flex: 1, minWidth: 0, letterSpacing: '0.06em' }} />
                  <button type="submit" className="btn btn-secondary" disabled={codeState.busy || code.trim().length < 3} style={{ padding: '0 16px' }}>{codeState.busy ? '…' : t('m.partner.apply')}</button>
                </form>
                {codeState.ok && <p role="status" style={{ fontSize: '13px', color: '#7CE38B', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><Icon name="check" size={14} /> {codeState.ok}</p>}
                {codeState.error && <p role="alert" style={{ fontSize: '13px', color: '#FF8A80', marginBottom: '8px' }}>{codeState.error}</p>}
              </>
            )}
            <button className="btn btn-primary" style={{ marginTop: '10px' }} onClick={() => go('vibe')}>{stay ? patois.ctaPrimary : t('m.plan.addLater')}</button>
          </>
        )}

        {step === 'browse' && (
          <>
            {townChips(setTown, town)}
            <button className="btn btn-primary" onClick={() => go('vibe')}>{patois.ctaPrimary}</button>
          </>
        )}

        {step === 'vibe' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              {VIBES.map(v => (
                <button key={v} onClick={() => finish(v)} disabled={busy} style={{ padding: '22px 14px', background: 'rgba(26,24,21,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '20px', cursor: 'pointer', color: 'white', fontFamily: 'inherit', fontSize: '16px', fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <Icon name={VIBE_ICON[v] ?? 'sparkle'} size={24} style={{ color: 'var(--gold)' }} />
                  {v}
                </button>
              ))}
            </div>
            <button className="btn btn-secondary" onClick={() => finish(null)} disabled={busy}>{patois.ctaSkip}</button>
          </>
        )}

        {error && <p role="alert" style={{ fontSize: '14px', color: '#FF8A80', marginTop: '10px' }}>{error}</p>}
      </div>
    </main>
  )
}
