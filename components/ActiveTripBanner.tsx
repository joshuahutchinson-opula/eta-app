// components/ActiveTripBanner.tsx — the booking happening around now.
// Before it starts: "Starts in X min". Once it's under way: the real ETA
// from where you are to the next stop on the trip (straight-line estimate
// by travel mode, lib/routing.ts), or "Happening now" when there's no stop
// or location to measure from.
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { pressable } from '@/lib/pressable'
import { useLang } from '@/lib/i18n-client'
import { useWatchedLocation } from '@/lib/geo'
import { estimateMinutes, haversineKm, MAX_WALK_KM } from '@/lib/routing'
import { tripApi, type TripView } from '@/lib/trip-client'

interface Props {
  title: string
  start: string
  tripSlug?: string | null
  /** Where tapping goes. */
  href: string
}

export default function ActiveTripBanner({ title, start, tripSlug, href }: Props) {
  const router = useRouter()
  const { t } = useLang()
  const [dismissed, setDismissed] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [trip, setTrip] = useState<TripView | null>(null)
  const started = now >= Date.parse(start)
  const me = useWatchedLocation(started && Boolean(tripSlug))

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!started || !tripSlug) return
    tripApi(tripSlug, '').then(setTrip).catch(() => {})
  }, [started, tripSlug])

  if (dismissed) return null

  const next = trip?.stops[trip.currentStopIndex] ?? null
  let big: string
  let sub: string
  if (!started) {
    const mins = Math.max(1, Math.round((Date.parse(start) - now) / 60000))
    big = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`
    sub = mins < 60 ? t('m.trip.startsInMin', { n: mins }) : t('m.trip.startsInHours', { h: Math.floor(mins / 60), m: mins % 60 })
  } else if (next && next.lat !== null && next.lng !== null && me) {
    const km = haversineKm(me, { lat: next.lat, lng: next.lng })
    const mins = estimateMinutes(km, km <= MAX_WALK_KM ? 'WALKING' : 'TAXI')
    big = `${mins}m`
    sub = t('m.trip.etaTo', { n: mins, name: next.name })
  } else {
    big = '•'
    sub = next ? t('m.trip.next', { name: next.name }) : t('m.trip.happeningNow')
  }

  const go = () => router.push(href)

  return (
    <div className="active-trip-banner" onClick={go} {...pressable(go)} aria-label={`${title} — ${sub}`}>
      <div className="active-trip-banner-content">
        <span className="active-trip-banner-eta num-font">{big}</span>
        <div className="active-trip-banner-text">
          <p className="active-trip-banner-title">{title}</p>
          <p className="active-trip-banner-sub">{sub}</p>
        </div>
        <button className="active-trip-banner-dismiss" onClick={e => { e.stopPropagation(); setDismissed(true) }} aria-label={t('m.trip.dismiss')}>
          <Icon name="close" size={12} />
        </button>
      </div>
    </div>
  )
}
