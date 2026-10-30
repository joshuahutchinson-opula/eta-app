// app/bookings/page.tsx — My Bookings, which doubles as the My Trip
// timeline: upcoming bookings grouped by day, then past ones, each with its
// status, a ticket (QR) to show on arrival, its receipts, and a way into the
// active trip or its recap. Only the signed-in traveler's bookings.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import Price from '@/components/Price'
import QRCode from '@/components/QRCode'
import ErrorState from '@/components/ErrorState'
import { authHeaders } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { useLang } from '@/lib/i18n-client'
import { bookingCode } from '@/lib/pricing'
import { triggerHaptic } from '@/lib/haptics'

interface BookingRow {
  id: string
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
  date: string
  endDate: string | null
  time: string | null
  partySize: number
  totalPrice: number
  pointsEarned: number
  experience: { id: string; name: string; imageUrl: string; meetingPoint: string | null } | null
  vendor: { id: string; name: string; images: string[]; neighborhood: string } | null
  accommodation: { id: string; name: string; media: Array<{ url: string }> } | null
  trip: { slug: string; status: string; name: string } | null
  transactions: Array<{ id: string; amount: number; status: string; createdAt: string }>
}

const TZ = 'America/Jamaica'
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })

function titleOf(b: BookingRow) {
  return b.experience?.name ?? b.accommodation?.name ?? b.vendor?.name ?? b.trip?.name ?? 'Booking'
}

function imageOf(b: BookingRow) {
  return b.experience?.imageUrl ?? b.accommodation?.media?.[0]?.url ?? b.vendor?.images?.[0] ?? null
}

export default function MyBookingsPage() {
  const router = useRouter()
  const { t, lang } = useLang()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [bookings, setBookings] = useState<BookingRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [ticket, setTicket] = useState<BookingRow | null>(null)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const res = await fetch('/api/bookings', { headers: authHeaders() })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setBookings(Array.isArray(data) ? data : [])
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    const user = getCurrentUser()
    setSignedIn(Boolean(user))
    if (user) load()
  }, [load])

  const locale = lang === 'en' ? 'en-US' : lang
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const all = bookings ?? []
  const upcoming = all.filter(b => (b.status === 'CONFIRMED' || b.status === 'PENDING') && dayKey(b.endDate ?? b.date) >= today)
  const past = all.filter(b => !upcoming.includes(b)).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  const byDay = Array.from(upcoming.reduce((m, b) => m.set(dayKey(b.date), [...(m.get(dayKey(b.date)) ?? []), b]), new Map<string, BookingRow[]>()))

  const dayHeading = (key: string) => {
    if (key === today) return t('m.bookings.today')
    if (key === new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: TZ })) return t('m.bookings.tomorrow')
    return new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })
  }

  const statusChip = (s: BookingRow['status']) => {
    const color = s === 'CONFIRMED' ? 'var(--success)' : s === 'PENDING' ? 'var(--warning)' : s === 'CANCELLED' ? 'var(--error)' : 'var(--label-secondary)'
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
        {t(`m.bookings.status.${s}` as 'm.bookings.status.CONFIRMED')}
      </span>
    )
  }

  const card = (b: BookingRow) => {
    const img = imageOf(b)
    const when = b.accommodation && b.endDate
      ? `${new Date(b.date).toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: TZ })} → ${new Date(b.endDate).toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: TZ })}`
      : new Date(b.date).toLocaleString(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ })
    const tripLive = b.trip && (b.trip.status === 'BOOKED')
    const recap = b.trip && b.trip.status === 'COMPLETED'
    return (
      <div key={b.id} className="card" style={{ padding: '12px', cursor: 'default', marginBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {img ? <img src={img} alt="" style={{ width: '64px', height: '64px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} /> : <span style={{ width: '64px', height: '64px', borderRadius: '10px', background: 'var(--system-bg-secondary)', flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(b)}</p>
            <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>
              {when} · {b.accommodation ? t('m.bookings.guests', { n: b.partySize }) : t('m.bookings.people', { n: b.partySize })}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              {statusChip(b.status)}
              <Price usd={b.totalPrice} compact style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-primary)' }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
          {b.status !== 'CANCELLED' && (
            <button className="chip" onClick={() => { triggerHaptic('light'); setTicket(b) }} style={{ minHeight: '36px', padding: '6px 12px', fontSize: '14px' }}>
              <Icon name="journal" size={14} /> {t('m.bookings.ticket')}
            </button>
          )}
          {b.transactions.map((tx, i) => (
            <Link key={tx.id} href={`/receipt/${tx.id}`} className="chip" style={{ minHeight: '36px', padding: '6px 12px', fontSize: '14px', textDecoration: 'none' }}>
              <Icon name="receipt" size={14} /> {b.transactions.length > 1 ? `${t('m.bookings.receipt')} ${i + 1}` : t('m.bookings.receipt')}
            </Link>
          ))}
          {tripLive && (
            <Link href={`/experiences?trip=${b.trip!.slug}`} className="chip active" style={{ minHeight: '36px', padding: '6px 12px', fontSize: '14px', textDecoration: 'none' }}>
              <Icon name="route" size={14} /> {t('m.bookings.openTrip')}
            </Link>
          )}
          {recap && (
            <Link href={`/trip/${b.trip!.slug}/recap`} className="chip" style={{ minHeight: '36px', padding: '6px 12px', fontSize: '14px', textDecoration: 'none' }}>
              <Icon name="sparkle" size={14} /> {t('m.bookings.recap')}
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => router.back()} aria-label="Back" style={{ width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: 'var(--system-bg-elevated)', boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--label-primary)' }}>
          <Icon name="back" size={16} />
        </button>
        <div className="section-heading">
          <span className="section-eyebrow">{t('m.bookings.eyebrow')}</span>
          <h1 className="section-title">{t('m.profile.bookings')}</h1>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {signedIn === false ? (
          <div className="empty-state">
            <Icon name="user" size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.bookings.loginTitle')}</p>
            <Link href="/login" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('m.profile.login')}</Link>
          </div>
        ) : failed ? (
          <ErrorState onRetry={load} />
        ) : bookings === null ? (
          [0, 1].map(i => <div key={i} className="skeleton-card" style={{ height: '120px', marginBottom: '10px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>)
        ) : all.length === 0 ? (
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
            {past.length > 0 && (
              <>
                <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.bookings.past')}</span></div></div>
                {past.map(card)}
              </>
            )}
          </>
        )}
      </div>

      <div className={`bottom-sheet-overlay ${ticket ? 'open' : ''}`} onClick={() => setTicket(null)} />
      <div className={`bottom-sheet ${ticket ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.bookings.ticket')}>
        <div className="sheet-grabber" />
        {ticket && (
          <div style={{ padding: '0 20px 24px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '4px' }}>{titleOf(ticket)}</h3>
            <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '16px' }}>
              {new Date(ticket.date).toLocaleString(locale, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ })} · {t('m.bookings.people', { n: ticket.partySize })}
            </p>
            <QRCode value={bookingCode(ticket.id)} size={220} label={t('m.bookings.ticketQr')} />
            <p className="num-font" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--label-primary)', letterSpacing: '0.06em', marginTop: '12px' }}>{bookingCode(ticket.id)}</p>
            <p style={{ fontSize: '13px', color: 'var(--label-secondary)', margin: '4px 0 16px' }}>{t('m.bookings.showOnArrival')}</p>
            {ticket.experience?.meetingPoint && (
              <p style={{ fontSize: '14px', color: 'var(--label-primary)', marginBottom: '16px' }}><Icon name="mapPin" size={14} /> {ticket.experience.meetingPoint}</p>
            )}
            <button className="btn btn-tertiary" onClick={() => setTicket(null)} style={{ width: '100%' }}>{t('m.profile.done')}</button>
          </div>
        )}
      </div>
      <Dock />
    </main>
  )
}
