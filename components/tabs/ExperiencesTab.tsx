// components/tabs/ExperiencesTab.tsx — the Experiences tab (route
// /experiences, kept alive by components/TabKeeper). Home (plan my day, your
// trip, tonight's events, moods) → Quick planner → Results (three options) →
// (Home's mood tiles open /experiences?mood=<id>, straight to its results) →
// route detail; plus the Discover map, crew trip planning and the active trip.
'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import { type MapVendor, type MapPhotoSpot } from '@/lib/map-types'
import { hapticBookingConfirmed, triggerHaptic } from '@/lib/haptics'
import { getCurrentUser } from '@/lib/auth-client'
import { authHeaders } from '@/lib/api-client'
import BookingSheet, { type BookingDetails, type BookingResult } from '@/components/BookingSheet'
import TripMap from '@/components/TripMap'
import Price from '@/components/Price'
import { useWatchedLocation } from '@/lib/geo'
import { estimateMinutes, haversineKm } from '@/lib/routing'
import { shareOrCopy } from '@/lib/share'
import TripPlanner from '@/components/TripPlanner'
import { bookTripPaid, createTrip, createViewLink, fetchMyTrips, tripApi, type TripView } from '@/lib/trip-client'
import { useErrorText, useLang, usePatois } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { directionsUrl } from '@/lib/calendar'
import { MAX_WALK_KM } from '@/lib/routing'
import { absoluteUrl } from '@/lib/site-url'
import BackButton from '@/components/BackButton'
import CrewChat from '@/components/CrewChat'
import ShareLocationToggle from '@/components/ShareLocationToggle'
import Img from '@/components/Img'
import type { DictKey } from '@/lib/i18n'
import { useRegion } from '@/components/RegionProvider'
import { vibeMoodNames } from '@/lib/vibes'
import type { GeneratedBundle } from '@/lib/experience-generator'
import { cacheTripForOffline, clearTripCache, getActiveCachedTrip, getCachedTrip, updateCachedTrip, useOnline } from '@/lib/trip-offline'
import { defaultPlan, generateBody, localShare, optionBadges, shortDuration, TIMES, whyItFits, type MoodItem, type PlanAnchor, type PlanInput } from '@/lib/plan'
import ExperiencesHome, { type YourTripRow } from '@/components/experiences/ExperiencesHome'
import QuickPlanner from '@/components/experiences/QuickPlanner'
import ResultsCarousel, { type ResultOption } from '@/components/experiences/ResultsCarousel'
import ExperienceDetailView, { type DetailData } from '@/components/experiences/ExperienceDetailView'
import DiscoverView from '@/components/experiences/DiscoverView'
import type { TabMode } from '@/components/experiences/PlanDiscoverSwitch'
import { useTabShow } from '@/components/TabKeeper'

interface BundleStop {
  type: 'activity' | 'food' | 'transport'
  name: string
  time: string
  img: string
  label?: string
  lat?: number | null
  lng?: number | null
  /** What the stop is, so "Change plan" can find a real alternative. */
  kind?: 'vendor' | 'photospot' | 'experience'
  refId?: string
  category?: string | null
  /** Set when the stop is a TripStop row (swaps persist to the trip). */
  tripStopId?: string
}

interface Experience {
  id: string
  name: string
  tagline: string
  price: number
  imageUrl: string
  videoUrl?: string | null
  city: string
  startLocation: string
  travelTime: number
  travelMode: string
  vendor?: { name: string; isPremium?: boolean } | null
  moods?: Array<{ id: string; name: string; icon: string }>
  totalMinutes?: number | null
  meetingLat?: number | null
  meetingLng?: number | null
  startTimes?: string[]
  maxPartySize?: number | null
  cancellationTier?: string
  cancellationPolicy?: string | null
  stops?: Array<{ id: string; type: 'vendor' | 'photospot'; name: string; lat: number; lng: number }>
  /** Set when this option came from the route generator rather than a curated experience. */
  generated?: GeneratedBundle
}

interface Booking {
  id: string
  status: string
  date: string
  userId: string
  experience?: { name: string } | null
  vendor?: { name: string } | null
}

const LOADING_MESSAGES: DictKey[] = ['m.exp.loading1', 'm.exp.loading2', 'm.exp.loading3', 'm.exp.loading4']

// "Walk" keeps curated fallbacks within this travel time (minutes).
const WALK_TRAVEL_TIME_MAX = 20

// Semantic design-system colors used for avatar initials.
const AV_COLORS = ['var(--rum)', 'var(--gold)', 'var(--live)', 'var(--info)']

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) { h = name.charCodeAt(i) + ((h << 5) - h) }
  return AV_COLORS[Math.abs(h) % AV_COLORS.length]
}

const MODE_KEY: Record<string, DictKey> = { WALKING: 'exp.mode.WALKING', TAXI: 'exp.mode.TAXI', BOAT: 'exp.mode.BOAT' }
type T = (key: DictKey, vars?: Record<string, string | number>) => string

// A generated route, carried through the same booking and trip flows as a curated experience.
function bundleToExperience(b: GeneratedBundle, t: T): Experience {
  return {
    id: b.id,
    name: b.title,
    tagline: b.meta,
    price: b.price,
    imageUrl: b.hero,
    city: b.city,
    startLocation: b.stops[0]?.name ?? '',
    travelTime: b.stops[0]?.transportDurationToNext ?? 0,
    travelMode: MODE_KEY[b.stops[0]?.transportModeToNext ?? ''] ? t(MODE_KEY[b.stops[0]!.transportModeToNext!]) : '',
    generated: b
  }
}

const FOOD_CATEGORIES = ['FOOD', 'DRINKS']

interface RouteStopView {
  type: 'vendor' | 'photospot'
  id: string
  name: string
  image: string | null
  category: string | null
  lat: number
  lng: number
  plannedDuration: number
  transportModeToNext: string | null
  transportDurationToNext: number | null
}

// Converts a trip's real stops into the active-screen itinerary shape. An
// experience stop is expanded into its route (vendors and photo spots with
// coordinates) so the map and ETA have real places to work with.
async function tripStops(trip: TripView, t: T): Promise<BundleStop[]> {
  const legs: BundleStop[] = []
  for (const stop of trip.stops) {
    if (stop.kind === 'experience') {
      const route: RouteStopView[] = await fetch(`/api/experiences/${stop.refId}`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => (Array.isArray(d?.stops) ? d.stops : []))
        .catch(() => [])
      if (route.length === 0) {
        legs.push({ type: 'activity', name: stop.name, time: stop.time || stop.subtitle, img: stop.image || '', kind: 'experience', refId: stop.refId })
        continue
      }
      route.forEach((st, i) => {
        legs.push({
          type: st.category === 'FOOD' || st.category === 'DRINKS' ? 'food' : 'activity',
          name: st.name,
          time: `${st.plannedDuration} min${st.type === 'photospot' ? ` · ${t('m.exp.photoSpotShort')}` : ''}`,
          img: st.image ?? '',
          lat: st.lat, lng: st.lng, kind: st.type, refId: st.id, category: st.category
        })
        if (i < route.length - 1 && st.transportModeToNext) {
          legs.push({ type: 'transport', name: '', time: '', img: '', label: `${MODE_KEY[st.transportModeToNext] ? t(MODE_KEY[st.transportModeToNext]) : st.transportModeToNext} · ${st.transportDurationToNext} min` })
        }
      })
      continue
    }
    const category = stop.kind === 'vendor' ? FOOD_CATEGORIES.concat(['ACTIVITY', 'WELLNESS', 'BEACH', 'OTHER']).find(c => stop.subtitle.toUpperCase().startsWith(c)) ?? null : null
    const food = category !== null && FOOD_CATEGORIES.includes(category)
    legs.push({ type: food ? 'food' : 'activity', name: stop.name, time: stop.time || stop.subtitle, img: stop.image || '', lat: stop.lat, lng: stop.lng, kind: stop.kind, refId: stop.refId, category, tripStopId: stop.id })
  }
  return legs
}

type Screen = 'home' | 'planner' | 'loading' | 'results' | 'detail' | 'trip' | 'active'

export default function ExperiencesPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('home')
  const [tabMode, setTabMode] = useState<TabMode>('plan')
  const [plan, setPlan] = useState<PlanInput>(defaultPlan())
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [moods, setMoods] = useState<MoodItem[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [dataFailed, setDataFailed] = useState(false)
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null)
  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(null)
  // Results: generated routes, or curated experiences when generating fails.
  const [options, setOptions] = useState<Experience[]>([])
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [activeStops, setActiveStops] = useState<BundleStop[]>([])
  const [currentStopIndex, setCurrentStopIndex] = useState(0)
  const [points, setPoints] = useState(0)
  // What the booking sheet is booking: the selected route, or a planned crew trip.
  const [bookingFor, setBookingFor] = useState<'selected' | TripView | null>(null)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [groupMembers, setGroupMembers] = useState<Array<{ id?: string; name: string; status: string }>>([])
  const [splitOn, setSplitOn] = useState(true)
  const [payingShare, setPayingShare] = useState(false)
  // The trip behind the current plan/booking (group planning, add-to-trip).
  const [activeTrip, setActiveTrip] = useState<TripView | null>(null)
  const [myTrips, setMyTrips] = useState<TripView[]>([])
  const [startingTrip, setStartingTrip] = useState(false)
  const [tripError, setTripError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const online = useOnline()
  const { t, lang } = useLang()
  const patois = usePatois()
  const errorText = useErrorText()
  const labels = useLabels()
  const { city: regionCity, town: regionTown } = useRegion()
  const [showChangePlan, setShowChangePlan] = useState(false)
  const [showRouteSheet, setShowRouteSheet] = useState(false)
  const [swapSelection, setSwapSelection] = useState<string | null>(null)
  const [adapting, setAdapting] = useState(false)
  const [booking] = useState(false)
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0)
  const [mapVendors, setMapVendors] = useState<MapVendor[]>([])
  const [mapPhotoSpots, setMapPhotoSpots] = useState<MapPhotoSpot[]>([])

  useEffect(() => {
    fetchAll()
    fetchMyTrips(['PLANNING', 'BOOKED']).then(setMyTrips).catch(() => {})
    // Deep link from "Add to trip", a shared trip page, or a push alert.
    const params = new URLSearchParams(window.location.search)
    if (params.get('mode') === 'discover') setTabMode('discover')
    const slug = params.get('trip')
    if (slug) {
      openTrip(slug)
    } else if (!navigator.onLine) {
      // No signal mid-trip: reopen the booked trip saved on this device.
      const cached = getActiveCachedTrip()
      if (cached) {
        enterActiveFromTrip(cached.trip)
        setOfflineSavedAt(cached.savedAt)
        setScreen('active')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Back on the tab: refresh quietly (what's on screen stays).
  useTabShow('/experiences', () => { fetchAll(); fetchMyTrips(['PLANNING', 'BOOKED']).then(setMyTrips).catch(() => {}) })

  // Region changes refresh what Home and Discover show.
  useEffect(() => { if (!dataLoading) fetchAll() }, [regionCity]) // eslint-disable-line react-hooks/exhaustive-deps

  const openTrip = async (slug: string) => {
    try {
      const trip = await tripApi(slug, '')
      if (trip.status === 'BOOKED') {
        enterActiveFromTrip(trip)
        setScreen('active')
      } else {
        setActiveTrip(trip)
        setScreen('trip')
      }
      setTabMode('plan')
    } catch {
      // Offline (or the server is unreachable): fall back to the saved copy.
      const cached = getCachedTrip(slug)
      if (cached) {
        enterActiveFromTrip(cached.trip)
        setOfflineSavedAt(cached.savedAt)
        setScreen('active')
      }
    }
  }

  const enterActiveFromTrip = (trip: TripView) => {
    setActiveTrip(trip)
    setActiveStops([])
    tripStops(trip, t).then(setActiveStops)
    setCurrentStopIndex(trip.currentStopIndex ?? 0)
    setGroupMembers(trip.members.map(m => ({ id: m.id, name: m.name, status: m.status })))
    if (trip.booking) {
      setActiveBooking({
        id: trip.booking.id,
        status: trip.booking.status,
        date: trip.booking.date,
        userId: getCurrentUser()?.id ?? '',
        experience: { name: trip.name }
      })
    }
  }

  // Live position for the active trip's map and ETA (Discover watches its own).
  const userPos = useWatchedLocation(screen === 'active')

  useEffect(() => {
    if (screen !== 'loading') { setLoadingMsgIndex(0); return }
    const timer = setInterval(() => setLoadingMsgIndex(prev => (prev + 1) % LOADING_MESSAGES.length), 900)
    return () => clearInterval(timer)
  }, [screen])

  const fetchAll = async () => {
    setDataFailed(false)
    setDataLoading(true)
    try {
      const [expRes, moodRes, bookingsRes, vendorsRes, spotsRes] = await Promise.allSettled([
        fetch(`/api/experiences?city=${regionCity}`),
        fetch('/api/moods'),
        getCurrentUser() ? fetch('/api/bookings', { headers: authHeaders() }) : Promise.reject(new Error('signed out')),
        fetch(`/api/vendors?city=${regionCity}`),
        fetch(`/api/photospots?city=${regionCity}`)
      ])

      setDataFailed(!(moodRes.status === 'fulfilled' && moodRes.value.ok))
      if (expRes.status === 'fulfilled' && expRes.value.ok) {
        const data = await expRes.value.json()
        setExperiences(Array.isArray(data) ? data : [])
      }
      if (moodRes.status === 'fulfilled' && moodRes.value.ok) {
        const data = await moodRes.value.json()
        setMoods(Array.isArray(data) ? data : [])
      }
      if (vendorsRes.status === 'fulfilled' && vendorsRes.value.ok) {
        const data = await vendorsRes.value.json()
        setMapVendors(Array.isArray(data) ? data.filter((v: MapVendor) => v.visibleOnMap && !v.isTransport) : [])
      }
      if (spotsRes.status === 'fulfilled' && spotsRes.value.ok) {
        const data = await spotsRes.value.json()
        setMapPhotoSpots(Array.isArray(data) ? data : [])
      }
      if (bookingsRes.status === 'fulfilled' && bookingsRes.value.ok && getCurrentUser()) {
        const data: Booking[] = await bookingsRes.value.json()
        const now = Date.now()
        const active = data
          .filter(b => b.status === 'CONFIRMED')
          .filter(b => {
            const at = new Date(b.date).getTime()
            return at >= now - 3 * 3600000 && at <= now + 6 * 3600000
          })
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
        setActiveBooking(active || null)
      }
    } catch (error) {
      console.error('Fetch error:', error)
      setDataFailed(true)
    } finally {
      setDataLoading(false)
    }
  }

  // Moods matching the onboarding vibe lead; the rest follow in their usual order.
  const orderedMoods = useMemo(() => {
    const vibe = vibeMoodNames()
    return [...moods.filter(m => vibe.includes(m.name)), ...moods.filter(m => !vibe.includes(m.name))]
  }, [moods])
  const vibeMood = (): MoodItem | null => moods.find(m => vibeMoodNames().includes(m.name)) ?? null

  const openPlanner = (anchor: PlanAnchor | null = null) => {
    const preset = vibeMood()
    setPlan(p => ({ ...p, mood: p.mood ?? (preset ? { id: preset.id, name: preset.name } : null), anchor }))
    setTabMode('plan')
    setScreen('planner')
  }

  // Curated experiences in the region for the plan's mood — the fallback when
  // fresh routes can't be generated.
  const curatedFor = (p: PlanInput): Experience[] => {
    const inRegion = experiences.filter(e => e.city === regionCity)
    const byMood = p.mood ? inRegion.filter(e => e.moods?.some(m => m.id === p.mood!.id)) : inRegion
    if (p.transport === 'walk') {
      const walkable = byMood.filter(e => e.travelTime <= WALK_TRAVEL_TIME_MAX)
      return walkable.length ? walkable : byMood
    }
    return byMood
  }

  // Builds three route options from live places; keeps the loading screen up
  // at least ~1.2s so it doesn't flash.
  const runPlan = async (p: PlanInput) => {
    setPlan(p)
    setGenerateError(null)
    setScreen('loading')
    const [res] = await Promise.allSettled([
      fetch('/api/experiences/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generateBody(p, regionCity))
      }).then(r => r.json()),
      new Promise(r => setTimeout(r, 1200))
    ])
    if (res.status === 'fulfilled' && Array.isArray(res.value?.bundles) && res.value.bundles.length) {
      setOptions(res.value.bundles.map((b: GeneratedBundle) => bundleToExperience(b, t)))
    } else {
      setOptions(curatedFor(p).slice(0, 3))
      setGenerateError(t('m.exp.generateFailed'))
    }
    setScreen('results')
  }

  // "Surprise me": skip the planner — the onboarding vibe's mood (or any mood), today's defaults.
  const surprise = () => {
    const pick = vibeMood() ?? moods[Math.floor(Math.random() * moods.length)] ?? null
    runPlan({ ...defaultPlan(pick ? { id: pick.id, name: pick.name } : null), crew: plan.crew })
  }

  const runMood = (m: MoodItem) => runPlan({ ...defaultPlan({ id: m.id, name: m.name }), crew: plan.crew, transport: plan.transport })

  // Home's Choose The Vibe: /experiences?mood=<id> goes straight to the
  // results for that mood (the planner pre-picked with it).
  const moodParamDone = useRef(false)
  useEffect(() => {
    if (moodParamDone.current || !moods.length) return
    const id = new URLSearchParams(window.location.search).get('mood')
    if (!id) return
    moodParamDone.current = true
    const m = moods.find(x => x.id === id)
    if (!m) return
    setPlan(p => ({ ...p, mood: { id: m.id, name: m.name } }))
    window.history.replaceState(null, '', '/experiences')
    runMood(m)
  }, [moods]) // eslint-disable-line react-hooks/exhaustive-deps

  // Curated experiences are linked by id; generated routes become the trip's stops.
  const tripInputFor = (exp: Experience) => exp.generated
    ? {
        name: exp.name,
        crew: [] as string[],
        city: exp.city,
        stops: exp.generated.stops.map(st => (st.type === 'vendor' ? { vendorId: st.id, time: st.arrival } : { photoSpotId: st.id, time: st.arrival }))
      }
    : { name: exp.name, experienceId: exp.id, crew: [] as string[], city: exp.city }

  // "Crew vote" / "Plan with crew": a shared trip the crew can join and vote
  // on before anything is booked (invites live on the trip screen).
  const startCrewTrip = async (exp: Experience | null) => {
    if (!exp) return
    setStartingTrip(true)
    setTripError(null)
    try {
      const trip = await createTrip(tripInputFor(exp))
      setActiveTrip(trip)
      setMyTrips(prev => [trip, ...prev.filter(x => x.slug !== trip.slug)])
      triggerHaptic('medium')
      setScreen('trip')
    } catch (e) {
      setTripError(errorText(e))
    } finally {
      setStartingTrip(false)
    }
  }

  // The booking sheet's confirm step: books the trip server-side with the
  // traveler's date/time/party (paid from the ETA Wallet). Every booking goes
  // through a Trip so it gets the shared link, offline copy and recap.
  const confirmBooking = async (details: BookingDetails): Promise<BookingResult> => {
    const target = bookingFor
    if (!target) throw new Error(t('m.err.generic'))
    const trip = target === 'selected' ? await createTrip(tripInputFor(selectedExperience!)) : target
    const estimate = trip.experience ? undefined : selectedExperience?.generated?.price
    const booked = await bookTripPaid(trip.slug, details, estimate, splitOn && trip.members.length > 1)
    setPoints(getCurrentUser()?.points ?? 0)
    // Save everything the active screen needs in case the signal drops.
    cacheTripForOffline(booked)
    setMyTrips(prev => [booked, ...prev.filter(x => x.slug !== trip.slug)])
    setActiveTrip(booked)
    return booked
  }

  const finishBookingFlow = () => {
    setBookingFor(null)
    if (activeTrip) enterActiveFromTrip(activeTrip)
    setScreen('active')
  }

  // Start times, capacity and the cancellation policy of what's being booked
  // (curated experiences only — generated routes have none), plus the split
  // option for crew trips.
  const bookingDetailsFor = (target: 'selected' | TripView | null) => {
    const exp = target === 'selected' ? (selectedExperience?.generated ? null : selectedExperience) : target?.experience ?? null
    const crewSize = target && target !== 'selected' ? target.members.length : plan.crew
    return {
      startTimes: exp?.startTimes ?? [],
      maxPartySize: exp?.maxPartySize ?? null,
      experienceId: exp?.id ?? null,
      cancellationTier: exp?.cancellationTier ?? null,
      cancellationNote: exp?.cancellationPolicy ?? null,
      split: crewSize > 1 ? { members: crewSize, on: splitOn, onToggle: setSplitOn } : null
    }
  }

  const bookingUnitPrice = bookingFor === 'selected'
    ? selectedExperience?.price ?? 0
    : bookingFor?.experience?.price ?? selectedExperience?.generated?.price ?? 0

  const bookingSheet = (
    <BookingSheet
      open={bookingFor !== null}
      onClose={() => setBookingFor(null)}
      title={bookingFor === 'selected' ? selectedExperience?.name ?? '' : bookingFor?.name ?? ''}
      unitPrice={bookingUnitPrice}
      priceIsEstimate={bookingFor === 'selected' ? Boolean(selectedExperience?.generated) : !bookingFor?.experience}
      defaultPartySize={bookingFor && bookingFor !== 'selected' ? bookingFor.members.length : plan.crew}
      {...bookingDetailsFor(bookingFor)}
      onConfirm={confirmBooking}
      onDone={finishBookingFlow}
    />
  )

  // Finishing a booked trip completes the booking (points credited) and
  // opens the shareable recap (B5). The offline copy is no longer needed.
  const finishTrip = async () => {
    if (!activeTrip) return
    setFinishing(true)
    setTripError(null)
    try {
      await tripApi(activeTrip.slug, '/complete', { method: 'POST' })
      clearTripCache(activeTrip.slug)
      hapticBookingConfirmed()
      router.push(`/trip/${activeTrip.slug}/recap`)
    } catch (e) {
      setTripError(errorText(e))
      setFinishing(false)
    }
  }

  const realStops = () => activeStops.filter(s => s.type !== 'transport')

  const cycleStatus = (i: number) => {
    const order = ['pending', 'enroute', 'arrived']
    const member = groupMembers[i]
    if (activeTrip && member.id !== activeTrip.myMemberId && activeTrip.access !== 'owner') return
    const status = order[(order.indexOf(member.status) + 1) % order.length]
    setGroupMembers(prev => prev.map((m, j) => (j === i ? { ...m, status } : m)))
    if (activeTrip && member.id) {
      tripApi(activeTrip.slug, '/members', { method: 'PATCH', body: { memberId: member.id, status } })
        .then(t => updateCachedTrip({ ...t, canEdit: activeTrip.canEdit }))
        .catch(() => {})
    }
  }

  // Split payment: each member pays their own share from their own wallet.
  const payMyShare = async () => {
    if (!activeTrip) return
    setPayingShare(true)
    setTripError(null)
    try {
      const updated = await tripApi<TripView>(activeTrip.slug, '/pay-share', { method: 'POST' })
      hapticBookingConfirmed()
      setActiveTrip({ ...updated, canEdit: activeTrip.canEdit })
      updateCachedTrip({ ...updated, canEdit: activeTrip.canEdit })
    } catch (e) {
      setTripError(errorText(e))
    } finally {
      setPayingShare(false)
    }
  }

  // Keep the crew's positions, statuses and payments fresh on the active screen.
  useEffect(() => {
    if (screen !== 'active' || !activeTrip || !online) return
    const slug = activeTrip.slug
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      tripApi<TripView>(slug, '').then(tr => {
        setActiveTrip(prev => (prev && prev.slug === slug ? { ...tr, canEdit: prev.canEdit } : prev))
        setGroupMembers(tr.members.map(m => ({ id: m.id, name: m.name, status: m.status })))
      }).catch(() => {})
    }, 20000)
    return () => clearInterval(timer)
  }, [screen, activeTrip?.slug, online])

  // "Change plan": real alternatives for the stop you're heading to — the
  // nearest vendors in the same category (or other photo spots), not already
  // on the route.
  const swapOptions = (() => {
    const route = realStops()
    const current = route[currentStopIndex]
    if (!current) return []
    const used = new Set(route.map(s => s.refId))
    const anchor = current.lat != null && current.lng != null ? { lat: current.lat, lng: current.lng } : userPos
    const tripCity = activeTrip?.city ?? regionCity
    const candidates = current.kind === 'photospot'
      ? mapPhotoSpots.filter(s => !used.has(s.id) && (!s.city || s.city === tripCity)).map(s => ({ kind: 'photospot' as const, id: s.id, name: s.name, img: s.officialPhoto ?? '', lat: s.lat, lng: s.lng, category: null as string | null, sub: t('m.exp.photoSpot') }))
      : mapVendors.filter(v => !used.has(v.id) && (!current.category || v.category === current.category) && (!v.city || v.city === tripCity)).map(v => ({ kind: 'vendor' as const, id: v.id, name: v.name, img: v.images?.[0] ?? '', lat: v.lat, lng: v.lng, category: v.category as string | null, sub: `${labels.category(v.category)} · ${v.neighborhood}` }))
    return candidates
      .map(c => ({ ...c, km: anchor ? haversineKm(anchor, c) : null }))
      .sort((a, b) => (a.km ?? 0) - (b.km ?? 0))
      .slice(0, 3)
  })()

  const applySwap = async () => {
    setShowChangePlan(false)
    const choice = swapOptions.find(o => o.id === swapSelection)
    setSwapSelection(null)
    if (!choice) return
    setAdapting(true)
    let realIdx = -1
    const target = activeStops.findIndex(s => s.type !== 'transport' && ++realIdx === currentStopIndex)
    const old = activeStops[target]
    setActiveStops(prev => prev.map((s, i) => i !== target ? s : {
      ...s,
      type: choice.category === 'FOOD' || choice.category === 'DRINKS' ? 'food' : 'activity',
      name: choice.name, img: choice.img, time: choice.sub, lat: choice.lat, lng: choice.lng,
      kind: choice.kind, refId: choice.id, category: choice.category
    }))
    try {
      if (activeTrip?.canEdit && old?.tripStopId) {
        const updated = await tripApi(activeTrip.slug, '', {
          method: 'PATCH',
          body: { swapStop: { stopId: old.tripStopId, ...(choice.kind === 'vendor' ? { vendorId: choice.id } : { photoSpotId: choice.id }) } }
        })
        setActiveTrip({ ...updated, canEdit: true })
        updateCachedTrip({ ...updated, canEdit: true })
      }
      triggerHaptic('medium')
    } catch (e) {
      setTripError(errorText(e))
    } finally {
      setAdapting(false)
    }
  }

  // "Arrived → next stop": advance the route and tell the trip, so the
  // shared trip link shows where the crew is.
  const arriveAtStop = () => {
    const next = Math.min(realStops().length, currentStopIndex + 1)
    setCurrentStopIndex(next)
    triggerHaptic('medium')
    if (activeTrip?.canEdit) {
      tripApi<TripView>(activeTrip.slug, '', { method: 'PATCH', body: { currentStopIndex: next } })
        .then(tr => { setActiveTrip({ ...tr, canEdit: true }); updateCachedTrip({ ...tr, canEdit: true }) })
        .catch(() => {})
    }
  }

  const shareLiveTrip = async () => {
    if (!activeTrip) return
    const url = await createViewLink(activeTrip.slug).catch(() => absoluteUrl(`/trip/${activeTrip.slug}`))
    const result = await shareOrCopy({ title: activeTrip.name, text: t('m.trip.shareText', { name: activeTrip.name }), url })
    if (result === 'copied') {
      setShareMsg(t('m.events.linkCopied'))
      setTimeout(() => setShareMsg(null), 1800)
    }
  }

  const statusLabel = (s: string) => t(s === 'arrived' ? 'm.crew.status.arrived' : s === 'enroute' ? 'm.crew.status.enroute' : 'm.crew.status.pending')

  const changeMode = (m: TabMode) => {
    setTabMode(m)
    setScreen('home')
  }

  // DISCOVER
  if (tabMode === 'discover' && screen === 'home') {
    return (
      <DiscoverView
        vendors={mapVendors}
        photoSpots={mapPhotoSpots}
        mode={tabMode}
        onModeChange={changeMode}
      />
    )
  }

  // HOME
  if (screen === 'home') {
    const locale = lang === 'en' ? 'en-US' : lang
    const when = (iso: string) => new Date(iso).toLocaleString(locale, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Jamaica' })
    const now = Date.now()
    const live = (iso: string) => { const at = new Date(iso).getTime(); return at >= now - 3 * 3600000 && at <= now + 6 * 3600000 }
    const booked = myTrips
      .filter(tr => tr.status === 'BOOKED' && tr.booking && new Date(tr.booking.date).getTime() >= now - 6 * 3600000)
      .sort((a, b) => new Date(a.booking!.date).getTime() - new Date(b.booking!.date).getTime())[0]
    const planning = myTrips.find(tr => tr.status === 'PLANNING')
    const tripStatus = (tr: TripView): string => {
      if (tr.status === 'BOOKED' && tr.booking) return live(tr.booking.date) ? t('m.xh.happeningNow') : t('m.xh.bookedFor', { when: when(tr.booking.date) })
      if (tr.stops.length === 0) return t('m.xh.pickPlan')
      // Crew members who haven't voted on every stop yet.
      const waiting = tr.members.length > 1 ? tr.members.filter(m => tr.stops.some(s => !(m.id in s.votes.byMember))).length : 0
      if (waiting > 0) return waiting === 1 ? t('m.xh.waitingVote') : t('m.xh.waitingVotes', { n: waiting })
      return t('m.xh.readyToBook')
    }
    const trip = booked ?? planning
    const yourTrip: YourTripRow | null = trip
      ? { name: trip.name, image: trip.experience?.imageUrl ?? trip.stops.find(s => s.image)?.image ?? null, status: tripStatus(trip), onOpen: () => openTrip(trip.slug) }
      : activeBooking
        ? { name: activeBooking.experience?.name || activeBooking.vendor?.name || t('m.home.yourTrip'), image: null, status: live(activeBooking.date) ? t('m.xh.happeningNow') : t('m.xh.bookedFor', { when: when(activeBooking.date) }), onOpen: () => router.push('/bookings') }
        : null
    const videoMood = moods.find(m => m.videoUrl)
    const videoExp = experiences.find(e => e.videoUrl)
    const heroVideo = videoMood ? { src: videoMood.videoUrl!, poster: videoMood.coverImage }
      : videoExp ? { src: videoExp.videoUrl!, poster: videoExp.imageUrl }
      : moods[0] ? { src: null, poster: moods[0].coverImage }
      : experiences[0] ? { src: null, poster: experiences[0].imageUrl }
      : null
    return (
      <>
        <ExperiencesHome
          moods={orderedMoods}
          heroVideo={heroVideo}
          loading={dataLoading && moods.length === 0}
          failed={dataFailed}
          onRetry={fetchAll}
          mode={tabMode}
          onModeChange={changeMode}
          onStart={() => openPlanner(null)}
          onSurprise={surprise}
          onMood={runMood}
          surprising={false}
          yourTrip={yourTrip}
        />
        <Dock />
      </>
    )
  }

  // QUICK PLANNER
  if (screen === 'planner') {
    return (
      <QuickPlanner
        moods={orderedMoods}
        initial={plan}
        townName={regionTown.name}
        loading={dataLoading && moods.length === 0}
        failed={dataFailed}
        onRetry={fetchAll}
        onBack={() => { setPlan(p => ({ ...p, anchor: null })); setScreen('home') }}
        onBuild={runPlan}
        onSurprise={surprise}
      />
    )
  }

  // LOADING
  if (screen === 'loading') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px' }}>
        <div className="loading-icon-fade" style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--rum-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkle" size={22} style={{ color: 'var(--rum)' }} />
        </div>
        <p key={loadingMsgIndex} role="status" className="loading-text-fade" style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>
          {t(LOADING_MESSAGES[loadingMsgIndex])}
        </p>
      </main>
    )
  }

  // RESULTS — swipe between the options
  if (screen === 'results') {
    const badges = optionBadges(options.map(e => ({ price: e.price, local: e.generated ? localShare(e.generated) : null })))
    const results: ResultOption[] = options.map((e, i) => {
      const b = e.generated
      if (b) {
        const first = b.stops[0]
        return {
          id: e.id,
          name: b.title,
          tagline: first ? t('m.res.tagline', { time: first.arrival, area: first.neighborhood ?? first.name }) : '',
          image: b.hero,
          badge: badges[i],
          stops: b.stops.map(s => ({ name: s.name, lat: s.lat, lng: s.lng })),
          why: whyItFits(b, plan, t),
          duration: shortDuration(b.totalMinutes),
          price: b.price,
          pts: b.pts
        }
      }
      return {
        id: e.id,
        name: e.name,
        tagline: e.tagline,
        image: e.imageUrl,
        badge: badges[i],
        stops: (e.stops ?? []).map(s => ({ name: s.name, lat: s.lat, lng: s.lng })),
        why: plan.mood ? t('m.res.why.curated', { mood: plan.mood.name }) : null,
        duration: shortDuration(e.totalMinutes),
        price: e.price,
        // Bookings earn a point per dollar.
        pts: Math.floor(e.price) || null
      }
    })
    const timeLabel = TIMES.find(x => x.id === plan.time)
    const eyebrow = [
      plan.anchor ? t('m.qp.around', { place: plan.anchor.name }) : plan.mood?.name,
      timeLabel ? t(timeLabel.label) : null,
      plan.crew === 1 ? t('m.qp.justMe') : t('m.qp.people', { n: plan.crew })
    ].filter(Boolean).join(' · ')
    const find = (o: ResultOption) => options.find(e => e.id === o.id) ?? null
    return (
      <ResultsCarousel
        eyebrow={eyebrow}
        options={results}
        notice={generateError}
        fallbackCenter={[regionTown.lat, regionTown.lng]}
        busy={startingTrip}
        error={tripError}
        onBack={() => setScreen('planner')}
        onRetry={() => runPlan(plan)}
        onCrewVote={o => startCrewTrip(find(o))}
        onSeeRoute={o => {
          const exp = find(o)
          if (!exp) return
          if (!exp.generated) { router.push(`/experiences/${exp.id}`); return }
          setSelectedExperience(exp)
          setTripError(null)
          setScreen('detail')
        }}
      />
    )
  }

  // DETAIL — a generated route (curated experiences have /experiences/[id])
  if (screen === 'detail' && selectedExperience?.generated) {
    const b = selectedExperience.generated
    const first = b.stops[0]
    const data: DetailData = {
      name: b.title,
      image: b.hero,
      video: null,
      gallery: [],
      rating: null,
      reviewCount: 0,
      minutes: b.totalMinutes,
      stops: b.stops.map(s => ({ id: s.id, type: s.type, name: s.name, lat: s.lat, lng: s.lng, minutes: s.plannedDuration })),
      host: null,
      reviews: [],
      reviewsHref: null,
      included: [],
      whatToBring: [],
      languages: [],
      groupSize: null,
      accessibility: [],
      accessibilityNotes: null,
      meeting: first ? { text: first.name, lat: first.lat, lng: first.lng } : null,
      cancellation: null,
      price: b.price,
      estimate: true
    }
    const share = async () => {
      if (await shareOrCopy({ title: b.title, text: `${b.title} — ${b.stops.map(s => s.name).join(' → ')}`, url: absoluteUrl('/experiences') }) === 'copied') {
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 1800)
      }
    }
    return (
      <>
        <ExperienceDetailView
          data={data}
          fallbackCenter={[regionTown.lat, regionTown.lng]}
          onBack={() => setScreen('results')}
          saved={null}
          onToggleSave={null}
          onShare={share}
          shareCopied={shareCopied}
          onBook={() => setBookingFor('selected')}
          onPlanWithCrew={() => startCrewTrip(selectedExperience)}
          planning={startingTrip}
          actionError={tripError}
        />
        {bookingSheet}
      </>
    )
  }

  // TRIP — group planning before booking
  if (screen === 'trip' && activeTrip) {
    return (
      <main className="screen-push-in" style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '96px' }}>
        <div style={{ padding: '16px' }}>
          <div style={{ marginBottom: '12px' }}><BackButton onClick={() => setScreen(selectedExperience?.generated ? 'detail' : options.length ? 'results' : 'home')} /></div>
          <TripPlanner
            trip={activeTrip}
            mode={activeTrip.access === 'member' ? 'crew' : 'owner'}
            onTripChange={tr => { setActiveTrip(tr); setMyTrips(prev => prev.map(x => (x.slug === tr.slug ? tr : x))) }}
            onBook={() => setBookingFor(activeTrip)}
            booking={booking}
          />
          {tripError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginTop: '10px' }}>{tripError}</p>}
          <div style={{ marginTop: '16px' }}><CrewChat slug={activeTrip.slug} myMemberId={activeTrip.myMemberId ?? null} /></div>
        </div>
        {bookingSheet}
        <Dock />
      </main>
    )
  }

  // ACTIVE
  if (screen === 'active') {
    const realStopsList = realStops()
    const nextStop = realStopsList[currentStopIndex]
    const members = activeTrip?.members ?? []
    const me = members.find(m => m.id === activeTrip?.myMemberId)
    const paidCount = members.filter(m => m.paid).length
    const crewOnMap = members.filter(m => m.location && m.id !== activeTrip?.myMemberId).map(m => ({ name: m.name, lat: m.location!.lat, lng: m.location!.lng }))
    // Google Maps directions for a leg: walking when it's a short hop, driving otherwise.
    const navigateTo = (stop: BundleStop | undefined, from: { lat: number; lng: number } | null) => {
      if (!stop || stop.lat == null || stop.lng == null) return null
      const km = from ? haversineKm(from, { lat: stop.lat, lng: stop.lng }) : Infinity
      return { url: directionsUrl({ lat: stop.lat, lng: stop.lng }, km <= MAX_WALK_KM ? 'walking' : 'driving')!, walking: km <= MAX_WALK_KM }
    }
    // ETA from real distance: your live position (or the previous stop) to
    // the next stop, at walking pace when it's close and taxi pace otherwise.
    const prevStop = realStopsList[currentStopIndex - 1]
    const from = userPos ?? (prevStop?.lat != null && prevStop?.lng != null ? { lat: prevStop.lat, lng: prevStop.lng } : null)
    const eta = nextStop?.lat != null && nextStop?.lng != null && from
      ? (() => {
          const km = haversineKm(from, { lat: nextStop.lat!, lng: nextStop.lng! })
          const mode = km <= 0.8 ? 'WALKING' as const : 'TAXI' as const
          return { km, mode, minutes: km < 0.05 ? 0 : estimateMinutes(km, mode) }
        })()
      : null

    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '0', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'var(--system-bg-secondary)' }}>
          <TripMap
            stops={realStopsList.map(s => ({ name: s.name, lat: s.lat ?? null, lng: s.lng ?? null }))}
            currentIndex={currentStopIndex}
            user={userPos}
            crew={crewOnMap}
            youLabel={t('m.exp.you')}
            fallbackCenter={[regionTown.lat, regionTown.lng]}
            live
            bottomInset={300}
          />
        </div>

        <div style={{ position: 'absolute', top: '0', left: '0', right: '0', zIndex: 20, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <BackButton onClick={() => setScreen('home')} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--system-bg-elevated)', padding: '8px 12px', borderRadius: '999px', minHeight: '44px', boxShadow: 'var(--shadow-card)' }}>
            <Icon name="sparkle" size={14} style={{ color: 'var(--gold)' }} />
            <span className="num-font" style={{ fontWeight: 700, fontSize: '15px', color: 'var(--gold)' }}>{points}</span>
          </div>
        </div>

        <div style={{ position: 'absolute', left: '0', right: '0', bottom: '0', zIndex: 10, background: 'var(--system-bg-elevated)', borderRadius: '20px 20px 0 0', boxShadow: 'var(--shadow-sheet)', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid var(--separator)' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--label-secondary)' }}>{nextStop ? t('m.trip.nextStop', { n: currentStopIndex + 1, total: realStopsList.length }) : t('m.trip.allDone')}</p>
              <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginTop: '2px' }}>{nextStop?.name || t('m.trip.complete')}</p>
            </div>
            {eta && (
              <div style={{ textAlign: 'right' }}>
                <span className="num-font" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--live)' }}>{t('m.exp.minutes', { n: eta.minutes })}</span>
                <p className="num-font" style={{ fontSize: '12px', color: 'var(--label-secondary)' }}>
                  {eta.km < 1 ? `${Math.round(eta.km * 1000)} m` : `${eta.km.toFixed(1)} km`} · {t(eta.mode === 'WALKING' ? 'exp.mode.WALKING' : 'exp.mode.TAXI')}
                </p>
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {nextStop && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {(() => {
                  const nav = navigateTo(nextStop, from)
                  return nav ? (
                    <a href={nav.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ flex: 1, textDecoration: 'none' }} aria-label={`${t('m.trip.navigate')} — ${nextStop.name} (${nav.walking ? t('m.trip.walk') : t('m.trip.drive')})`}>
                      <Icon name="navigate" size={16} /> {t('m.trip.navigate')}
                    </a>
                  ) : null
                })()}
                <button className="btn btn-primary" onClick={arriveAtStop} style={{ flex: 2 }}>
                  <Icon name="check" size={16} />
                  {currentStopIndex + 1 < realStopsList.length ? t('m.trip.arrivedNext') : t('m.trip.arrivedLast')}
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', marginBottom: '16px' }}>
              {realStopsList.map((stop, i) => (
                <div key={i} style={{ flexShrink: 0, padding: '8px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', background: i < currentStopIndex ? 'var(--system-bg-secondary)' : i === currentStopIndex ? 'var(--rum-tint)' : 'var(--system-bg-secondary)', color: i < currentStopIndex ? 'var(--success)' : i === currentStopIndex ? 'var(--rum)' : 'var(--label-tertiary)', minHeight: '36px', display: 'flex', alignItems: 'center' }}>
                  {stop.name}
                </div>
              ))}
            </div>

            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '8px' }}>{t('m.exp.yourCrew')}</p>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {groupMembers.map((member, i) => (
                <button key={i} aria-label={`${member.name}: ${statusLabel(member.status)}`} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', minHeight: '44px', background: 'none', border: 'none', fontFamily: 'inherit', padding: 0 }} onClick={() => cycleStatus(i)}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: avatarColor(member.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: 'white', border: member.status === 'arrived' ? '2px solid var(--success)' : '2px solid transparent' }}>
                    {member.name[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--label-secondary)' }}>{member.name}</span>
                  <span style={{ fontSize: '10px', color: 'var(--label-secondary)' }}>{statusLabel(member.status)}</span>
                </button>
              ))}
            </div>

            {activeTrip?.splitPayment && members.length > 1 && (
              <>
                <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '8px' }}>{t('m.crew.split')}</p>
                <div style={{ background: 'var(--system-bg-secondary)', borderRadius: '14px', padding: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <Price usd={members.reduce((a, m) => a + m.share, 0)} compact style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)' }} />
                    <span className="num-font" style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{t('m.exp.paidOf', { paid: paidCount, total: members.length })}</span>
                  </div>
                  {members.map((m, i) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: i > 0 ? '0.5px solid var(--separator)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: avatarColor(m.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white' }}>{m.name[0]?.toUpperCase()}</span>
                        <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--label-primary)' }}>{m.id === me?.id ? t('m.crew.you', { name: m.name }) : m.name}</span>
                      </div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700, padding: '6px 10px', borderRadius: '999px', background: m.paid ? 'var(--system-bg)' : 'var(--rum-tint)', color: m.paid ? 'var(--success)' : 'var(--rum-text)', minHeight: '36px' }}>
                        {m.paid ? <><Icon name="check" size={12} /> {t('m.crew.paid')}</> : <Price usd={m.share} compact />}
                      </span>
                    </div>
                  ))}
                  {me && !me.paid && me.share > 0 && (
                    <button className="btn btn-primary" onClick={payMyShare} disabled={payingShare || !online} style={{ width: '100%', marginTop: '8px' }}>
                      {payingShare ? patois.loadingPayment : <>{t('m.exp.payMine')} · <Price usd={me.share} compact /></>}
                    </button>
                  )}
                </div>
              </>
            )}

            {activeTrip && me && online && <ShareLocationToggle slug={activeTrip.slug} />}
            {activeTrip && online && <CrewChat slug={activeTrip.slug} myMemberId={activeTrip.myMemberId ?? null} />}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowChangePlan(true)} disabled={!nextStop} style={{ flex: 1, padding: '12px', borderRadius: '14px', background: 'var(--system-bg-secondary)', border: 'none', cursor: 'pointer', color: 'var(--label-primary)', fontFamily: 'inherit', fontSize: '15px', fontWeight: 600, minHeight: '44px' }}>
                {t('m.trip.changePlan')}
              </button>
              <button onClick={() => setShowRouteSheet(true)} style={{ flex: 1, padding: '12px', borderRadius: '14px', background: 'var(--system-bg-secondary)', border: 'none', cursor: 'pointer', color: 'var(--label-primary)', fontFamily: 'inherit', fontSize: '15px', fontWeight: 600, minHeight: '44px' }}>
                {t('m.trip.fullRoute')}
              </button>
            </div>
            {activeTrip && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button onClick={shareLiveTrip} style={{ flex: 1, padding: '12px', borderRadius: '14px', background: 'var(--system-bg-secondary)', border: 'none', cursor: 'pointer', color: 'var(--label-primary)', fontFamily: 'inherit', fontSize: '15px', fontWeight: 600, minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Icon name="share" size={16} /> {shareMsg ?? t('m.trip.shareLive')}
                </button>
                <button onClick={() => router.push('/safety')} style={{ flex: 1, padding: '12px', borderRadius: '14px', background: 'var(--system-bg-secondary)', border: 'none', cursor: 'pointer', color: 'var(--label-primary)', fontFamily: 'inherit', fontSize: '15px', fontWeight: 600, minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Icon name="bell" size={16} /> {t('m.safety.title')}
                </button>
              </div>
            )}
            {activeTrip?.access === 'owner' && activeTrip.status === 'BOOKED' && (
              <button className="btn btn-primary" onClick={finishTrip} disabled={finishing || !online} style={{ width: '100%', marginTop: '8px' }}>
                <Icon name="sparkle" size={16} />
                {finishing ? t('m.exp.wrapping') : online ? t('m.exp.finish') : t('m.exp.finishOffline')}
              </button>
            )}
            {tripError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginTop: '8px' }}>{tripError}</p>}
          </div>
        </div>

        {(!online || offlineSavedAt) && activeTrip && (
          <div role="status" style={{ position: 'absolute', top: '72px', left: '50%', transform: 'translateX(-50%)', zIndex: 25, background: 'var(--system-bg-elevated)', padding: '8px 14px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-elevated)', whiteSpace: 'nowrap' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: online ? 'var(--success)' : 'var(--warning)' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-primary)' }}>
              {online ? t('m.exp.backOnline') : t('m.exp.offlineTrip')}
            </span>
          </div>
        )}

        {adapting && (
          <div style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: 'var(--system-bg-elevated)', padding: '12px 16px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-elevated)' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--separator)', borderTopColor: 'var(--rum)', animation: 'spin 0.7s linear infinite' }} />
            <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--label-primary)' }}>{t('m.exp.updatingPlan')}</span>
          </div>
        )}

        {showChangePlan && (
          <>
            <div className="bottom-sheet-overlay open" onClick={() => setShowChangePlan(false)} />
            <div className="bottom-sheet open" style={{ padding: '20px' }}>
              <div className="sheet-grabber" />
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '4px' }}>{t('m.trip.changePlanTitle')}</h3>
              {realStops()[currentStopIndex] && (
                <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '12px' }}>{t('m.trip.swapInsteadOf', { name: realStops()[currentStopIndex].name })}</p>
              )}
              {swapOptions.length === 0 ? (
                <div className="empty-state">
                  <Icon name="shuffle" size={28} style={{ color: 'var(--label-tertiary)' }} />
                  <p style={{ fontSize: '15px', fontWeight: 600 }}>{t('m.trip.noSwaps')}</p>
                </div>
              ) : (
                swapOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setSwapSelection(opt.id)}
                    aria-pressed={swapSelection === opt.id}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      marginBottom: '8px',
                      background: swapSelection === opt.id ? 'var(--rum-tint)' : 'var(--system-bg-secondary)',
                      border: swapSelection === opt.id ? '1px solid var(--rum)' : '1px solid var(--separator)',
                      minHeight: '44px'
                    }}
                  >
                    {opt.img ? <span style={{ width: '44px', height: '44px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}><Img src={opt.img} alt="" width={88} height={88} sizes="44px" /></span> : null}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: 'var(--label-primary)' }}>{opt.name}</span>
                      <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>
                        {opt.sub}{opt.km !== null ? ` · ${opt.km < 1 ? `${Math.round(opt.km * 1000)} m` : `${opt.km.toFixed(1)} km`}` : ''}
                      </span>
                    </span>
                  </button>
                ))
              )}
              <button className="btn btn-primary" onClick={applySwap} disabled={!swapSelection} style={{ width: '100%', marginTop: '8px' }}>{patois.ctaPrimary}</button>
            </div>
          </>
        )}

        {showRouteSheet && (
          <>
            <div className="bottom-sheet-overlay open" onClick={() => setShowRouteSheet(false)} />
            <div className="bottom-sheet open" style={{ padding: '20px' }}>
              <div className="sheet-grabber" />
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '12px' }}>{t('m.trip.fullRoute')}</h3>
              <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {activeStops.map((stop, i) => {
                if (stop.type === 'transport') return <div key={i} style={{ padding: '6px 0 6px 16px', fontSize: '13px', color: 'var(--label-tertiary)' }}>{stop.label}</div>
                // Each leg: from the previous real stop (or you, for the first) to this one.
                const prev = activeStops.slice(0, i).reverse().find(s => s.type !== 'transport' && s.lat != null && s.lng != null)
                const nav = navigateTo(stop, prev ? { lat: prev.lat!, lng: prev.lng! } : userPos)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '14px', marginBottom: '4px', background: 'var(--system-bg-secondary)' }}>
                    {stop.img ? <span style={{ width: '44px', height: '44px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}><Img src={stop.img} alt="" width={88} height={88} sizes="44px" /></span> : null}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{stop.name}</p>
                      <p style={{ fontSize: '13px', color: 'var(--label-tertiary)' }}>{stop.time}</p>
                    </div>
                    {nav && (
                      <a href={nav.url} target="_blank" rel="noopener noreferrer" className="chip" style={{ flexShrink: 0, textDecoration: 'none', minHeight: '36px' }} aria-label={`${t('m.trip.navigate')} — ${stop.name}`}>
                        <Icon name="navigate" size={12} /> {nav.walking ? t('m.trip.walk') : t('m.trip.drive')}
                      </a>
                    )}
                  </div>
                )
              })}
              </div>
            </div>
          </>
        )}

        <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    )
  }

  return null
}
