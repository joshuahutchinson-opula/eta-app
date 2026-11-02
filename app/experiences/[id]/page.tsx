// app/experiences/[id]/page.tsx — a curated experience's own page, laid out by
// ExperienceDetailView: hero, the route, the host, and sheets for reviews,
// what's included, meeting point & cancellation. Book (BookingSheet) or plan
// it with the crew.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Icon from '@/lib/icons'
import ErrorState from '@/components/ErrorState'
import BookingSheet, { type BookingDetails } from '@/components/BookingSheet'
import BackButton from '@/components/BackButton'
import ExperienceDetailView, { type DetailData } from '@/components/experiences/ExperienceDetailView'
import { useRegion } from '@/components/RegionProvider'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { shareOrCopy } from '@/lib/share'
import { hapticSaved, triggerHaptic } from '@/lib/haptics'
import { bookTripPaid, createTrip } from '@/lib/trip-client'
import { cacheTripForOffline } from '@/lib/trip-offline'
import { readSaved, toggleSaved } from '@/lib/saved'
import { absoluteUrl } from '@/lib/site-url'

interface StopView {
  order: number
  type: 'vendor' | 'photospot'
  id: string
  name: string
  image: string | null
  category: string | null
  lat: number
  lng: number
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
  cancellationTier: string
  capacityPerSlot: number | null
  gallery: string[]
  whatToBring: string[]
  accessibilityNotes: string | null
  guideLanguages: string[]
  reviewCount?: number
  startTimes: string[]
  maxPartySize: number | null
  totalMinutes: number
  rating: number | null
  moods: Array<{ id: string; name: string }>
  vendor: { id: string; name: string; image: string | null; video: string | null; neighborhood: string; isPremium: boolean; rating: number | null; reviewCount: number } | null
  accessibility: string[]
  stops: StopView[]
  reviews: Array<{ id: string; rating: number; comment: string | null; createdAt: string; user: { name: string; avatarUrl: string | null } }>
}

export default function ExperienceDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const searchParams = useSearchParams()
  const crew = (searchParams.get('crew') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const { t } = useLang()
  const errorText = useErrorText()
  const { town } = useRegion()
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
    if (!exp || planning) return
    setPlanning(true)
    setActionError(null)
    try {
      const trip = await createTrip({ name: exp.name, experienceId: exp.id, crew, city: exp.city })
      triggerHaptic('medium')
      router.push(`/experiences?trip=${trip.slug}`)
    } catch (e) {
      setActionError(errorText(e))
      setPlanning(false)
    }
  }

  const book = async (details: BookingDetails) => {
    if (!exp) throw new Error(t('m.err.generic'))
    const trip = await createTrip({ name: exp.name, experienceId: exp.id, crew, city: exp.city })
    const booked = await bookTripPaid(trip.slug, details)
    cacheTripForOffline(booked)
    setBookedSlug(trip.slug)
    return booked
  }

  const share = async () => {
    if (!exp) return
    if (await shareOrCopy({ title: exp.name, text: `${exp.name} — ${exp.tagline}`, url: absoluteUrl(`/experiences/${exp.id}`) }) === 'copied') {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  if (state === 'loading') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)' }}>
        <BackButton floating fallback="/experiences/browse" />
        <div className="skeleton-card" style={{ height: '340px', borderRadius: 0 }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
        <div style={{ padding: '16px' }}>
          <div className="skeleton-card" style={{ height: '200px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
        </div>
      </main>
    )
  }

  if (state !== 'ready' || !exp) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <BackButton floating fallback="/experiences/browse" />
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

  const hasMeeting = Boolean(exp.meetingPoint) || (exp.meetingLat !== null && exp.meetingLng !== null)
  const data: DetailData = {
    name: exp.name,
    image: exp.imageUrl,
    video: exp.videoUrl,
    gallery: exp.gallery,
    rating: exp.rating,
    reviewCount: exp.reviewCount ?? exp.reviews.length,
    minutes: exp.totalMinutes || null,
    stops: exp.stops.map(s => ({ id: s.id, type: s.type, name: s.name, lat: s.lat ?? null, lng: s.lng ?? null, minutes: s.plannedDuration })),
    host: exp.vendor ? { id: exp.vendor.id, name: exp.vendor.name, image: exp.vendor.image, video: exp.vendor.video ?? null, isPremium: exp.vendor.isPremium } : null,
    reviews: exp.reviews,
    reviewsHref: (exp.reviewCount ?? 0) > exp.reviews.length ? `/experiences/${exp.id}/reviews` : null,
    included: exp.included,
    whatToBring: exp.whatToBring,
    languages: exp.guideLanguages,
    groupSize: exp.capacityPerSlot,
    accessibility: exp.accessibility,
    accessibilityNotes: exp.accessibilityNotes,
    meeting: hasMeeting ? { text: exp.meetingPoint, lat: exp.meetingLat, lng: exp.meetingLng } : null,
    cancellation: { tier: exp.cancellationTier, note: exp.cancellationPolicy },
    price: exp.price,
    estimate: false
  }

  return (
    <>
      <ExperienceDetailView
        data={data}
        fallbackCenter={[town.lat, town.lng]}
        backFallback="/experiences/browse"
        saved={saved}
        onToggleSave={() => { hapticSaved(); setSaved(toggleSaved('experiences', exp.id)) }}
        onShare={share}
        shareCopied={copied}
        onBook={() => setBookingOpen(true)}
        onPlanWithCrew={planWithCrew}
        planning={planning}
        actionError={actionError}
      />
      <BookingSheet
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        title={exp.name}
        unitPrice={exp.price}
        startTimes={exp.startTimes}
        maxPartySize={exp.maxPartySize}
        experienceId={exp.id}
        cancellationTier={exp.cancellationTier}
        cancellationNote={exp.cancellationPolicy}
        defaultPartySize={1 + crew.length}
        onConfirm={book}
        onDone={() => { setBookingOpen(false); router.push(bookedSlug ? `/experiences?trip=${bookedSlug}` : '/bookings') }}
      />
    </>
  )
}
