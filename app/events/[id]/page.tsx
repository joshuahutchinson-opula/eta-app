// app/events/[id]/page.tsx — one promoter event: save it, mark interest,
// add it to your calendar, and get tickets in the app (or through the
// promoter's link when the event doesn't sell tickets on ETA).
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Icon from '@/lib/icons'
import Price from '@/components/Price'
import ErrorState from '@/components/ErrorState'
import BackButton from '@/components/BackButton'
import BookingSheet, { type BookingDetails, type BookingResult } from '@/components/BookingSheet'
import AddToCalendar from '@/components/AddToCalendar'
import Img from '@/components/Img'
import SmartVideo from '@/components/SmartVideo'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { formatCity } from '@/lib/format'
import { shareOrCopy } from '@/lib/share'
import { absoluteUrl } from '@/lib/site-url'
import { apiJson, authHeaders } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { readSaved, toggleSaved } from '@/lib/saved'
import { directionsUrl } from '@/lib/calendar'
import { hapticSaved, triggerHaptic } from '@/lib/haptics'
import { useEventFormat, type EventItem } from '@/lib/events'
import { MAX_TICKETS } from '@/lib/ticket-limits'

export default function EventDetailPage() {
  const { id } = useParams() as { id: string }
  const { t } = useLang()
  const errorText = useErrorText()
  const { range } = useEventFormat()
  const [event, setEvent] = useState<EventItem | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notFound' | 'error'>('loading')
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [interestBusy, setInterestBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [ticketsOpen, setTicketsOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}`, { headers: authHeaders() })
      if (res.status === 404) return setState('notFound')
      if (!res.ok) throw new Error()
      setEvent(await res.json())
      setState('ready')
    } catch {
      setState('error')
    }
  }, [id])

  useEffect(() => { load(); setSaved(readSaved('events').includes(id)) }, [load, id])

  const share = async () => {
    if (!event) return
    const result = await shareOrCopy({ title: event.title, text: `${event.title} — ${event.venueName}`, url: absoluteUrl(`/events/${event.id}`) })
    if (result === 'copied') {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  const toggleSave = () => {
    hapticSaved()
    setSaved(toggleSaved('events', id))
  }

  const toggleInterest = async () => {
    if (!event) return
    if (!getCurrentUser()) { setNotice(t('m.events.loginToInterest')); return }
    setInterestBusy(true)
    setNotice(null)
    try {
      const res = await apiJson<{ interested: boolean; interestedCount: number }>(`/api/events/${id}/interest`, { method: 'POST', body: { interested: !event.interested } })
      triggerHaptic('selection')
      setEvent({ ...event, interested: res.interested, interestedCount: res.interestedCount })
    } catch (e) {
      setNotice(errorText(e))
    } finally {
      setInterestBusy(false)
    }
  }

  const buyTickets = async (details: BookingDetails): Promise<BookingResult> => {
    const r = await apiJson<{ transactionId: string | null; walletBalance: number | null }>(`/api/events/${id}/tickets`, { method: 'POST', body: { quantity: details.partySize } })
    load()
    return { transactionId: r.transactionId, walletBalance: r.walletBalance }
  }

  if (state === 'loading') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)' }}>
        <BackButton floating fallback="/events" />
        <div className="skeleton-card" style={{ height: '40vh' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
      </main>
    )
  }

  if (state !== 'ready' || !event) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <BackButton floating fallback="/events" />
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
  const directions = directionsUrl({ lat: event.lat, lng: event.lng, name: event.venueName })
  const unit = event.isFree ? 0 : event.price
  const inApp = Boolean(event.inAppTickets) && unit !== null
  const soldOut = inApp && event.ticketsLeft === 0
  const calendarItem = { title: event.title, start: new Date(event.startAt), end: event.endAt ? new Date(event.endAt) : null, location: `${event.venueName}, ${formatCity(event.city)}`, description: event.description, url: absoluteUrl(`/events/${event.id}`) }

  return (
    <main className="screen-push-in" style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '92px' }}>
      <BackButton floating fallback="/events" />
      <div style={{ position: 'relative', height: '42vh', background: 'var(--system-bg-secondary)', overflow: 'hidden' }}>
        {event.videoUrl ? (
          <SmartVideo src={event.videoUrl} poster={event.imageUrl} />
        ) : event.imageUrl ? (
          <Img src={event.imageUrl} alt={event.title} width={1080} height={720} priority />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-tertiary)' }}><Icon name="party" size={48} /></div>
        )}
        <div className="featured-hero-overlay" style={{ pointerEvents: 'none' }} />
        <button onClick={toggleSave} aria-pressed={saved} aria-label={saved ? t('m.events.saved') : t('m.events.save')} className="heart-btn" style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', right: '16px', background: 'rgba(255,255,255,0.85)', color: saved ? 'var(--rum)' : '#0F0E0C' }}>
          <Icon name="heart" size={18} />
        </button>
        <div style={{ position: 'absolute', left: '16px', right: '16px', bottom: '20px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '4px' }}>{t('m.events.promotedBy', { name: event.promoterName })}</p>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{event.title}</h1>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button className={`chip ${event.interested ? 'active' : ''}`} aria-pressed={Boolean(event.interested)} onClick={toggleInterest} disabled={interestBusy}>
            <Icon name="star" size={14} /> {event.interested ? t('m.events.interestedOn') : t('m.events.interested')}
          </button>
          {event.interestedCount ? (
            <span style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{event.interestedCount === 1 ? t('m.events.oneInterested') : t('m.events.interestedCount', { n: event.interestedCount })}</span>
          ) : null}
        </div>
        {notice && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '12px' }}>{notice} {!getCurrentUser() && <Link href={`/login?next=/events/${id}`} style={{ color: 'var(--rum-text)', fontWeight: 600 }}>{t('m.profile.login')}</Link>}</p>}

        <div className="card" style={{ padding: '4px 16px', marginBottom: '16px', cursor: 'default' }}>
          <div style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: '0.5px solid var(--separator)' }}>
            <Icon name="clock" size={18} style={{ color: 'var(--rum-text)', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '12px', color: 'var(--label-secondary)' }}>{t('m.events.when')}</p>
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{range(event.startAt, event.endAt)}</p>
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
          <div style={{ display: 'flex', gap: '12px', padding: '12px 0', alignItems: 'center' }}>
            <Icon name="receipt" size={18} style={{ color: 'var(--rum-text)', flexShrink: 0 }} />
            <p style={{ flex: 1, fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>
              {event.isFree ? t('m.events.free') : event.price !== null ? <Price usd={event.price} /> : <span style={{ color: 'var(--label-secondary)', fontWeight: 500 }}>{t('m.events.priceNotListed')}</span>}
            </p>
            {inApp && event.ticketsLeft != null && (
              <span style={{ fontSize: '12px', fontWeight: 700, color: soldOut ? 'var(--error)' : 'var(--warning)' }}>
                {soldOut ? t('m.events.soldOut') : event.ticketsLeft <= 20 ? t('m.events.ticketsLeft', { n: event.ticketsLeft }) : null}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
          <AddToCalendar item={calendarItem} uid={`event-${event.id}`} />
        </div>
        <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '24px' }}>{t('m.events.reminderNote')}</p>

        <div style={{ marginBottom: '24px' }}>
          <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.events.about')}</span></div></div>
          <p style={{ fontSize: '15px', lineHeight: 1.55, color: 'var(--label-primary)', whiteSpace: 'pre-line' }}>{event.description}</p>
        </div>

        {mapSrc && (
          <div className="card" style={{ overflow: 'hidden', cursor: 'default', marginBottom: '16px' }}>
            <iframe src={mapSrc} title={event.venueName} loading="lazy" tabIndex={-1} style={{ width: '100%', height: '180px', border: 0, pointerEvents: 'none' }} />
          </div>
        )}

        {event.vendor && (
          <Link href={`/vendor/${event.vendor.id}`} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', textDecoration: 'none', marginBottom: '16px' }}>
            {event.vendor.images[0] && <span style={{ width: '44px', height: '44px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}><Img src={event.vendor.images[0]} alt="" width={88} height={88} sizes="44px" /></span>}
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
        {directions && (
          <a className="btn btn-secondary" href={directions} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
            <Icon name="navigate" size={16} /> {t('m.events.directions')}
          </a>
        )}
        {inApp ? (
          <button className="btn btn-primary" onClick={() => setTicketsOpen(true)} disabled={soldOut} style={{ flex: 1 }}>
            <Icon name="ticket" size={16} /> {soldOut ? t('m.events.soldOut') : t('m.events.getTickets')}
          </button>
        ) : event.ticketUrl ? (
          <a className="btn btn-primary" href={event.ticketUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
            {t('m.events.tickets')}
          </a>
        ) : null}
      </div>

      {inApp && (
        <BookingSheet
          open={ticketsOpen}
          onClose={() => setTicketsOpen(false)}
          title={event.title}
          unitPrice={unit ?? 0}
          maxPartySize={Math.min(MAX_TICKETS, event.ticketsLeft ?? MAX_TICKETS)}
          cancellationTier="standard"
          fixedWhen={{ date: new Date(event.startAt).toLocaleDateString('en-CA', { timeZone: 'America/Jamaica' }), label: range(event.startAt, event.endAt) }}
          onConfirm={buyTickets}
          onDone={() => setTicketsOpen(false)}
        />
      )}
    </main>
  )
}
