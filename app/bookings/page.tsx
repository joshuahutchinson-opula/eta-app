// app/bookings/page.tsx — My Bookings, which doubles as the My Trip
// timeline: upcoming bookings grouped by day, then past ones, each with its
// status, a ticket (QR) to show on arrival, its receipts, add-to-calendar,
// directions to the meeting point, cancel and reschedule (by the
// cancellation policy), and a way into the active trip or its recap.
// Event tickets and table requests (pending / accepted / declined) are
// listed too. Everything is kept for offline use (lib/offline.ts).
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Dock from '@/components/Dock'
import BackButton from '@/components/BackButton'
import Icon from '@/lib/icons'
import Price from '@/components/Price'
import QRCode from '@/components/QRCode'
import Img from '@/components/Img'
import ErrorState from '@/components/ErrorState'
import AddToCalendar from '@/components/AddToCalendar'
import { Filled } from '@/components/LinkedText'
import { apiJson, authHeaders } from '@/lib/api-client'
import { getCurrentUser, setCurrentUser } from '@/lib/auth-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { bookingCode, jamaicaToday } from '@/lib/pricing'
import { canReschedule, parseTier } from '@/lib/cancellation'
import { directionsUrl } from '@/lib/calendar'
import { cacheForOffline, readOffline, saveOffline, saveReceiptsOffline } from '@/lib/offline'
import { absoluteUrl } from '@/lib/site-url'
import { triggerHaptic } from '@/lib/haptics'
import type { SlotState } from '@/lib/slots'

interface BookingRow {
  id: string
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
  date: string
  endDate: string | null
  time: string | null
  partySize: number
  totalPrice: number
  pointsEarned: number
  refundAmount: number | null
  experience: { id: string; name: string; imageUrl: string; meetingPoint: string | null; meetingLat: number | null; meetingLng: number | null; cancellationTier: string; startTimes: string[] } | null
  vendor: { id: string; name: string; images: string[]; neighborhood: string; lat: number; lng: number } | null
  accommodation: { id: string; name: string; media: Array<{ url: string }>; lat: number; lng: number } | null
  trip: { slug: string; status: string; name: string } | null
  transactions: Array<{ id: string; amount: number; status: string; type: string; createdAt: string }>
}

interface TicketRow {
  id: string
  quantity: number
  totalPrice: number
  status: 'CONFIRMED' | 'CANCELLED' | 'USED'
  code: string
  transactionId: string | null
  refundAmount: number | null
  event: { id: string; title: string; venueName: string; startAt: string; endAt: string | null; imageUrl: string | null; lat: number | null; lng: number | null; city: string }
}

interface ReservationRow {
  id: string
  date: string
  time: string
  partySize: number
  note: string | null
  status: 'REQUESTED' | 'CONFIRMED' | 'DECLINED'
  vendorNote: string | null
  vendor: { id: string; name: string; images: string[]; neighborhood: string; lat: number; lng: number }
}

interface Data { bookings: BookingRow[]; tickets: TicketRow[]; reservations: ReservationRow[] }

const TZ = 'America/Jamaica'
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
const OFFLINE_KEY = 'bookings'

function imageOf(b: BookingRow) {
  return b.experience?.imageUrl ?? b.accommodation?.media?.[0]?.url ?? b.vendor?.images?.[0] ?? null
}

function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export default function MyBookingsPage() {
  const { t, lang } = useLang()
  const errorText = useErrorText()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [data, setData] = useState<Data | null>(null)
  const [offlineAt, setOfflineAt] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [ticket, setTicket] = useState<{ title: string; code: string; sub: string; meeting?: string | null } | null>(null)
  const [cancelling, setCancelling] = useState<{ booking: BookingRow; refund: number | null } | null>(null)
  const [moving, setMoving] = useState<BookingRow | null>(null)
  const [moveDate, setMoveDate] = useState(jamaicaToday(1))
  const [moveTime, setMoveTime] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotState[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [sheetError, setSheetError] = useState<string | null>(null)

  const locale = lang === 'en' ? 'en-US' : lang
  const fmtWhen = (iso: string) => new Date(iso).toLocaleString(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ })

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const [bookings, tickets, reservations] = await Promise.all([
        apiJson<BookingRow[]>('/api/bookings'),
        apiJson<TicketRow[]>('/api/tickets'),
        apiJson<ReservationRow[]>('/api/reservations')
      ])
      const next = { bookings, tickets, reservations }
      setData(next)
      setOfflineAt(null)
      saveOffline(OFFLINE_KEY, next)
      // Receipts and photos for offline: the pages the tickets link to.
      cacheForOffline([
        '/bookings',
        ...bookings.flatMap(b => b.transactions.map(tx => `/receipt/${tx.id}`)),
        ...tickets.map(tk => tk.transactionId && `/receipt/${tk.transactionId}`),
        ...bookings.map(imageOf),
        ...tickets.map(tk => tk.event.imageUrl)
      ])
      saveReceiptsOffline([
        ...bookings.flatMap(b => b.transactions.map(tx => tx.id)),
        ...tickets.map(tk => tk.transactionId).filter((x): x is string => Boolean(x))
      ], authHeaders())
    } catch {
      const cached = readOffline<Data>(OFFLINE_KEY)
      if (cached) { setData(cached.data); setOfflineAt(cached.savedAt) } else setFailed(true)
    }
  }, [])

  useEffect(() => {
    const user = getCurrentUser()
    setSignedIn(Boolean(user))
    if (user) load()
  }, [load])

  // Availability for the reschedule sheet.
  useEffect(() => {
    if (!moving?.experience || !moving.experience.startTimes.length) { setSlots(null); return }
    setSlots(null)
    fetch(`/api/experiences/${moving.experience.id}/availability?date=${moveDate}`).then(r => (r.ok ? r.json() : null)).then(d => setSlots(d?.slots ?? [])).catch(() => setSlots([]))
  }, [moving, moveDate])

  const openCancel = async (b: BookingRow) => {
    setSheetError(null)
    setCancelling({ booking: b, refund: null })
    try {
      const preview = await apiJson<{ refund: number }>(`/api/bookings/${b.id}/cancel`)
      setCancelling({ booking: b, refund: preview.refund })
    } catch (e) {
      setSheetError(errorText(e))
    }
  }

  const walletUpdate = (balance: number | null | undefined) => {
    const u = getCurrentUser()
    if (u && typeof balance === 'number') setCurrentUser({ ...u, walletBalance: balance })
  }

  const confirmCancel = async () => {
    if (!cancelling) return
    setBusy(true)
    setSheetError(null)
    try {
      const r = await apiJson<{ refund: number; walletBalance: number | null }>(`/api/bookings/${cancelling.booking.id}/cancel`, { method: 'POST', body: {} })
      walletUpdate(r.walletBalance)
      triggerHaptic('medium')
      setCancelling(null)
      setNoticeFor(r.refund)
      load()
    } catch (e) {
      setSheetError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const [refundNotice, setRefundNotice] = useState<number | null>(null)
  const setNoticeFor = (refund: number) => { setRefundNotice(refund); setNotice(refund > 0 ? 'refund' : t('m.bookings.cancelledNoRefund')) }

  const cancelTickets = async (tk: TicketRow) => {
    setBusy(true)
    try {
      const r = await apiJson<{ refund: number; walletBalance: number | null }>(`/api/tickets/${tk.id}/cancel`, { method: 'POST', body: {} })
      walletUpdate(r.walletBalance)
      setNoticeFor(r.refund)
      load()
    } catch (e) {
      setNotice(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async (r: ReservationRow) => {
    await apiJson(`/api/reservations/${r.id}`, { method: 'DELETE' }).catch(e => setNotice(errorText(e)))
    load()
  }

  const confirmMove = async () => {
    if (!moving) return
    setBusy(true)
    setSheetError(null)
    try {
      const updated = await apiJson<{ date: string }>(`/api/bookings/${moving.id}/reschedule`, { method: 'POST', body: { date: moveDate, time: moveTime } })
      triggerHaptic('medium')
      setMoving(null)
      setNotice(t('m.bookings.moved', { when: fmtWhen(updated.date) }))
      load()
    } catch (e) {
      setSheetError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const all = data?.bookings ?? []
  const upcoming = all.filter(b => (b.status === 'CONFIRMED' || b.status === 'PENDING') && dayKey(b.endDate ?? b.date) >= today)
  const past = all.filter(b => !upcoming.includes(b)).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  const byDay = Array.from(upcoming.reduce((m, b) => m.set(dayKey(b.date), [...(m.get(dayKey(b.date)) ?? []), b]), new Map<string, BookingRow[]>()))
  const tickets = data?.tickets ?? []
  const reservations = (data?.reservations ?? []).filter(r => Date.parse(r.date) > Date.now() - 86400000)

  const dayHeading = (key: string) => {
    if (key === today) return t('m.bookings.today')
    if (key === new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: TZ })) return t('m.bookings.tomorrow')
    return new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })
  }

  const statusChip = (label: string, tone: 'ok' | 'wait' | 'bad' | 'muted') => {
    const color = tone === 'ok' ? 'var(--success)' : tone === 'wait' ? 'var(--warning)' : tone === 'bad' ? 'var(--error)' : 'var(--label-secondary)'
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
        {label}
      </span>
    )
  }

  const small = { minHeight: '36px', padding: '6px 12px', fontSize: '14px', textDecoration: 'none' } as const

  const card = (b: BookingRow) => {
    const img = imageOf(b)
    const title = b.experience?.name ?? b.accommodation?.name ?? b.vendor?.name ?? b.trip?.name ?? t('m.bookings.title.fallback')
    const when = b.accommodation && b.endDate
      ? `${new Date(b.date).toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: TZ })} → ${new Date(b.endDate).toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: TZ })}`
      : fmtWhen(b.date)
    const active = b.status === 'CONFIRMED' || b.status === 'PENDING'
    const future = Date.parse(b.date) > Date.now()
    const tier = parseTier(b.experience?.cancellationTier)
    const meeting = b.experience
      ? { lat: b.experience.meetingLat, lng: b.experience.meetingLng, name: b.experience.meetingPoint }
      : b.accommodation ? { lat: b.accommodation.lat, lng: b.accommodation.lng, name: b.accommodation.name }
      : b.vendor ? { lat: b.vendor.lat, lng: b.vendor.lng, name: b.vendor.name } : null
    const directions = meeting ? directionsUrl(meeting) : null
    const tripLive = b.trip?.status === 'BOOKED'
    const recap = b.trip?.status === 'COMPLETED'
    const statusTone = b.status === 'CONFIRMED' ? 'ok' : b.status === 'PENDING' ? 'wait' : b.status === 'CANCELLED' ? 'bad' : 'muted'
    return (
      <div key={b.id} className="card" style={{ padding: '12px', cursor: 'default', marginBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {img ? <span style={{ width: '64px', height: '64px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}><Img src={img} alt="" width={128} height={128} sizes="64px" /></span> : <span style={{ width: '64px', height: '64px', borderRadius: '10px', background: 'var(--system-bg-secondary)', flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
            <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>
              {when} · {b.accommodation ? t('m.bookings.guests', { n: b.partySize }) : t('m.bookings.people', { n: b.partySize })}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
              {statusChip(t(`m.bookings.status.${b.status}` as 'm.bookings.status.CONFIRMED'), statusTone)}
              <Price usd={b.totalPrice} compact style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-primary)' }} />
              {b.status === 'CANCELLED' && b.refundAmount ? <span style={{ fontSize: '12px', color: 'var(--label-secondary)' }}><Filled text={t('m.bookings.refunded')} values={{ amount: <Price usd={b.refundAmount} compact /> }} /></span> : null}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
          {b.status !== 'CANCELLED' && (
            <button className="chip" onClick={() => { triggerHaptic('light'); setTicket({ title, code: bookingCode(b.id), sub: `${fmtWhen(b.date)} · ${t('m.bookings.people', { n: b.partySize })}`, meeting: b.experience?.meetingPoint }) }} style={small}>
              <Icon name="ticket" size={14} /> {t('m.bookings.ticket')}
            </button>
          )}
          {b.transactions.filter(tx => tx.type !== 'REFUND').map((tx, i, list) => (
            <Link key={tx.id} href={`/receipt/${tx.id}`} className="chip" style={small}>
              <Icon name="receipt" size={14} /> {list.length > 1 ? `${t('m.bookings.receipt')} ${i + 1}` : t('m.bookings.receipt')}
            </Link>
          ))}
          {active && future && (
            <AddToCalendar compact uid={`booking-${b.id}`} item={{ title, start: new Date(b.date), end: b.endDate ? new Date(b.endDate) : null, location: meeting?.name ?? null, description: `${t('m.bookings.ticket')}: ${bookingCode(b.id)}`, url: absoluteUrl('/bookings') }} />
          )}
          {active && directions && (
            <a href={directions} target="_blank" rel="noopener noreferrer" className="chip" style={small}>
              <Icon name="navigate" size={14} /> {b.experience?.meetingPoint ? t('m.nav.toMeeting') : t('m.nav.directions')}
            </a>
          )}
          {tripLive && (
            <Link href={`/experiences?trip=${b.trip!.slug}`} className="chip active" style={small}>
              <Icon name="route" size={14} /> {t('m.bookings.openTrip')}
            </Link>
          )}
          {recap && (
            <Link href={`/trip/${b.trip!.slug}/recap`} className="chip" style={small}>
              <Icon name="sparkle" size={14} /> {t('m.bookings.recap')}
            </Link>
          )}
          {active && future && b.experience && !b.accommodation && canReschedule(tier, new Date(b.date)) && (
            <button className="chip" onClick={() => { setSheetError(null); setMoveDate(dayKey(b.date) > today ? dayKey(b.date) : jamaicaToday(1)); setMoveTime(b.time); setMoving(b) }} style={small}>
              <Icon name="calendar" size={14} /> {t('m.bookings.reschedule')}
            </button>
          )}
          {active && future && (
            <button className="chip" onClick={() => openCancel(b)} style={{ ...small, color: 'var(--error)' }}>
              <Icon name="close" size={14} /> {t('m.bookings.cancel')}
            </button>
          )}
        </div>
      </div>
    )
  }

  const ticketCard = (tk: TicketRow) => {
    const active = tk.status === 'CONFIRMED' && Date.parse(tk.event.endAt ?? tk.event.startAt) > Date.now()
    const directions = directionsUrl({ lat: tk.event.lat, lng: tk.event.lng, name: tk.event.venueName })
    return (
      <div key={tk.id} className="card" style={{ padding: '12px', cursor: 'default', marginBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {tk.event.imageUrl ? <span style={{ width: '64px', height: '64px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}><Img src={tk.event.imageUrl} alt="" width={128} height={128} sizes="64px" /></span> : <span style={{ width: '64px', height: '64px', borderRadius: '10px', background: 'var(--system-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="party" size={22} /></span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tk.event.title}</p>
            <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{fmtWhen(tk.event.startAt)} · {tk.quantity === 1 ? t('m.bookings.oneTicket') : t('m.bookings.ticketCount', { n: tk.quantity })}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              {statusChip(t(`m.bookings.ticketStatus.${tk.status}` as 'm.bookings.ticketStatus.USED'), tk.status === 'CONFIRMED' ? 'ok' : tk.status === 'CANCELLED' ? 'bad' : 'muted')}
              <Price usd={tk.totalPrice} compact style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-primary)' }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
          {tk.status !== 'CANCELLED' && (
            <button className="chip" onClick={() => setTicket({ title: tk.event.title, code: tk.code, sub: `${fmtWhen(tk.event.startAt)} · ${tk.quantity === 1 ? t('m.bookings.oneTicket') : t('m.bookings.ticketCount', { n: tk.quantity })}`, meeting: tk.event.venueName })} style={small}>
              <Icon name="ticket" size={14} /> {t('m.bookings.showTicket')}
            </button>
          )}
          {tk.transactionId && <Link href={`/receipt/${tk.transactionId}`} className="chip" style={small}><Icon name="receipt" size={14} /> {t('m.bookings.receipt')}</Link>}
          {active && <AddToCalendar compact uid={`ticket-${tk.id}`} item={{ title: tk.event.title, start: new Date(tk.event.startAt), end: tk.event.endAt ? new Date(tk.event.endAt) : null, location: tk.event.venueName, url: absoluteUrl(`/events/${tk.event.id}`) }} />}
          {active && directions && <a href={directions} target="_blank" rel="noopener noreferrer" className="chip" style={small}><Icon name="navigate" size={14} /> {t('m.nav.directions')}</a>}
          {active && <button className="chip" disabled={busy} onClick={() => cancelTickets(tk)} style={{ ...small, color: 'var(--error)' }}><Icon name="close" size={14} /> {t('m.bookings.cancelTickets')}</button>}
        </div>
      </div>
    )
  }

  const reservationCard = (r: ReservationRow) => (
    <div key={r.id} className="card" style={{ padding: '12px', cursor: 'default', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link href={`/vendor/${r.vendor.id}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}>
          <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)' }}>{r.vendor.name}</p>
          <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{fmtWhen(r.date)} · {t('m.bookings.people', { n: r.partySize })}</p>
        </Link>
        {statusChip(t(`m.bookings.res.${r.status}` as 'm.bookings.res.REQUESTED'), r.status === 'CONFIRMED' ? 'ok' : r.status === 'REQUESTED' ? 'wait' : 'bad')}
      </div>
      {r.vendorNote && <p style={{ fontSize: '13px', color: 'var(--label-primary)', marginTop: '6px' }}>{t('m.bookings.vendorSaid', { note: r.vendorNote })}</p>}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
        {r.status === 'CONFIRMED' && <AddToCalendar compact uid={`reservation-${r.id}`} item={{ title: r.vendor.name, start: new Date(r.date), location: r.vendor.neighborhood }} />}
        {r.status !== 'DECLINED' && directionsUrl(r.vendor) && <a href={directionsUrl(r.vendor)!} target="_blank" rel="noopener noreferrer" className="chip" style={small}><Icon name="navigate" size={14} /> {t('m.nav.directions')}</a>}
        {r.status === 'REQUESTED' && <button className="chip" onClick={() => withdraw(r)} style={{ ...small, color: 'var(--error)' }}><Icon name="close" size={14} /> {t('m.bookings.withdraw')}</button>}
      </div>
    </div>
  )

  const nothing = all.length === 0 && tickets.length === 0 && reservations.length === 0

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <BackButton fallback="/profile" />
        <div className="section-heading">
          <span className="section-eyebrow">{t('m.bookings.eyebrow')}</span>
          <h1 className="section-title">{t('m.profile.bookings')}</h1>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {offlineAt && <p role="status" style={{ fontSize: '13px', color: 'var(--warning)', marginBottom: '12px' }}>{t('m.bookings.offline', { when: fmtWhen(offlineAt) })}</p>}
        {notice && (
          <p role="status" style={{ fontSize: '14px', color: 'var(--label-primary)', marginBottom: '12px' }}>
            <Icon name="check" size={14} style={{ color: 'var(--success)' }} />{' '}
            {notice === 'refund' && refundNotice ? <Filled text={t('m.bookings.cancelled')} values={{ amount: <Price usd={refundNotice} compact /> }} /> : notice}
          </p>
        )}
        {signedIn === false ? (
          <div className="empty-state">
            <Icon name="user" size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.bookings.loginTitle')}</p>
            <Link href="/login?next=/bookings" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('m.profile.login')}</Link>
          </div>
        ) : failed ? (
          <ErrorState onRetry={load} />
        ) : data === null ? (
          [0, 1].map(i => <div key={i} className="skeleton-card" style={{ height: '120px', marginBottom: '10px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>)
        ) : nothing ? (
          <div className="empty-state">
            <Icon name="route" size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.bookings.empty')}</p>
            <Link href="/experiences/browse" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('m.exp.browseAll')}</Link>
          </div>
        ) : (
          <>
            <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.bookings.upcoming')}</span></div></div>
            {byDay.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '12px' }}>{t('m.bookings.noUpcoming')}</p>
            ) : byDay.map(([key, list]) => (
              <section key={key} style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--rum-text)', margin: '4px 0 8px' }}>{dayHeading(key)}</p>
                {list.map(card)}
              </section>
            ))}
            {tickets.length > 0 && (
              <>
                <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.bookings.tickets')}</span></div></div>
                {tickets.map(ticketCard)}
              </>
            )}
            {reservations.length > 0 && (
              <>
                <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.bookings.reservations')}</span></div></div>
                {reservations.map(reservationCard)}
              </>
            )}
            {past.length > 0 && (
              <>
                <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.bookings.past')}</span></div></div>
                {past.map(card)}
              </>
            )}
          </>
        )}
      </div>

      {/* Ticket / QR */}
      <div className={`bottom-sheet-overlay ${ticket ? 'open' : ''}`} onClick={() => setTicket(null)} />
      <div className={`bottom-sheet ${ticket ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.bookings.ticket')}>
        <div className="sheet-grabber" />
        {ticket && (
          <div style={{ padding: '0 20px 24px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '4px' }}>{ticket.title}</h3>
            <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '16px' }}>{ticket.sub}</p>
            <QRCode value={ticket.code} size={220} label={t('m.bookings.ticketQr')} />
            <p className="num-font" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--label-primary)', letterSpacing: '0.06em', marginTop: '12px' }}>{ticket.code}</p>
            <p style={{ fontSize: '13px', color: 'var(--label-secondary)', margin: '4px 0 16px' }}>{t('m.bookings.showOnArrival')}</p>
            {ticket.meeting && <p style={{ fontSize: '14px', color: 'var(--label-primary)', marginBottom: '16px' }}><Icon name="mapPin" size={14} /> {ticket.meeting}</p>}
            <button className="btn btn-tertiary" onClick={() => setTicket(null)} style={{ width: '100%' }}>{t('m.profile.done')}</button>
          </div>
        )}
      </div>

      {/* Cancel */}
      <div className={`bottom-sheet-overlay ${cancelling ? 'open' : ''}`} onClick={() => !busy && setCancelling(null)} />
      <div className={`bottom-sheet ${cancelling ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.bookings.cancel')}>
        <div className="sheet-grabber" />
        {cancelling && (
          <div style={{ padding: '0 20px 24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '8px' }}>
              {t('m.bookings.cancelTitle', { name: cancelling.booking.experience?.name ?? cancelling.booking.accommodation?.name ?? cancelling.booking.trip?.name ?? t('m.bookings.title.fallback') })}
            </h3>
            <p style={{ fontSize: '15px', color: 'var(--label-primary)', marginBottom: '6px' }}>
              {cancelling.refund === null ? '…' : cancelling.refund > 0 ? <Filled text={t('m.bookings.refundPreview')} values={{ amount: <Price usd={cancelling.refund} compact /> }} /> : t('m.bookings.noRefund')}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '16px' }}>
              {t(`m.cancel.${parseTier(cancelling.booking.experience?.cancellationTier)}` as 'm.cancel.standard')} · <Link href="/policies/cancellation" style={{ color: 'var(--rum-text)', fontWeight: 600 }}>{t('m.cancel.fullPolicy')}</Link>
            </p>
            {sheetError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{sheetError}</p>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-tertiary" onClick={() => setCancelling(null)} disabled={busy} style={{ flex: 1 }}>{t('m.bookings.keep')}</button>
              <button className="btn btn-primary" onClick={confirmCancel} disabled={busy || cancelling.refund === null} style={{ flex: 2, background: 'var(--error)' }}>{t('m.bookings.confirmCancel')}</button>
            </div>
          </div>
        )}
      </div>

      {/* Reschedule */}
      <div className={`bottom-sheet-overlay ${moving ? 'open' : ''}`} onClick={() => !busy && setMoving(null)} />
      <div className={`bottom-sheet ${moving ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.bookings.reschedule')}>
        <div className="sheet-grabber" />
        {moving && (
          <div style={{ padding: '0 20px 24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '4px' }}>{t('m.bookings.rescheduleTitle', { name: moving.experience?.name ?? '' })}</h3>
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '14px' }}>{t('m.bookings.rescheduleNote')}</p>
            <label htmlFor="move-date" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '6px' }}>{t('m.book.date')}</label>
            <input id="move-date" type="date" min={jamaicaToday()} value={moveDate} onChange={e => setMoveDate(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', fontSize: '16px', fontFamily: 'inherit', color: 'var(--label-primary)', minHeight: '44px', marginBottom: '14px' }} />
            {moving.experience && moving.experience.startTimes.length > 0 && (
              <>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '6px' }}>{t('m.book.time')}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                  {moving.experience.startTimes.map(st => {
                    const s = slots?.find(x => x.time === st)
                    const ownSlot = dayKey(moving.date) === moveDate && moving.time === st
                    const left = s?.left == null ? null : s.left + (ownSlot ? moving.partySize : 0)
                    const off = Boolean(s && (s.past || s.closed || (left !== null && left < moving.partySize)))
                    return (
                      <button key={st} disabled={off || slots === null} aria-pressed={moveTime === st} className={`chip ${moveTime === st ? 'active' : ''}`} onClick={() => setMoveTime(st)} style={{ minHeight: '44px', flexDirection: 'column', alignItems: 'flex-start', gap: 0, opacity: off ? 0.45 : 1 }}>
                        <span>{timeLabel(st)}</span>
                        {s && (s.past ? <span style={{ fontSize: '11px' }}>{t('m.book.passed')}</span> : off ? <span style={{ fontSize: '11px' }}>{t('m.book.soldOut')}</span> : left !== null && left <= 10 ? <span style={{ fontSize: '11px', color: 'var(--warning)' }}>{t('m.book.spotsLeft', { n: left })}</span> : null)}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
            {sheetError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{sheetError}</p>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-tertiary" onClick={() => setMoving(null)} disabled={busy} style={{ flex: 1 }}>{t('m.book.cancel')}</button>
              <button className="btn btn-primary" onClick={confirmMove} disabled={busy || (Boolean(moving.experience?.startTimes.length) && !moveTime)} style={{ flex: 2 }}>{t('m.bookings.move')}</button>
            </div>
          </div>
        )}
      </div>
      <Dock />
    </main>
  )
}
