// app/accommodations/[id]/page.tsx — a stay listing: photos, the basics,
// amenities and room views, the ETA Partner badge, and how to book directly
// with the property (website, call, WhatsApp, email). ETA doesn't sell stays
// and takes nothing from them; bookings made before this live on in My
// Bookings as history.
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Icon from '@/lib/icons'
import Price from '@/components/Price'
import ErrorState from '@/components/ErrorState'
import PartnerBadge from '@/components/PartnerBadge'
import { useLang } from '@/lib/i18n-client'
import { formatCity } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import BackButton from '@/components/BackButton'
import Img from '@/components/Img'
import { directionsUrl } from '@/lib/calendar'
import { triggerHaptic } from '@/lib/haptics'

interface Accommodation {
  id: string
  name: string
  type: string
  googleStars: number
  description: string
  amenities: string[]
  priceRange: string
  city: string
  lat: number
  lng: number
  media: Array<{ type: string; url: string }>
  roomViews: string[]
  nightlyPrice: number | null
  maxGuests: number | null
  bookingUrl: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  partner: { code: string; name: string } | null
}

export default function AccommodationDetailPage() {
  const params = useParams()
  const { t } = useLang()
  const labels = useLabels()
  const [accom, setAccom] = useState<Accommodation | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notFound' | 'error'>('loading')
  const [slide, setSlide] = useState(0)

  const load = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch(`/api/accommodations/${params.id}`)
      if (res.status === 404) return setState('notFound')
      if (!res.ok) throw new Error()
      setAccom(await res.json())
      setState('ready')
    } catch {
      setState('error')
    }
  }, [params.id])

  useEffect(() => { load() }, [load])

  const backButton = <BackButton floating fallback="/marketplace" />

  if (state === 'loading') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)' }}>
        <div className="skeleton-card" style={{ height: '320px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
      </main>
    )
  }
  if (state !== 'ready' || !accom) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', position: 'relative' }}>
        {backButton}
        {state === 'error' ? <ErrorState onRetry={load} /> : <div className="empty-state"><p style={{ fontSize: '17px', fontWeight: 600 }}>{t('m.err.notFound')}</p></div>}
      </main>
    )
  }

  const photos = (accom.media ?? []).filter(m => m?.url && m.type !== 'video').map(m => m.url)
  const wa = accom.whatsapp ? `https://wa.me/${accom.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(t('m.stay.waText', { name: accom.name }))}` : null
  const contacts = [
    accom.bookingUrl && { key: 'web', icon: 'globe', label: t('m.stay.bookDirect'), href: accom.bookingUrl, primary: true },
    accom.phone && { key: 'call', icon: 'phone', label: t('m.vendor.call'), href: `tel:${accom.phone.replace(/[^+\d]/g, '')}` },
    wa && { key: 'wa', icon: 'send', label: 'WhatsApp', href: wa },
    accom.email && { key: 'mail', icon: 'journal', label: t('m.stay.email'), href: `mailto:${accom.email}?subject=${encodeURIComponent(t('m.stay.mailSubject', { name: accom.name }))}` }
  ].filter(Boolean) as Array<{ key: string; icon: string; label: string; href: string; primary?: boolean }>
  const directions = directionsUrl({ lat: accom.lat, lng: accom.lng, name: accom.name })

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', position: 'relative', paddingBottom: '40px' }}>
      {backButton}
      <div style={{ position: 'relative', height: '320px', background: 'var(--system-bg-secondary)' }}>
        <div onScroll={e => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))} style={{ display: 'flex', height: '100%', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
          {photos.map((src, i) => (
            <div key={src} style={{ flex: '0 0 100%', height: '100%', scrollSnapAlign: 'start' }}>
              <Img src={src} alt={accom.name} width={1200} height={800} priority={i === 0} />
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(15,14,12,0.9))', pointerEvents: 'none' }} />
        {photos.length > 1 && <span style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 20px)', right: '16px', padding: '4px 10px', borderRadius: '999px', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '12px', fontWeight: 700 }}>{slide + 1} / {photos.length}</span>}
        <div style={{ position: 'absolute', bottom: '14px', left: '16px', right: '16px', color: 'white', pointerEvents: 'none' }}>
          {accom.partner && <div style={{ marginBottom: '8px' }}><PartnerBadge /></div>}
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>{accom.name}</h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>★ {accom.googleStars} · {labels.stayType(accom.type)} · {formatCity(accom.city)}</p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Book direct */}
        <section className="card" style={{ padding: '16px', cursor: 'default', marginBottom: '20px' }} aria-labelledby="book-direct">
          <h2 id="book-direct" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '2px' }}>{t('m.stay.bookDirectTitle')}</h2>
          <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '12px' }}>
            {accom.nightlyPrice != null ? <><Price usd={accom.nightlyPrice} style={{ fontWeight: 700, color: 'var(--rum-text)' }} /> {t('m.stay.perNightGuide')} · </> : null}
            {t('m.stay.noFees')}
          </p>
          {contacts.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {contacts.map(c => (
                <a key={c.key} href={c.href} target={c.key === 'web' || c.key === 'wa' ? '_blank' : undefined} rel="noopener noreferrer" onClick={() => triggerHaptic('light')} className={c.primary ? 'btn btn-primary' : 'chip'} style={{ textDecoration: 'none', ...(c.primary ? { width: '100%' } : { flex: 1, justifyContent: 'center' }) }}>
                  <Icon name={c.icon} size={c.primary ? 16 : 14} /> {c.label}
                </a>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '14px', color: 'var(--label-secondary)' }}>{t('m.stay.noContact')}</p>
          )}
          {directions && <a href={directions} target="_blank" rel="noopener noreferrer" className="btn btn-tertiary" style={{ width: '100%', marginTop: '8px', textDecoration: 'none' }}><Icon name="navigate" size={16} /> {t('m.nav.directions')}</a>}
        </section>

        <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>{accom.description}</p>
        {accom.maxGuests ? <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '16px' }}><Icon name="users" size={14} /> {t('m.book.maxParty', { n: accom.maxGuests })}</p> : null}

        {accom.amenities.length > 0 && (
          <>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px', color: 'var(--label-primary)' }}>{t('m.stay.amenities')}</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
              {accom.amenities.map(a => (
                <span key={a} style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--label-primary)', background: 'var(--system-bg-elevated)', boxShadow: 'var(--shadow-card)', borderRadius: 'var(--radius-full)' }}>{a}</span>
              ))}
            </div>
          </>
        )}

        {accom.roomViews.length > 0 && (
          <>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px', color: 'var(--label-primary)' }}>{t('m.stay.roomView')}</h2>
            <div className="horizontal-scroll" style={{ marginBottom: '12px' }}>
              {accom.roomViews.map((v, i) => <Img key={i} src={v} alt={`${t('m.stay.roomView')} ${i + 1}`} width={400} height={280} sizes="200px" style={{ width: '200px', height: '140px', borderRadius: '12px', flexShrink: 0 }} />)}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
