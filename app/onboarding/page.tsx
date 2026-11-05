// app/onboarding/page.tsx — three taps: your travel dates (turns on trip
// mode), where you're staying (sets the region; a hotel or villa partner
// code works here too), and your vibe. Location and notifications are asked
// for later, when they're first needed. ?step=dates starts a new trip.
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { useErrorText, useLang, usePatois } from '@/lib/i18n-client'
import { useRegion } from '@/components/RegionProvider'
import { VIBES } from '@/lib/vibes'
import { saveTrip, readTrip } from '@/lib/trip-mode'
import { addDays, jamaicaDayKey } from '@/lib/trip-dates'
import { markOnboarded } from '@/lib/onboarding'
import { isCityCode, townFor, type CityCode } from '@/lib/regions'
import { apiJson } from '@/lib/api-client'
import { arrivalDone } from '@/lib/arrival-client'
import { triggerHaptic } from '@/lib/haptics'

type Step = 'dates' | 'stay' | 'vibe'
const STEPS: Step[] = ['dates', 'stay', 'vibe']

const IMAGES: Record<Step, string> = {
  dates: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
  stay: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800',
  vibe: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800'
}

/** The towns most visitors stay in, first; the rest are behind "Somewhere else". */
const POPULAR_TOWNS: CityCode[] = ['NEGRIL', 'MONTEGO_BAY', 'OCHO_RIOS', 'KINGSTON', 'PORT_ANTONIO', 'TREASURE_BEACH', 'RUNAWAY_BAY', 'FALMOUTH']

const VIBE_ICON: Record<string, string> = { Party: 'party', Chill: 'spa', Adventure: 'wave', Romance: 'heart' }

const fieldStyle: React.CSSProperties = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(26,24,21,0.8)', color: 'white', fontSize: '16px', fontFamily: 'inherit', colorScheme: 'dark' }

export default function OnboardingPage() {
  const patois = usePatois()
  const router = useRouter()
  const { t } = useLang()
  const errorText = useErrorText()
  const { city, setCity } = useRegion()
  const [index, setIndex] = useState(0)
  const today = jamaicaDayKey()
  const [dates, setDates] = useState({ start: today, end: addDays(today, 6) })
  const [stay, setStay] = useState<{ name: string; city: CityCode | null }>({ name: '', city: null })
  const [code, setCode] = useState('')
  const [codeState, setCodeState] = useState<{ busy: boolean; ok: string | null; error: string | null }>({ busy: false, ok: null, error: null })
  const [busy, setBusy] = useState(false)
  const step = STEPS[index]

  useEffect(() => {
    const saved = readTrip()
    const fresh = new URLSearchParams(window.location.search).get('step') === 'dates'
    if (saved.start && saved.end && !fresh) setDates({ start: saved.start, end: saved.end })
    setStay({ name: saved.stayName ?? '', city: isCityCode(saved.stayCity) ? saved.stayCity : null })
  }, [])

  // The arrival flow already asked where they're staying.
  const next = () => {
    triggerHaptic('light')
    setIndex(i => {
      const n = Math.min(STEPS.length - 1, i + 1)
      return STEPS[n] === 'stay' && arrivalDone() ? n + 1 : n
    })
  }

  const saveDates = async (skip = false) => {
    setBusy(true)
    try { if (!skip) await saveTrip({ start: dates.start, end: dates.end < dates.start ? dates.start : dates.end }) } finally { setBusy(false) }
    next()
  }

  // A partner code fills in the stay and town; the perk is claimed once signed in (components/AccountSync).
  const checkCode = async () => {
    setCodeState({ busy: true, ok: null, error: null })
    try {
      const p = await apiJson<{ code: string; name: string; city: string; perk: { name: string } | null }>(`/api/partners/${encodeURIComponent(code.trim())}`)
      if (isCityCode(p.city)) setStay({ name: p.name, city: p.city })
      await saveTrip({ partnerCode: p.code })
      setCodeState({ busy: false, ok: p.perk ? t('m.partner.perkWaiting', { name: p.name, perk: p.perk.name }) : t('m.partner.linked', { name: p.name }), error: null })
    } catch (e) {
      setCodeState({ busy: false, ok: null, error: errorText(e) })
    }
  }

  const saveStay = async (pick: CityCode | null = stay.city) => {
    setBusy(true)
    try {
      if (pick) setCity(pick)
      await saveTrip({ stayName: stay.name.trim() || null, stayCity: pick ?? city })
    } finally {
      setBusy(false)
    }
    next()
  }

  const finish = (vibe: string | null) => {
    triggerHaptic('medium')
    try { if (vibe) localStorage.setItem('eta_vibe', vibe) } catch {}
    markOnboarded()
    router.push('/')
  }

  const title = step === 'dates' ? t('m.onb.datesTitle') : step === 'stay' ? t('m.onb.stayTitle') : t('m.onb.vibeTitle')
  const text = step === 'dates' ? t('m.onb.datesText') : step === 'stay' ? t('m.onb.stayText') : t('m.onb.vibeText')
  const nights = Math.max(0, Math.round((Date.parse(dates.end) - Date.parse(dates.start)) / 86400000))

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${IMAGES[step]})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(15,14,12,0.3), rgba(15,14,12,0.95))' }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: '100vh', padding: '24px 24px 40px' }}>
        <p className="num-font" style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>{t('m.onb.stepOf', { n: index + 1, total: STEPS.length })}</p>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '10px', color: 'white', lineHeight: 1.1 }}>{title}</h1>
        <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.85)', marginBottom: '20px', lineHeight: 1.45 }}>{text}</p>

        {step === 'dates' && (
          <>
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
            <button className="btn btn-primary" onClick={() => saveDates()} disabled={busy || !dates.start || !dates.end}>{patois.ctaPrimary}</button>
            <button className="btn btn-secondary" style={{ marginTop: '10px' }} onClick={() => saveDates(true)}>{t('m.onb.noDates')}</button>
          </>
        )}

        {step === 'stay' && (
          <>
            <input value={stay.name} maxLength={120} onChange={e => setStay(s => ({ ...s, name: e.target.value }))} placeholder={t('m.onb.stayPlaceholder')} aria-label={t('m.onb.stayTitle')} style={{ ...fieldStyle, marginBottom: '12px' }} />
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>{t('m.onb.stayTown')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {POPULAR_TOWNS.map(c => (
                <button key={c} onClick={() => { triggerHaptic('selection'); setStay(s => ({ ...s, city: c })); saveStay(c) }} disabled={busy} aria-pressed={stay.city === c} style={{ padding: '10px 14px', borderRadius: '999px', border: stay.city === c ? 'none' : '1px solid rgba(255,255,255,0.25)', background: stay.city === c ? 'var(--rum)' : 'rgba(26,24,21,0.8)', color: 'white', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                  {townFor(c).name}
                </button>
              ))}
            </div>
            <form onSubmit={e => { e.preventDefault(); if (code.trim().length >= 3) checkCode() }} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder={t('m.onb.partnerCode')} aria-label={t('m.onb.partnerCode')} autoCapitalize="characters" autoComplete="off" className="num-font" style={{ ...fieldStyle, flex: 1, minWidth: 0, letterSpacing: '0.06em' }} />
              <button type="submit" className="btn btn-secondary" disabled={codeState.busy || code.trim().length < 3} style={{ padding: '0 16px' }}>{codeState.busy ? '…' : t('m.partner.apply')}</button>
            </form>
            {codeState.ok && <p role="status" style={{ fontSize: '13px', color: '#7CE38B', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><Icon name="check" size={14} /> {codeState.ok}</p>}
            {codeState.error && <p role="alert" style={{ fontSize: '13px', color: '#FF8A80', marginBottom: '8px' }}>{codeState.error}</p>}
            {codeState.ok && <button className="btn btn-primary" style={{ marginTop: '10px' }} onClick={() => saveStay()} disabled={busy}>{patois.ctaPrimary}</button>}
            <button className="btn btn-secondary" style={{ marginTop: '10px' }} onClick={next}>{patois.ctaSkip}</button>
          </>
        )}

        {step === 'vibe' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              {VIBES.map(v => (
                <button key={v} onClick={() => finish(v)} style={{ padding: '22px 14px', background: 'rgba(26,24,21,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '20px', cursor: 'pointer', color: 'white', fontFamily: 'inherit', fontSize: '16px', fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <Icon name={VIBE_ICON[v] ?? 'sparkle'} size={24} style={{ color: 'var(--gold)' }} />
                  {v}
                </button>
              ))}
            </div>
            <button className="btn btn-secondary" onClick={() => finish(null)}>{patois.ctaSkip}</button>
          </>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ width: i === index ? '24px' : '8px', height: '4px', borderRadius: '999px', background: i <= index ? 'var(--rum)' : 'rgba(255,255,255,0.3)', transition: 'all 0.3s' }} />
          ))}
        </div>
      </div>
    </main>
  )
}
