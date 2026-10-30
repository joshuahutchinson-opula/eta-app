// app/experiences/[id]/page.tsx — a curated experience's own page: the route,
// what's included, where to meet, who hosts it, reviews and the cancellation
// policy, then booking (BookingSheet) or planning it with the crew.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Icon from '@/lib/icons'
import Price from '@/components/Price'
import ErrorState from '@/components/ErrorState'
import BookingSheet, { type BookingDetails } from '@/components/BookingSheet'
import { useLang } from '@/lib/i18n-client'
import { formatCity } from '@/lib/format'
import { shareOrCopy } from '@/lib/share'
import { triggerHaptic } from '@/lib/haptics'
import { bookTripPaid, createTrip } from '@/lib/trip-client'
import { cacheTripForOffline } from '@/lib/trip-offline'
import { readSaved, toggleSaved } from '@/lib/saved'
import { hapticSaved } from '@/lib/haptics'

interface StopView {
  order: number
  type: 'vendor' | 'photospot'
  id: string
  name: string
  image: string | null
  category: string | null
  plannedDuration: number
  transportModeToNext: 'WALKING' | 'TAXI' | 'BOAT' | null
  transportDurationToNext: number | null
}

interface ExperienceDetail {
  id: string
  name: string
  tagline: string
  price: number
  imageUrl: string
  videoUrl: string | null
  city: string
  startLocation: string
  included: string[]
  meetingPoint: string | null
  meetingLat: number | null
  meetingLng: number | null
  cancellationPolicy: string | null
  startTimes: string[]
  maxPartySize: number | null
  totalMinutes: number
  rating: number | null
  bookedToday: number
  moods: Array<{ id: string; name: string }>
  vendor: { id: string; name: string; image: string | null; neighborhood: string; isPremium: boolean; rating: number | null; reviewCount: number } | null
  stops: StopView[]
  reviews: Array<{ id: string; rating: number; comment: string | null; createdAt: string; user: { name: string; avatarUrl: string | null } }>
}

function durationLabel(minutes: number): string | null {
  if (minutes <= 0) return null
  if (minutes < 90) return `${minutes} min`
  return `${Math.round(minutes / 30) / 2} hrs`
}

export default function ExperienceDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const searchParams = useSearchParams()
  const crew = (searchParams.get('crew') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const { t } = useLang()
  const [exp, setExp] = useState<ExperienceDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notFound' | 'error'>('loading')
  const [bookingOpen, setBookingOpen] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [bookedSlug, setBookedSlug] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => { setSaved(readSaved('experiences').includes(id)) }, [id])

  const load = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch(`/api/experiences/${id}`)
      if (res.status === 404) return setState('notFound')
      if (!res.ok) throw new Error()
      setExp(await res.json())
      setState('ready')
    } catch {
      setState('error')
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const planWithCrew = async () => {
    if (!exp) return
    setPlanning(true)
    setActionError(null)
    try {
      const trip = await createTrip({ name: exp.name, experienceId: exp.id, crew, city: exp.city })
      triggerHaptic('medium')
      router.push(`/experiences?trip=${trip.slug}`)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Sumth nah wuk')
      setPlanning(false)
    }
  }

  const book = async (details: BookingDetails) => {
    if (!exp) throw new Error('Sumth nah wuk')
    const trip = await createTrip({ name: exp.name, experienceId: exp.id, crew, city: exp.city })
    const booked = await bookTripPaid(trip.slug, details)
    cacheTripForOffline(booked)
    setBookedSlug(trip.slug)
    return booked
  }

  const share = async () => {
    if (!exp) return
    if (await shareOrCopy({ title: exp.name, text: `${exp.name} — ${exp.tagline}`, url: window.location.href }) === 'copied') {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  const backButton = (
    <button onClick={() => router.back()} aria-label="Back" style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: '16px', zIndex: 20, width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
      <Icon name="back" size={18} />
    </button>
  )

  if (state === 'loading') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)' }}>
        {backButton}
        <div className="skeleton-card" style={{ height: '46vh' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
        <div style={{ padding: '16px' }}>
          <div className="skeleton-card" style={{ height: '120px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
        </div>
      </main>
    )
  }

  if (state !== 'ready' || !exp) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        {backButton}
        {state === 'error' ? <ErrorState onRetry={load} /> : (
          <div className="empty-state">
            <Icon name="compass" size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.exp.notFound')}</p>
            <Link href="/experiences/browse" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('m.exp.browseAll')}</Link>
          </div>
        )}
      </main>
    )
  }

  const duration = durationLabel(exp.totalMinutes)
  const hasMeetingMap = exp.meetingLat !== null && exp.meetingLng !== null
  const mapSrc = hasMeetingMap
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${[exp.meetingLng! - 0.006, exp.meetingLat! - 0.004, exp.meetingLng! + 0.006, exp.meetingLat! + 0.004].join(',')}&layer=mapnik&marker=${exp.meetingLat},${exp.meetingLng}`
    : null

  return (
    <main className="screen-push-in" style={{ minHeight: '100dvh', background: '#0F0E0C', paddingBottom: '110px' }}>
      {backButton}
      <button onClick={share} aria-label={t('m.events.share')} style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', right: '16px', zIndex: 20, height: '44px', minWidth: '44px', padding: '0 12px', borderRadius: '999px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'white', fontSize: '13px', fontWeight: 600 }}>
        <Icon name="share" size={16} />{copied ? t('m.events.linkCopied') : null}
      </button>

      <div style={{ height: '46vh', minHeight: '280px', position: 'relative', overflow: 'hidden' }}>
        {exp.videoUrl ? (
          <video src={exp.videoUrl} poster={exp.imageUrl} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <img src={exp.imageUrl} alt={exp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,14,12,0.35) 0%, transparent 30%, rgba(15,14,12,0.55) 75%, #0F0E0C 100%)' }} />
        <div style={{ position: 'absolute', bottom: '28px', left: '16px', right: '16px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{exp.name}</h1>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>{exp.tagline}</p>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <span><Icon name="mapPin" size={12} /> {formatCity(exp.city)}</span>
            {exp.stops.length > 0 && <span>{t('m.exp.stops', { n: exp.stops.length })}</span>}
            {duration && <span><Icon name="clock" size={12} /> {duration}</span>}
            {exp.rating && <span style={{ color: 'var(--gold)' }}>★ <span className="num-font">{exp.rating}</span></span>}
          </p>
          {exp.bookedToday > 0 && (
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>{t('m.exp.bookedToday', { n: exp.bookedToday })}</p>
          )}
        </div>
      </div>

      <div style={{ background: 'var(--system-bg-elevated)', borderRadius: '20px 20px 0 0', marginTop: '-20px', position: 'relative', zIndex: 2, padding: '20px 16px 24px', minHeight: '50vh' }}>
        <div className="sheet-grabber" />

        {exp.stops.length > 0 && (
          <section style={{ marginBottom: '28px' }}>
            <div className="section-header"><div className="section-heading"><span className="section-eyebrow">{t('m.exp.yourRoute')}</span><span className="section-title">{t('m.exp.timeline')}</span></div></div>
            {exp.stops.map((s, i) => (
              <div key={`${s.id}-${i}`}>
                <Link href={s.type === 'vendor' ? `/vendor/${s.id}` : `/photospot/${s.id}`} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', textDecoration: 'none' }}>
                  {s.image ? <img src={s.image} alt="" style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover' }} /> : <span style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'var(--system-bg-secondary)' }} />}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: 'var(--label-primary)' }}>{s.name}</span>
                    <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>
                      {s.plannedDuration} min{s.type === 'photospot' ? ` · ${t('m.exp.photoSpot')}` : ''}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
                </Link>
                {s.transportModeToNext && i < exp.stops.length - 1 && (
                  <p style={{ fontSize: '13px', color: 'var(--label-secondary)', padding: '8px 0 8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name="route" size={12} /> {t(`exp.mode.${s.transportModeToNext}` as 'exp.mode.WALKING')}{s.transportDurationToNext ? ` · ${s.transportDurationToNext} min` : ''}
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        {exp.included.length > 0 && (
          <section style={{ marginBottom: '28px' }}>
            <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.exp.included')}</span></div></div>
            <ul className="card" style={{ listStyle: 'none', padding: '4px 16px', cursor: 'default' }}>
              {exp.included.map((item, i) => (
                <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 0', borderBottom: i < exp.included.length - 1 ? '0.5px solid var(--separator)' : 'none', fontSize: '15px', color: 'var(--label-primary)' }}>
                  <Icon name="check" size={16} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '2px' }} />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section style={{ marginBottom: '28px' }}>
          <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.exp.meetingPoint')}</span></div></div>
          <div className="card" style={{ overflow: 'hidden', cursor: 'default' }}>
            {mapSrc && <iframe src={mapSrc} title={t('m.exp.meetingPoint')} loading="lazy" tabIndex={-1} style={{ width: '100%', height: '170px', border: 0, pointerEvents: 'none', display: 'block' }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px' }}>
              <Icon name="mapPin" size={18} style={{ color: 'var(--rum-text)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '15px', color: exp.meetingPoint ? 'var(--label-primary)' : 'var(--label-secondary)' }}>{exp.meetingPoint ?? t('m.common.notListed')}</span>
              {hasMeetingMap && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${exp.meetingLat},${exp.meetingLng}`} target="_blank" rel="noopener noreferrer" className="section-link" style={{ minHeight: '36px' }}>{t('m.events.directions')}</a>
              )}
            </div>
          </div>
        </section>

        {exp.vendor && (
          <section style={{ marginBottom: '28px' }}>
            <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.exp.host')}</span></div></div>
            <Link href={`/vendor/${exp.vendor.id}`} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', textDecoration: 'none' }}>
              {exp.vendor.image ? <img src={exp.vendor.image} alt="" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }} /> : <span style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--system-bg-secondary)' }} />}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)' }}>
                  {exp.vendor.name}
                  {exp.vendor.isPremium && <span className="chip" style={{ minHeight: '22px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}><Icon name="crown" size={10} /> B.O.N</span>}
                </span>
                <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>
                  {exp.vendor.neighborhood}
                  {exp.vendor.rating ? ` · ★ ${exp.vendor.rating} (${exp.vendor.reviewCount})` : ''}
                </span>
              </span>
              <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
            </Link>
          </section>
        )}

        <section style={{ marginBottom: '28px' }}>
          <div className="section-header"><div className="section-heading"><span className="section-title">{t('vendor.reviews')}</span></div></div>
          {exp.reviews.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--label-secondary)' }}>{t('common.noReviews')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {exp.reviews.slice(0, 6).map(r => (
                <div key={r.id} className="card" style={{ padding: '12px', cursor: 'default' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    {r.user.avatarUrl ? <img src={r.user.avatarUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} /> : <Icon name="user" size={18} style={{ color: 'var(--label-tertiary)' }} />}
                    <span style={{ flex: 1, fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{r.user.name}</span>
                    <span aria-label={`${r.rating} out of 5`} style={{ color: 'var(--gold)', fontSize: '13px' }}>{'★'.repeat(r.rating)}<span style={{ color: 'var(--label-tertiary)' }}>{'★'.repeat(5 - r.rating)}</span></span>
                  </div>
                  {r.comment && <p style={{ fontSize: '14px', color: 'var(--label-secondary)', lineHeight: 1.4 }}>{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.exp.cancellation')}</span></div></div>
          <p style={{ fontSize: '15px', lineHeight: 1.5, color: exp.cancellationPolicy ? 'var(--label-primary)' : 'var(--label-secondary)' }}>{exp.cancellationPolicy ?? t('m.common.notListed')}</p>
        </section>
      </div>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, background: 'var(--system-bg-elevated)', borderTop: '0.5px solid var(--separator)', padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))', boxShadow: 'var(--shadow-sheet)' }}>
        {actionError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{actionError}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ marginRight: 'auto' }}>
            <Price usd={exp.price} style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)' }} />
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)' }}>{t('exp.perPerson')}</p>
          </div>
          <button className="heart-btn" onClick={() => { hapticSaved(); setSaved(toggleSaved('experiences', exp.id)) }} aria-label={saved ? t('m.saved.unsave') : t('m.saved.save')} aria-pressed={saved} style={{ color: saved ? 'var(--rum)' : 'var(--label-secondary)' }}>
            <Icon name="heart" size={20} className={saved ? 'filled' : ''} />
          </button>
          <button className="btn btn-secondary" onClick={planWithCrew} disabled={planning} style={{ padding: '0 12px' }}>
            <Icon name="users" size={16} /> {planning ? '…' : t('m.detail.planWithCrew')}
          </button>
          <button className="btn btn-primary" onClick={() => { triggerHaptic('light'); setBookingOpen(true) }}>{t('m.detail.book')}</button>
        </div>
      </div>

      <BookingSheet
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        title={exp.name}
        unitPrice={exp.price}
        startTimes={exp.startTimes}
        maxPartySize={exp.maxPartySize}
        defaultPartySize={1 + crew.length}
        onConfirm={book}
        onDone={() => { setBookingOpen(false); router.push(bookedSlug ? `/experiences?trip=${bookedSlug}` : '/bookings') }}
      />
    </main>
  )
}
