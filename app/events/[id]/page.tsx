// app/events/[id]/page.tsx — one promoter event. The hero is the promo
// media to swipe through (videos first, then photos; components/events/
// PromoMedia). Buy Ticket in the app (or through the promoter's link when
// the event doesn't sell tickets on ETA); free events get Free Entry · RSVP
// instead. One Add To Calendar button opens the calendar picker. Opened
// from an invite link (?inv=) the page says who invited them; ?buy=1 opens
// the ticket sheet straight away (Experiences' Buy Ticket).
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Icon from '@/lib/icons'
import Price from '@/components/Price'
import ErrorState from '@/components/ErrorState'
import BackButton from '@/components/BackButton'
import BookingSheet, { type BookingDetails, type BookingResult } from '@/components/BookingSheet'
import AddToCalendar from '@/components/AddToCalendar'
import Img from '@/components/Img'
import PromoMedia, { promoItems } from '@/components/events/PromoMedia'
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
import dynamic from 'next/dynamic'

const EtaMap = dynamic(() => import('@/components/map/EtaMap'), { ssr: false })

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
  const [inviter, setInviter] = useState<{ name: string; avatarUrl: string | null } | null>(null)

  useEffect(() => {
    const inv = new URLSearchParams(window.location.search).get('inv')
    if (!inv) return
    fetch(`/api/event-invites/${encodeURIComponent(inv)}`).then(r => (r.ok ? r.json() : null)).then(d => { if (d?.eventId === id) setInviter(d.inviter) }).catch(() => {})
  }, [id])

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

  // ?buy=1 (Buy Ticket on Experiences): open the ticket sheet once it's loaded.
  const buyParamDone = useRef(false)
  useEffect(() => {
    if (buyParamDone.current || state !== 'ready' || !event) return
    if (new URLSearchParams(window.location.search).get('buy') !== '1') return
    buyParamDone.current = true
    window.history.replaceState(null, '', `/events/${id}`)
    if (event.inAppTickets && !event.isFree) setTicketsOpen(true)
  }, [state, event, id])

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
  const directions = directionsUrl({ lat: event.lat, lng: event.lng, name: event.venueName })
  const unit = event.isFree ? 0 : event.price
  const inApp = Boolean(event.inAppTickets) && unit !== null
  const soldOut = inApp && event.ticketsLeft === 0
  const calendarItem = { title: event.title, start: new Date(event.startAt), end: event.endAt ? new Date(event.endAt) : null, location: `${event.venueName}, ${formatCity(event.city)}`, description: event.description, url: absoluteUrl(`/events/${event.id}`) }

  return (
    <main className="screen-push-in" style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '92px' }}>
      <BackButton floating fallback="/events" />
      <PromoMedia items={promoItems(event)} title={event.title}>
        <button onClick={toggleSave} aria-pressed={saved} aria-label={saved ? t('m.events.saved') : t('m.events.save')} className="heart-btn" style={{ position: 'absolute', zIndex: 5, top: 'calc(env(safe-area-inset-top, 0px) + 12px)', right: '16px', background: 'rgba(255,255,255,0.85)', color: saved ? 'var(--rum)' : '#0F0E0C' }}>
          <Icon name="heart" size={18} />
        </button>
        <div style={{ position: 'absolute', zIndex: 4, left: '16px', right: '16px', bottom: '20px', pointerEvents: 'none' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '4px' }}>{t('m.events.promotedBy', { name: event.promoterName })}</p>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.1, paddingRight: '110px' }}>{event.title}</h1>
        </div>
      </PromoMedia>

      <div style={{ padding: '20px 16px' }}>
        {inviter && (
          <div className="invite-banner">
            {inviter.avatarUrl ? <img src={inviter.avatarUrl} alt="" /> : <span className="invite-initial">{inviter.name.charAt(0)}</span>}
            <span style={{ flex: 1, fontSize: '15px', fontWeight: 600 }}>{t('m.inv.banner', { name: inviter.name })}</span>
          </div>
        )}
        {/* The main action: Buy Ticket, or Free Entry · RSVP for free events */}
        {event.isFree ? (
          <button className={`btn ${event.interested ? 'btn-secondary' : 'btn-primary'}`} style={{ width: '100%', marginBottom: '10px' }} onClick={toggleInterest} disabled={interestBusy} aria-pressed={Boolean(event.interested)}>
            <Icon name={event.interested ? 'check' : 'ticket'} size={16} /> {event.interested ? t('m.ev.going') : t('m.ev.freeRsvp')}
          </button>
        ) : inApp ? (
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: '10px' }} onClick={() => { triggerHaptic('medium'); setTicketsOpen(true) }} disabled={soldOut}>
            <Icon name="ticket" size={16} /> {soldOut ? t('m.events.soldOut') : t('m.ev.buyTicket')}{!soldOut && unit ? <>&nbsp;·&nbsp;<Price usd={unit} /></> : null}
          </button>
        ) : event.ticketUrl ? (
          <a className="btn btn-primary" href={event.ticketUrl} target="_blank" rel="noopener noreferrer" style={{ width: '100%', marginBottom: '10px', textDecoration: 'none' }} onClick={() => triggerHaptic('medium')}>
            <Icon name="ticket" size={16} /> {t('m.ev.buyTicket')}
          </a>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {!event.isFree && (
            <button className={`chip ${event.interested ? 'active' : ''}`} aria-pressed={Boolean(event.interested)} onClick={toggleInterest} disabled={interestBusy}>
              <Icon name="star" size={14} /> {event.interested ? t('m.events.interestedOn') : t('m.events.interested')}
            </button>
          )}
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

        <div style={{ marginBottom: '8px' }}>
          <AddToCalendar block item={calendarItem} uid={`event-${event.id}`} />
        </div>
        <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '24px' }}>{t('m.events.reminderNote')}</p>

        <div style={{ marginBottom: '24px' }}>
          <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.events.about')}</span></div></div>
          <p style={{ fontSize: '15px', lineHeight: 1.55, color: 'var(--label-primary)', whiteSpace: 'pre-line' }}>{event.description}</p>
        </div>

        {hasCoords && (
          <div className="card" style={{ position: 'relative', overflow: 'hidden', cursor: 'default', marginBottom: '16px', height: '200px' }}>
            <EtaMap center={{ lat: event.lat!, lng: event.lng! }} zoom={15} markers={[{ id: event.id, lat: event.lat!, lng: event.lng!, size: 22, label: event.venueName, labelAlways: true }]} label={event.venueName} />
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
            <Icon name="ticket" size={16} /> {soldOut ? t('m.events.soldOut') : t('m.ev.buyTicket')}
          </button>
        ) : event.ticketUrl ? (
          <a className="btn btn-primary" href={event.ticketUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
            <Icon name="ticket" size={16} /> {t('m.ev.buyTicket')}
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
