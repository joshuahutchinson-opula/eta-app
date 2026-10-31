// app/onboarding/page.tsx — first run: welcome, pick a vibe, then explain
// why ETA wants location and notifications before the browser asks (each
// with "Not now"), and a skippable "How points work".
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { useLang, usePatois } from '@/lib/i18n-client'
import { useRegion } from '@/components/RegionProvider'
import { VIBES } from '@/lib/vibes'
import { enableAlerts, pushSupported } from '@/lib/alerts-client'
import { CHECKIN_POINTS, DISCOVERY_POINTS } from '@/lib/checkins'
import { GEM_DISCOVERY_POINTS } from '@/lib/hidden-gems'
import { REFERRAL_POINTS } from '@/lib/points'
import { triggerHaptic } from '@/lib/haptics'

type Step = 'welcome' | 'vibe' | 'location' | 'notifications' | 'points'
const STEPS: Step[] = ['welcome', 'vibe', 'location', 'notifications', 'points']

const IMAGES: Record<Step, string> = {
  welcome: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
  vibe: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800',
  location: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
  notifications: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800',
  points: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800'
}

export default function OnboardingPage() {
  const patois = usePatois()
  const router = useRouter()
  const { t } = useLang()
  const { town, locateMe } = useRegion()
  const [index, setIndex] = useState(0)
  const [vibe, setVibe] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const step = STEPS[index]

  // Skip asks the browser has already answered.
  useEffect(() => {
    if (step === 'notifications' && typeof Notification !== 'undefined' && Notification.permission !== 'default') setIndex(i => i + 1)
    if (step === 'location') {
      const perms = (navigator as Navigator & { permissions?: Permissions }).permissions
      perms?.query({ name: 'geolocation' as PermissionName }).then(s => { if (s.state !== 'prompt') setIndex(i => (STEPS[i] === 'location' ? i + 1 : i)) }).catch(() => {})
    }
  }, [step])

  const finish = () => {
    try { localStorage.setItem('eta_vibe', vibe) } catch {}
    router.push('/')
  }

  const next = () => {
    setNote(null)
    triggerHaptic('light')
    if (index >= STEPS.length - 1) finish()
    else setIndex(index + 1)
  }

  const askLocation = async () => {
    setBusy(true)
    try {
      await locateMe()
    } catch {
      setNote(t('m.onb.denied'))
    } finally {
      setBusy(false)
      setTimeout(next, 400)
    }
  }

  const askNotifications = async () => {
    setBusy(true)
    try {
      if (!pushSupported()) throw new Error(t('m.profile.pushIphone'))
      await enableAlerts({ liveAlerts: true, dealAlerts: true })
      next()
    } catch (e) {
      setNote(e instanceof Error && e.message ? e.message : t('m.onb.denied'))
    } finally {
      setBusy(false)
    }
  }

  const title = step === 'welcome' ? t('m.onboarding.welcome', { town: town.name })
    : step === 'vibe' ? t('m.onb.vibeTitle')
    : step === 'location' ? t('m.onb.locTitle')
    : step === 'notifications' ? t('m.onb.notifTitle')
    : t('m.onb.pointsTitle')
  const text = step === 'welcome' ? t('m.onb.welcomeText')
    : step === 'vibe' ? t('m.onb.vibeText')
    : step === 'location' ? t('m.onb.locText')
    : step === 'notifications' ? t('m.onb.notifText')
    : t('m.onb.pointsText')

  const pointsRows: Array<{ icon: string; label: string; pts: string | null }> = [
    { icon: 'check', label: t('m.onb.pCheckin'), pts: t('m.onb.pts', { n: CHECKIN_POINTS }) },
    { icon: 'sparkle', label: t('m.onb.pDiscover'), pts: t('m.onb.pts', { n: `${DISCOVERY_POINTS.photospot}–${Math.max(DISCOVERY_POINTS.vendor, GEM_DISCOVERY_POINTS)}` }) },
    { icon: 'ticket', label: t('m.onb.pBook'), pts: null },
    { icon: 'users', label: t('m.onb.pRefer'), pts: t('m.onb.pts', { n: REFERRAL_POINTS }) },
    { icon: 'gift', label: t('m.onb.pRedeem'), pts: null }
  ]

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${IMAGES[step]})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(15,14,12,0.3), rgba(15,14,12,0.95))' }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: '100vh', padding: '24px 24px 48px' }}>
        {(step === 'location' || step === 'notifications') && (
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--rum)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', marginBottom: '16px' }}>
            <Icon name={step === 'location' ? 'mapPin' : 'bell'} size={26} />
          </div>
        )}
        <h1 style={{ fontSize: '34px', fontWeight: 800, marginBottom: '12px', color: 'white' }}>{title}</h1>
        <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.85)', marginBottom: '24px', lineHeight: 1.45 }}>{text}</p>

        {step === 'vibe' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
            {VIBES.map(v => (
              <button key={v} onClick={() => setVibe(v)} aria-pressed={vibe === v} style={{ padding: '18px', background: vibe === v ? 'var(--rum)' : 'rgba(26,24,21,0.8)', border: vibe === v ? 'none' : '1px solid rgba(255,255,255,0.2)', borderRadius: '20px', cursor: 'pointer', color: 'white', fontFamily: 'inherit', fontSize: '14px', fontWeight: 600 }}>
                {v}
              </button>
            ))}
          </div>
        )}

        {step === 'points' && (
          <div style={{ background: 'rgba(26,24,21,0.8)', borderRadius: '20px', padding: '8px 16px', marginBottom: '24px' }}>
            {pointsRows.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < pointsRows.length - 1 ? '0.5px solid rgba(255,255,255,0.12)' : 'none' }}>
                <Icon name={r.icon} size={18} style={{ color: 'var(--gold)' }} />
                <span style={{ flex: 1, fontSize: '15px', color: 'white' }}>{r.label}</span>
                {r.pts && <span className="num-font" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gold)' }}>{r.pts}</span>}
              </div>
            ))}
          </div>
        )}

        {note && <p role="status" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginBottom: '12px' }}>{note}</p>}

        {step === 'location' ? (
          <>
            <button className="btn btn-primary" onClick={askLocation} disabled={busy}>{t('m.onb.allowLoc')}</button>
            <button className="btn btn-secondary" style={{ marginTop: '10px' }} onClick={next}>{t('m.onb.notNow')}</button>
          </>
        ) : step === 'notifications' ? (
          <>
            <button className="btn btn-primary" onClick={askNotifications} disabled={busy}>{t('m.onb.allowNotif')}</button>
            <button className="btn btn-secondary" style={{ marginTop: '10px' }} onClick={next}>{note ? patois.ctaPrimary : t('m.onb.notNow')}</button>
          </>
        ) : (
          <>
            <button className="btn btn-primary" onClick={next}>{step === 'vibe' ? patois.ctaVibe : patois.ctaPrimary}</button>
            {index > 0 && <button className="btn btn-secondary" style={{ marginTop: '10px' }} onClick={step === 'points' ? finish : next}>{patois.ctaSkip}</button>}
          </>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ width: i === index ? '24px' : '8px', height: '4px', borderRadius: '999px', background: i === index ? 'var(--rum)' : 'rgba(255,255,255,0.3)', transition: 'all 0.3s' }} />
          ))}
        </div>
      </div>
    </main>
  )
}
