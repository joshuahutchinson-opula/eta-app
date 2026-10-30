// app/safety/page.tsx — Safety: emergency numbers, vetted transport (vendors
// flagged isTransport) and sharing your live trip with someone back home.
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import ErrorState from '@/components/ErrorState'
import { useRegion } from '@/components/RegionProvider'
import { useLang } from '@/lib/i18n-client'
import { fetchMyTrips, tripShareUrl, type TripView } from '@/lib/trip-client'
import { shareOrCopy } from '@/lib/share'
import { formatCity } from '@/lib/format'

interface TransportVendor {
  id: string
  name: string
  neighborhood: string
  city: string
  description: string
  images: string[]
  phone: string | null
  whatsapp: string | null
}

// Jamaica's national emergency numbers.
const EMERGENCY = [
  { key: 'police', number: '119', icon: 'bell' },
  { key: 'fire', number: '110', icon: 'flame' }
] as const

export default function SafetyPage() {
  const router = useRouter()
  const { t } = useLang()
  const { city, town } = useRegion()
  const [transport, setTransport] = useState<TransportVendor[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [trips, setTrips] = useState<TripView[]>([])
  const [shareMsg, setShareMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const res = await fetch('/api/vendors?transport=1')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setTransport(Array.isArray(data) ? data : [])
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    load()
    fetchMyTrips(['BOOKED']).then(setTrips).catch(() => {})
  }, [load])

  const shareTrip = async (trip: TripView) => {
    const result = await shareOrCopy({ title: trip.name, text: t('m.trip.shareText', { name: trip.name }), url: tripShareUrl(trip.slug) })
    if (result === 'copied') { setShareMsg(t('m.events.linkCopied')); setTimeout(() => setShareMsg(null), 1800) }
  }

  const local = (transport ?? []).filter(v => v.city === city)
  const elsewhere = (transport ?? []).filter(v => v.city !== city)

  const transportRow = (v: TransportVendor) => (
    <div key={v.id} className="card" style={{ padding: '12px', marginBottom: '8px', cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {v.images[0] ? <img src={v.images[0]} alt="" style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover' }} /> : <span style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'var(--system-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-secondary)' }}><Icon name="route" size={20} /></span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--label-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {v.name} <Icon name="check" size={14} style={{ color: 'var(--success)' }} />
          </p>
          <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{v.neighborhood}, {formatCity(v.city)}</p>
        </div>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--label-secondary)', margin: '8px 0', lineHeight: 1.4 }}>{v.description}</p>
      <div style={{ display: 'flex', gap: '8px' }}>
        {v.phone && <a href={`tel:${v.phone.replace(/[^+\d]/g, '')}`} className="chip" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}><Icon name="audio" size={14} /> {t('m.vendor.call')}</a>}
        {v.whatsapp && <a href={`https://wa.me/${v.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="chip" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}><Icon name="journal" size={14} /> WhatsApp</a>}
        {!v.phone && !v.whatsapp && <span style={{ fontSize: '13px', color: 'var(--label-tertiary)' }}>{t('m.safety.noContact')}</span>}
      </div>
    </div>
  )

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => router.back()} aria-label="Back" style={{ width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: 'var(--system-bg-elevated)', boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--label-primary)' }}>
          <Icon name="back" size={16} />
        </button>
        <div className="section-heading">
          <span className="section-eyebrow">{t('m.safety.eyebrow')}</span>
          <h1 className="section-title">{t('m.safety.title')}</h1>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        <button className="btn btn-primary" onClick={() => setSheetOpen(true)} style={{ width: '100%', marginBottom: '12px', background: 'var(--error)' }}>
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

      <div className={`bottom-sheet-overlay ${sheetOpen ? 'open' : ''}`} onClick={() => setSheetOpen(false)} />
      <div className={`bottom-sheet ${sheetOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.safety.emergency')}>
        <div className="sheet-grabber" />
        <div style={{ padding: '0 20px 24px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '4px' }}>{t('m.safety.emergency')}</h3>
          <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '16px' }}>{t('m.safety.emergencyNote')}</p>
          {EMERGENCY.map(e => (
            <a key={e.key} href={`tel:${e.number}`} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', marginBottom: '8px', textDecoration: 'none' }}>
              <Icon name={e.icon} size={20} style={{ color: 'var(--error)' }} />
              <span style={{ flex: 1, fontSize: '16px', fontWeight: 600, color: 'var(--label-primary)' }}>{t(`m.safety.${e.key}` as 'm.safety.police')}</span>
              <span className="num-font" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--error)' }}>{e.number}</span>
            </a>
          ))}
          <button className="btn btn-tertiary" onClick={() => setSheetOpen(false)} style={{ width: '100%' }}>{t('m.profile.done')}</button>
        </div>
      </div>
      <Dock />
    </main>
  )
}
