// app/accommodations/[id]/page.tsx — a stay: photos, amenities, then
// booking with a date range, guest count, nightly price × nights and an
// availability check before paying (ETA Wallet placeholder).
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import Price from '@/components/Price'
import ErrorState from '@/components/ErrorState'
import { authHeaders } from '@/lib/api-client'
import { getCurrentUser, setCurrentUser } from '@/lib/auth-client'
import { useLang } from '@/lib/i18n-client'
import { jamaicaToday, nightsBetween, priceBreakdown } from '@/lib/pricing'
import { hapticBookingConfirmed, triggerHaptic } from '@/lib/haptics'
import { formatCity } from '@/lib/format'

interface Accommodation {
  id: string
  name: string
  type: string
  googleStars: number
  description: string
  amenities: string[]
  priceRange: string
  city: string
  media: Array<{ type: string; url: string }>
  roomViews: string[]
  nightlyPrice: number | null
  maxGuests: number | null
}

type Availability = { state: 'idle' | 'checking' } | { state: 'done'; available: boolean; unavailable: string[] } | { state: 'error'; message: string }

const TYPE_LABEL: Record<string, string> = { ALL_INCLUSIVE: 'All-Inclusive', A_LA_CARTE: 'À la carte', VILLA: 'Villa' }

export default function AccommodationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { t, lang } = useLang()
  const [accom, setAccom] = useState<Accommodation | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notFound' | 'error'>('loading')
  const [checkIn, setCheckIn] = useState(jamaicaToday(7))
  const [checkOut, setCheckOut] = useState(jamaicaToday(10))
  const [guests, setGuests] = useState(2)
  const [availability, setAvailability] = useState<Availability>({ state: 'idle' })
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [booked, setBooked] = useState<{ transactionId: string } | null>(null)

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

  const nights = nightsBetween(checkIn, checkOut)

  // Re-check whenever the dates change.
  useEffect(() => {
    if (!accom || nights <= 0) { setAvailability({ state: 'idle' }); return }
    let cancelled = false
    setAvailability({ state: 'checking' })
    fetch(`/api/accommodations/${accom.id}/availability?checkIn=${checkIn}&checkOut=${checkOut}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (cancelled) return
        setAvailability(ok ? { state: 'done', available: d.available, unavailable: d.unavailable ?? [] } : { state: 'error', message: d.error ?? 'Sumth nah wuk' })
      })
      .catch(() => { if (!cancelled) setAvailability({ state: 'error', message: t('m.error.body') }) })
    return () => { cancelled = true }
  }, [accom, checkIn, checkOut, nights, t])

  const book = async () => {
    if (!accom) return
    if (!getCurrentUser()) { router.push('/login'); return }
    setPaying(true)
    setPayError(null)
    try {
      const res = await fetch(`/api/accommodations/${accom.id}/book`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ checkIn, checkOut, guests })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sumth nah wuk')
      const u = getCurrentUser()
      if (u && typeof data.walletBalance === 'number') setCurrentUser({ ...u, walletBalance: data.walletBalance })
      hapticBookingConfirmed()
      setBooked({ transactionId: data.transactionId })
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Sumth nah wuk')
    } finally {
      setPaying(false)
    }
  }

  const backButton = (
    <button onClick={() => router.back()} aria-label="Back" style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 16px)', left: '16px', zIndex: 10, width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(15,14,12,0.5)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
      <Icon name="back" size={16} />
    </button>
  )

  if (state === 'loading') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)' }}>
        <div className="skeleton-card" style={{ height: '280px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
      </main>
    )
  }
  if (state !== 'ready' || !accom) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', position: 'relative' }}>
        {backButton}
        {state === 'error' ? <ErrorState onRetry={load} /> : <div className="empty-state"><p style={{ fontSize: '17px', fontWeight: 600 }}>Nuttin nuh go suh</p></div>}
      </main>
    )
  }

  const maxGuests = accom.maxGuests ?? 10
  const price = accom.nightlyPrice != null && nights > 0 ? priceBreakdown(accom.nightlyPrice, nights) : null
  const locale = lang === 'en' ? 'en-US' : lang
  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', fontSize: '16px', fontFamily: 'inherit', color: 'var(--label-primary)', minHeight: '44px' }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', position: 'relative', paddingBottom: '40px' }}>
      {backButton}
      <div style={{ position: 'relative', height: '280px' }}>
        <img src={accom.media?.[0]?.url || ''} alt={accom.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(15,14,12,0.9))' }} />
        <div style={{ position: 'absolute', bottom: '14px', left: '16px', right: '16px', color: 'white' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>{accom.name}</h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>★ {accom.googleStars} · {TYPE_LABEL[accom.type] ?? accom.type} · {formatCity(accom.city)}</p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>{accom.description}</p>

        <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px', color: 'var(--label-primary)' }}>{t('m.stay.amenities')}</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {accom.amenities.map(a => (
            <span key={a} style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--label-primary)', background: 'var(--system-bg-elevated)', boxShadow: 'var(--shadow-card)', borderRadius: 'var(--radius-full)' }}>{a}</span>
          ))}
        </div>

        {accom.roomViews.length > 0 && (
          <>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px', color: 'var(--label-primary)' }}>{t('m.stay.roomView')}</h2>
            <div className="horizontal-scroll" style={{ marginBottom: '12px' }}>
              {accom.roomViews.map((v, i) => <img key={i} src={v} alt={`Room view ${i + 1}`} style={{ width: '200px', height: '140px', objectFit: 'cover', borderRadius: '12px', flexShrink: 0 }} />)}
            </div>
          </>
        )}

        <section className="card" style={{ padding: '16px', cursor: 'default' }} aria-labelledby="book-stay">
          <h2 id="book-stay" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '4px' }}>{t('m.stay.book')}</h2>
          {accom.nightlyPrice != null ? (
            <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '16px' }}>
              <Price usd={accom.nightlyPrice} style={{ fontWeight: 700, color: 'var(--rum-text)' }} /> {t('m.stay.perNight')}
            </p>
          ) : (
            <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '16px' }}>{t('m.stay.noPrice')}</p>
          )}

          {booked ? (
            <div style={{ textAlign: 'center' }}>
              <div className="check-pop-in" style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}><Icon name="check" size={22} /></div>
              <p style={{ fontSize: '17px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '12px' }}>{t('m.book.booked')}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Link href="/bookings" className="btn btn-secondary" style={{ flex: 1, textDecoration: 'none' }}>{t('m.book.ticket')}</Link>
                <Link href={`/receipt/${booked.transactionId}`} className="btn btn-secondary" style={{ flex: 1, textDecoration: 'none' }}>{t('m.book.receipt')}</Link>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)' }}>
                  {t('m.stay.checkIn')}
                  <input type="date" min={jamaicaToday()} value={checkIn} onChange={e => { setCheckIn(e.target.value); if (e.target.value >= checkOut) setCheckOut(new Date(Date.parse(`${e.target.value}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)) }} style={{ ...inputStyle, marginTop: '6px' }} />
                </label>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)' }}>
                  {t('m.stay.checkOut')}
                  <input type="date" min={checkIn} value={checkOut} onChange={e => setCheckOut(e.target.value)} style={{ ...inputStyle, marginTop: '6px' }} />
                </label>
              </div>

              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '6px' }}>{t('m.stay.guests')}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <button className="heart-btn" aria-label={t('m.book.fewer')} disabled={guests <= 1} onClick={() => { triggerHaptic('selection'); setGuests(g => Math.max(1, g - 1)) }} style={{ fontSize: '22px', fontWeight: 600, color: 'var(--label-primary)' }}>−</button>
                <span className="num-font" aria-live="polite" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)' }}>{guests}</span>
                <button className="heart-btn" aria-label={t('m.book.more')} disabled={guests >= maxGuests} onClick={() => { triggerHaptic('selection'); setGuests(g => Math.min(maxGuests, g + 1)) }} style={{ fontSize: '22px', fontWeight: 600, color: 'var(--label-primary)' }}>+</button>
                {accom.maxGuests ? <span style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{t('m.book.maxParty', { n: accom.maxGuests })}</span> : null}
              </div>

              <div role="status" style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: availability.state === 'done' ? (availability.available ? 'var(--success)' : 'var(--error)') : 'var(--label-secondary)' }}>
                {nights <= 0 ? t('m.stay.pickDates')
                  : availability.state === 'checking' ? t('m.stay.checking')
                  : availability.state === 'error' ? availability.message
                  : availability.state === 'done' && availability.available ? <><Icon name="check" size={14} /> {t('m.stay.available', { n: nights })}</>
                  : availability.state === 'done' ? t('m.stay.unavailable', { dates: availability.unavailable.map(d => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { month: 'short', day: 'numeric' })).join(', ') })
                  : null}
              </div>

              {price && (
                <div style={{ borderTop: '0.5px solid var(--separator)', paddingTop: '8px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '15px', color: 'var(--label-secondary)' }}>
                    <span><Price usd={price.unitPrice} compact /> × {t('m.stay.nights', { n: nights })}</span><Price usd={price.subtotal} compact />
                  </div>
                  {price.fees > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '15px', color: 'var(--label-secondary)' }}>
                      <span>{t('m.book.fees')}</span><Price usd={price.fees} compact />
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '17px', fontWeight: 700, color: 'var(--label-primary)' }}>
                    <span>{t('m.book.total')}</span><Price usd={price.total} />
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--label-secondary)' }}><Icon name="wallet" size={12} /> {t('m.book.payWallet')} · {t('m.book.placeholder')}</p>
                </div>
              )}

              {payError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{payError}</p>}
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={book}
                disabled={paying || !price || availability.state !== 'done' || !availability.available}
              >
                {paying ? '…' : price ? <>{t('m.book.pay')} <Price usd={price.total} compact /></> : t('m.stay.book')}
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
