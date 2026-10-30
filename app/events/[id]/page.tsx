// app/events/[id]/page.tsx — one promoter event.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import Price from '@/components/Price'
import ErrorState from '@/components/ErrorState'
import { useLang } from '@/lib/i18n-client'
import { formatCity } from '@/lib/format'
import { shareOrCopy } from '@/lib/share'
import { eventRange, type EventItem } from '@/lib/events'

export default function EventDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const { t } = useLang()
  const [event, setEvent] = useState<EventItem | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notFound' | 'error'>('loading')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch(`/api/events/${id}`)
      if (res.status === 404) return setState('notFound')
      if (!res.ok) throw new Error()
      setEvent(await res.json())
      setState('ready')
    } catch {
      setState('error')
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const share = async () => {
    if (!event) return
    const result = await shareOrCopy({ title: event.title, text: `${event.title} — ${event.venueName}`, url: window.location.href })
    if (result === 'copied') {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  const backButton = (
    <button
      onClick={() => router.back()}
      aria-label="Back"
      style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: '16px', zIndex: 20, width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F0E0C', boxShadow: 'var(--shadow-card)' }}
    >
      <Icon name="back" size={16} />
    </button>
  )

  if (state === 'loading') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)' }}>
        {backButton}
        <div className="skeleton-card" style={{ height: '40vh' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
      </main>
    )
  }

  if (state !== 'ready' || !event) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        {backButton}
        {state === 'error' ? <ErrorState onRetry={load} /> : (
          <div className="empty-state">
            <Icon name="party" size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.events.notFound')}</p>
          </div>
        )}
      </main>
    )
  }

  const hasCoords = event.lat !== null && event.lng !== null
  const mapSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${[event.lng! - 0.006, event.lat! - 0.004, event.lng! + 0.006, event.lat! + 0.004].join(',')}&layer=mapnik&marker=${event.lat},${event.lng}`
    : null

  return (
    <main className="screen-push-in" style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '92px' }}>
      {backButton}
      <div style={{ position: 'relative', height: '42vh', background: 'var(--system-bg-secondary)', overflow: 'hidden' }}>
        {event.videoUrl ? (
          <video src={event.videoUrl} poster={event.imageUrl ?? undefined} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : event.imageUrl ? (
          <img src={event.imageUrl} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-tertiary)' }}><Icon name="party" size={48} /></div>
        )}
        <div className="featured-hero-overlay" style={{ pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '16px', right: '16px', bottom: '20px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '4px' }}>{t('m.events.promotedBy', { name: event.promoterName })}</p>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{event.title}</h1>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <div className="card" style={{ padding: '4px 16px', marginBottom: '24px', cursor: 'default' }}>
          <div style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: '0.5px solid var(--separator)' }}>
            <Icon name="clock" size={18} style={{ color: 'var(--rum-text)', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '12px', color: 'var(--label-secondary)' }}>{t('m.events.when')}</p>
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{eventRange(event.startAt, event.endAt)}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: '0.5px solid var(--separator)' }}>
            <Icon name="mapPin" size={18} style={{ color: 'var(--rum-text)', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '12px', color: 'var(--label-secondary)' }}>{t('m.events.venue')}</p>
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{event.venueName}</p>
              <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{formatCity(event.city)}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', padding: '12px 0' }}>
            <Icon name="receipt" size={18} style={{ color: 'var(--rum-text)', flexShrink: 0 }} />
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>
              {event.isFree ? t('m.events.free') : event.price !== null ? <Price usd={event.price} /> : <span style={{ color: 'var(--label-secondary)', fontWeight: 500 }}>{t('m.events.priceNotListed')}</span>}
            </p>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.events.about')}</span></div></div>
          <p style={{ fontSize: '15px', lineHeight: 1.55, color: 'var(--label-primary)', whiteSpace: 'pre-line' }}>{event.description}</p>
        </div>

        {mapSrc && (
          <div className="card" style={{ overflow: 'hidden', cursor: 'default', marginBottom: '16px' }}>
            <iframe src={mapSrc} title={`Map showing ${event.venueName}`} loading="lazy" tabIndex={-1} style={{ width: '100%', height: '180px', border: 0, pointerEvents: 'none' }} />
          </div>
        )}

        {event.vendor && (
          <Link href={`/vendor/${event.vendor.id}`} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', textDecoration: 'none', marginBottom: '16px' }}>
            {event.vendor.images[0] && <img src={event.vendor.images[0]} alt="" style={{ width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover' }} />}
            <span style={{ flex: 1, fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.events.venueOnEta')}</span>
            <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
          </Link>
        )}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--system-bg-elevated)', borderTop: '0.5px solid var(--separator)', padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))', display: 'flex', gap: '10px', zIndex: 20 }}>
        <button className="btn btn-secondary" onClick={share} style={{ padding: '0 14px' }} aria-label={t('m.events.share')}>
          <Icon name="share" size={16} />
          {copied ? t('m.events.linkCopied') : null}
        </button>
        {hasCoords && (
          <a className="btn btn-secondary" href={`https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
            <Icon name="mapPin" size={16} /> {t('m.events.directions')}
          </a>
        )}
        {event.ticketUrl && (
          <a className="btn btn-primary" href={event.ticketUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
            {t('m.events.tickets')}
          </a>
        )}
      </div>
    </main>
  )
}
