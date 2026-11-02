// app/safety/page.tsx — Safety: "I feel unsafe" (a live location link to
// your emergency contact by SMS, WhatsApp or the share sheet, plus the
// emergency numbers), nearest hospitals and clinics, police and tourist
// help, embassies, vetted transport, and sharing your booked trip.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Dock from '@/components/Dock'
import BackButton from '@/components/BackButton'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import ErrorState from '@/components/ErrorState'
import { useRegion } from '@/components/RegionProvider'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { createViewLink, fetchMyTrips, type TripView } from '@/lib/trip-client'
import { shareOrCopy } from '@/lib/share'
import { formatCity } from '@/lib/format'
import { apiJson } from '@/lib/api-client'
import { getCurrentUser, type CurrentUser } from '@/lib/auth-client'
import { useUserLocation } from '@/lib/geo'
import { triggerHaptic } from '@/lib/haptics'

interface TransportVendor { id: string; name: string; neighborhood: string; city: string; description: string; images: string[]; phone: string | null; whatsapp: string | null }
interface Contact { id: string; kind: string; name: string; phone: string | null; address: string | null; city: string | null; country: string | null; notes: string | null; km: number | null }
interface Contacts { medical: Contact[]; police: Contact[]; embassies: Contact[] }

// Jamaica's national emergency numbers.
const EMERGENCY = [
  { key: 'police', number: '119', icon: 'bell' },
  { key: 'fire', number: '110', icon: 'flame' }
] as const

const tel = (phone: string) => `tel:${phone.replace(/[^+\d]/g, '')}`

export default function SafetyPage() {
  const { t } = useLang()
  const errorText = useErrorText()
  const { city, town } = useRegion()
  const here = useUserLocation()
  const [transport, setTransport] = useState<TransportVendor[] | null>(null)
  const [contacts, setContacts] = useState<Contacts | null>(null)
  const [failed, setFailed] = useState(false)
  const [numbersOpen, setNumbersOpen] = useState(false)
  const [trips, setTrips] = useState<TripView[]>([])
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [user, setUser] = useState<CurrentUser | null>(null)
  // "I feel unsafe"
  const [unsafeOpen, setUnsafeOpen] = useState(false)
  const [live, setLive] = useState<{ token: string; url: string } | null>(null)
  const [liveState, setLiveState] = useState<'idle' | 'locating' | 'sharing' | 'noLocation'>('idle')
  const [liveError, setLiveError] = useState<string | null>(null)
  const watchRef = useRef<number | null>(null)
  const lastSent = useRef(0)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const res = await fetch(`/api/vendors?transport=1&limit=40`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setTransport(Array.isArray(data) ? data : [])
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    load()
    setUser(getCurrentUser())
    if (getCurrentUser()) {
      fetchMyTrips(['BOOKED']).then(setTrips).catch(() => {})
      apiJson<{ user: CurrentUser }>('/api/users/me').then(d => d.user && setUser(d.user)).catch(() => {})
    }
  }, [load])

  useEffect(() => {
    const q = here ? `?lat=${here.lat}&lng=${here.lng}` : ''
    fetch(`/api/safety/contacts${q}`).then(r => (r.ok ? r.json() : null)).then(d => d && setContacts(d)).catch(() => {})
  }, [here])

  // Stop updating the live link when leaving the screen.
  useEffect(() => () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current) }, [])

  const shareTrip = async (trip: TripView) => {
    const url = await createViewLink(trip.slug).catch(() => null)
    if (!url) return
    const result = await shareOrCopy({ title: trip.name, text: t('m.trip.shareText', { name: trip.name }), url })
    if (result === 'copied') { setShareMsg(t('m.events.linkCopied')); setTimeout(() => setShareMsg(null), 1800) }
  }

  // One tap: start the live link and keep it updated while this screen is open.
  const feelUnsafe = () => {
    triggerHaptic('heavy')
    setUnsafeOpen(true)
    setLiveError(null)
    if (live || !getCurrentUser()) return
    if (!navigator.geolocation) { setLiveState('noLocation'); return }
    setLiveState('locating')
    let token: string | null = null
    watchRef.current = navigator.geolocation.watchPosition(
      async p => {
        const now = Date.now()
        if (token && now - lastSent.current < 20000) return
        lastSent.current = now
        try {
          const res = await apiJson<{ token: string; url: string }>('/api/safety/share', { method: 'POST', body: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, ...(token ? { token } : {}) } })
          token = res.token
          setLive(res)
          setLiveState('sharing')
        } catch (e) {
          setLiveError(errorText(e))
        }
      },
      () => setLiveState('noLocation'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    )
  }

  const stopSharing = async () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = null
    if (live) await apiJson('/api/safety/share', { method: 'DELETE', body: { token: live.token } }).catch(() => {})
    setLive(null)
    setLiveState('idle')
  }

  const message = live ? t('m.safety.unsafeMessage', { url: live.url }) : ''
  const contactName = user?.emergencyContactName || user?.emergencyContactPhone || ''
  const phoneDigits = user?.emergencyContactPhone?.replace(/[^\d+]/g, '') ?? ''
  const local = (transport ?? []).filter(v => v.city === city)
  const elsewhere = (transport ?? []).filter(v => v.city !== city)

  const contactRow = (c: Contact) => (
    <div key={c.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', marginBottom: '8px', cursor: 'default' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{c.kind === 'EMBASSY' && c.country ? t(`m.safety.country.${c.country}` as 'm.safety.country.US') : c.name}</p>
        <p style={{ fontSize: '12px', color: 'var(--label-secondary)' }}>
          {c.kind === 'EMBASSY' ? c.name : c.address}{c.km !== null ? ` · ${t('m.safety.kmAway', { km: c.km })}` : c.city ? ` · ${formatCity(c.city)}` : ''}
        </p>
        {c.kind === 'EMBASSY' && c.address && <p style={{ fontSize: '12px', color: 'var(--label-tertiary)' }}>{c.address}</p>}
      </div>
      {c.phone && <a href={tel(c.phone)} className="chip" style={{ textDecoration: 'none', flexShrink: 0 }} aria-label={`${t('m.safety.call')} ${c.name}`}><Icon name="phone" size={14} /> {t('m.safety.call')}</a>}
    </div>
  )

  const transportRow = (v: TransportVendor) => (
    <div key={v.id} className="card" style={{ padding: '12px', marginBottom: '8px', cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {v.images[0] ? <span style={{ width: '48px', height: '48px', borderRadius: '10px', overflow: 'hidden' }}><Img src={v.images[0]} alt="" width={96} height={96} sizes="48px" /></span> : <span style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'var(--system-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-secondary)' }}><Icon name="route" size={20} /></span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--label-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>{v.name} <Icon name="check" size={14} style={{ color: 'var(--success)' }} /></p>
          <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{v.neighborhood}, {formatCity(v.city)}</p>
        </div>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--label-secondary)', margin: '8px 0', lineHeight: 1.4 }}>{v.description}</p>
      <div style={{ display: 'flex', gap: '8px' }}>
        {v.phone && <a href={tel(v.phone)} className="chip" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}><Icon name="phone" size={14} /> {t('m.vendor.call')}</a>}
        {v.whatsapp && <a href={`https://wa.me/${v.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="chip" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}><Icon name="journal" size={14} /> WhatsApp</a>}
        {!v.phone && !v.whatsapp && <span style={{ fontSize: '13px', color: 'var(--label-tertiary)' }}>{t('m.safety.noContact')}</span>}
      </div>
    </div>
  )

  const numbers = EMERGENCY.map(e => (
    <a key={e.key} href={`tel:${e.number}`} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', marginBottom: '8px', textDecoration: 'none' }}>
      <Icon name={e.icon} size={20} style={{ color: 'var(--error)' }} />
      <span style={{ flex: 1, fontSize: '16px', fontWeight: 600, color: 'var(--label-primary)' }}>{t(`m.safety.${e.key}` as 'm.safety.police')}</span>
      <span className="num-font" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--error)' }}>{e.number}</span>
    </a>
  ))

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <BackButton fallback="/profile" />
        <div className="section-heading">
          <span className="section-eyebrow">{t('m.safety.eyebrow')}</span>
          <h1 className="section-title">{t('m.safety.title')}</h1>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        <button className="btn btn-primary" onClick={feelUnsafe} style={{ width: '100%', minHeight: '56px', fontSize: '18px', marginBottom: '8px', background: 'var(--error)' }}>
          <Icon name="shield" size={20} /> {t('m.safety.unsafe')}
        </button>
        <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '12px', textAlign: 'center' }}>{t('m.safety.unsafeBody')}</p>
        <button className="btn btn-secondary" onClick={() => setNumbersOpen(true)} style={{ width: '100%', marginBottom: '16px' }}>
          <Icon name="bell" size={16} /> {t('m.safety.emergency')}
        </button>

        <section className="card" style={{ padding: '14px 16px', marginBottom: '20px', cursor: 'default' }}>
          <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '4px' }}>{t('m.trip.shareLive')}</p>
          <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '10px' }}>{t('m.safety.shareBody')}</p>
          {trips.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--label-tertiary)' }}>{t('m.safety.noTrip')}</p>
          ) : trips.map(tr => (
            <button key={tr.slug} className="btn btn-secondary" onClick={() => shareTrip(tr)} style={{ width: '100%', marginBottom: '6px' }}>
              <Icon name="share" size={16} /> {shareMsg ?? tr.name}
            </button>
          ))}
        </section>

        <div className="section-header"><div className="section-heading"><span className="section-eyebrow">{here ? t('m.safety.medicalSub') : formatCity(city)}</span><span className="section-title">{t('m.safety.medical')}</span></div></div>
        {contacts === null ? <div className="skeleton-card" style={{ height: '70px', marginBottom: '20px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div> : contacts.medical.length === 0 ? <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '20px' }}>{t('m.safety.contactsEmpty')}</p> : <div style={{ marginBottom: '20px' }}>{contacts.medical.slice(0, 4).map(contactRow)}</div>}

        <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.safety.policeTitle')}</span></div></div>
        {contacts && <div style={{ marginBottom: '20px' }}>{contacts.police.slice(0, 3).map(contactRow)}</div>}

        <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.safety.embassies')}</span></div></div>
        {contacts && <div style={{ marginBottom: '20px' }}>{contacts.embassies.map(contactRow)}</div>}

        <div className="section-header"><div className="section-heading"><span className="section-eyebrow">{t('m.safety.transportEyebrow')}</span><span className="section-title">{t('m.safety.transport')}</span></div></div>
        {failed ? <ErrorState compact onRetry={load} /> : transport === null ? (
          <div className="skeleton-card" style={{ height: '120px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
        ) : transport.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'var(--label-secondary)' }}>{t('m.safety.noTransport')}</p>
        ) : (
          <>
            {local.length === 0 && <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.safety.noneHere', { town: town.name })}</p>}
            {local.map(transportRow)}
            {elsewhere.length > 0 && <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label-secondary)', margin: '12px 0 8px' }}>{t('m.safety.elsewhere')}</p>}
            {elsewhere.map(transportRow)}
          </>
        )}
      </div>

      {/* Emergency numbers */}
      <div className={`bottom-sheet-overlay ${numbersOpen ? 'open' : ''}`} onClick={() => setNumbersOpen(false)} />
      <div className={`bottom-sheet ${numbersOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.safety.emergency')}>
        <div className="sheet-grabber" />
        <div style={{ padding: '0 20px 24px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '4px' }}>{t('m.safety.emergency')}</h3>
          <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '16px' }}>{t('m.safety.emergencyNote')}</p>
          {numbers}
          <button className="btn btn-tertiary" onClick={() => setNumbersOpen(false)} style={{ width: '100%' }}>{t('m.profile.done')}</button>
        </div>
      </div>

      {/* I feel unsafe */}
      <div className={`bottom-sheet-overlay ${unsafeOpen ? 'open' : ''}`} onClick={() => setUnsafeOpen(false)} />
      <div className={`bottom-sheet ${unsafeOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.safety.unsafe')}>
        <div className="sheet-grabber" />
        {unsafeOpen && (
          <div style={{ padding: '0 20px 24px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px', fontWeight: 700, color: 'var(--error)', marginBottom: '12px' }}><Icon name="shield" size={20} /> {t('m.safety.unsafe')}</h3>
            {numbers}
            {!user ? (
              <p style={{ fontSize: '13px', color: 'var(--label-secondary)', margin: '8px 0 12px' }}>{t('m.safety.loginForLive')} <Link href="/login?next=/safety" style={{ color: 'var(--rum-text)', fontWeight: 600 }}>{t('m.profile.login')}</Link></p>
            ) : liveState === 'noLocation' ? (
              <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', margin: '8px 0 12px' }}>{t('m.safety.locationNeeded')}</p>
            ) : !live ? (
              <p role="status" style={{ fontSize: '13px', color: 'var(--label-secondary)', margin: '8px 0 12px' }}>{t('m.safety.locating')}</p>
            ) : (
              <div className="card" style={{ padding: '12px 14px', margin: '8px 0 12px', cursor: 'default' }}>
                <p style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 700, color: 'var(--live)' }}><span className="live-dot" /> {t('m.safety.sharingLive')}</p>
                <p style={{ fontSize: '12px', color: 'var(--label-secondary)', margin: '2px 0 10px' }}>{t('m.safety.keepOpen')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {phoneDigits && <a href={`sms:${phoneDigits}?&body=${encodeURIComponent(message)}`} className="btn btn-primary" style={{ textDecoration: 'none' }}><Icon name="send" size={16} /> {t('m.safety.sendSms', { name: contactName })}</a>}
                  {phoneDigits && <a href={`https://wa.me/${phoneDigits.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ textDecoration: 'none' }}><Icon name="journal" size={16} /> {t('m.safety.sendWhatsapp', { name: contactName })}</a>}
                  <button className="btn btn-secondary" onClick={() => shareOrCopy({ title: t('m.safety.unsafe'), text: message, url: live.url })}><Icon name="share" size={16} /> {t('m.safety.shareLink')}</button>
                  {!phoneDigits && <p style={{ fontSize: '12px', color: 'var(--label-secondary)' }}>{t('m.safety.noContact')} <Link href="/profile?settings=1" style={{ color: 'var(--rum-text)', fontWeight: 600 }}>{t('m.safety.addContact')}</Link></p>}
                  <button className="btn btn-tertiary" onClick={stopSharing}>{t('m.safety.stopSharing')}</button>
                </div>
              </div>
            )}
            {liveError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{liveError}</p>}
            <button className="btn btn-tertiary" onClick={() => setUnsafeOpen(false)} style={{ width: '100%' }}>{t('m.common.close')}</button>
          </div>
        )}
      </div>
      <Dock />
    </main>
  )
}
