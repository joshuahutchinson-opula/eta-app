// app/experiences/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import ActiveTripBanner from '@/components/ActiveTripBanner'
import ExploreMap, { type MapVendor, type MapPhotoSpot } from '@/components/ExploreMap'
import { hapticSurveyStepComplete, hapticSaved, hapticBookingConfirmed, triggerHaptic } from '@/lib/haptics'
import { getCurrentUser } from '@/lib/auth-client'
import { authHeaders } from '@/lib/api-client'
import BookingSheet, { type BookingDetails, type BookingResult } from '@/components/BookingSheet'
import TripMap from '@/components/TripMap'
import Price from '@/components/Price'
import { useWatchedLocation } from '@/lib/geo'
import { estimateMinutes, haversineKm } from '@/lib/routing'
import { shareOrCopy } from '@/lib/share'
import { AddGemSheet, GemDetailSheet, useHiddenGems, type GemDetail } from '@/components/HiddenGems'
import TripPlanner from '@/components/TripPlanner'
import { bookTripPaid, createInviteLink, createTrip, createViewLink, fetchMyTrips, tripApi, type TripView } from '@/lib/trip-client'
import { useErrorText, useLang, usePatois } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { directionsUrl } from '@/lib/calendar'
import { MAX_WALK_KM } from '@/lib/routing'
import { readSaved, toggleSaved } from '@/lib/saved'
import { absoluteUrl } from '@/lib/site-url'
import BackButton from '@/components/BackButton'
import CrewChat from '@/components/CrewChat'
import ShareLocationToggle from '@/components/ShareLocationToggle'
import Img from '@/components/Img'
import SmartVideo from '@/components/SmartVideo'
import Link from 'next/link'
import type { DictKey } from '@/lib/i18n'
import { useRegion } from '@/components/RegionProvider'
import { vibeMoodNames } from '@/lib/vibes'
import { pressable } from '@/lib/pressable'
import ErrorState from '@/components/ErrorState'
import { formatCity } from '@/lib/format'
import type { GeneratedBundle } from '@/lib/experience-generator'
import { cacheTripForOffline, clearTripCache, getActiveCachedTrip, getCachedTrip, updateCachedTrip, useOnline } from '@/lib/trip-offline'
import { RegionPill } from '@/components/RegionSelector'

type Pin = { type: 'vendor'; data: MapVendor } | { type: 'photospot'; data: MapPhotoSpot }

const DISCOVER_CATEGORIES = [
  { value: 'FOOD', icon: 'food' },
  { value: 'DRINKS', icon: 'glass' },
  { value: 'ACTIVITY', icon: 'party' },
  { value: 'WELLNESS', icon: 'spa' },
  { value: 'BEACH', icon: 'wave' }
]

// Maps a vendor's category to the same icon convention used by Mood.icon,
// so "Plan a trip here" can pick a real, relevant mood instead of a fake one.
const CATEGORY_TO_MOOD_ICON: Record<string, string> = {
  FOOD: 'food',
  DRINKS: 'glass',
  ACTIVITY: 'party',
  WELLNESS: 'spa',
  BEACH: 'wave'
}

function formatCategory(category: string): string {
  if (!category) return ''
  return category.charAt(0) + category.slice(1).toLowerCase()
}

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
  /** Real bookings made today (0 = show nothing). */
  bookedToday?: number
  totalMinutes?: number | null
  meetingLat?: number | null
  meetingLng?: number | null
  startTimes?: string[]
  maxPartySize?: number | null
  cancellationTier?: string
  cancellationPolicy?: string | null
  /** Set when this option came from the route generator rather than a curated experience. */
  generated?: GeneratedBundle
}

interface Mood {
  id: string
  name: string
  icon: string
  description: string
  coverImage: string
  videoUrl?: string | null
}

interface Booking {
  id: string
  status: string
  date: string
  userId: string
  experience?: { name: string } | null
  vendor?: { name: string } | null
}

interface SurveyState {
  time: string | null
  crew: string[]
  mood: string[]
  transport: string | null
}

const TIME_META: Record<string, { label: DictKey; emoji: string }> = {
  '2hr': { label: 'm.exp.time.2hr', emoji: '⚡' },
  'half': { label: 'm.exp.time.half', emoji: '🌤' },
  'full': { label: 'm.exp.time.full', emoji: '☀️' },
  'night': { label: 'm.exp.time.night', emoji: '🌙' }
}

const LOADING_MESSAGES: DictKey[] = ['m.exp.loading1', 'm.exp.loading2', 'm.exp.loading3', 'm.exp.loading4']

const TRANSPORT_META: Record<string, { label: DictKey; emoji: string }> = {
  drive: { label: 'm.exp.transport.drive', emoji: '🚗' },
  walk: { label: 'm.exp.transport.walk', emoji: '🚶' },
  handled: { label: 'm.exp.transport.handled', emoji: '🚕' }
}

type SortKey = 'Recommended' | 'Price' | 'Duration' | 'Distance'
const SORTS: SortKey[] = ['Recommended', 'Price', 'Duration', 'Distance']
const PRICE_CAPS = [null, 50, 100, 200] as const
const LENGTHS = [null, 'short', 'halfDay', 'fullDay'] as const
type LengthKey = (typeof LENGTHS)[number]

function minutesOf(e: Experience): number | null {
  return e.generated?.totalMinutes ?? e.totalMinutes ?? null
}

function startPoint(e: Experience): { lat: number; lng: number } | null {
  const first = e.generated?.stops[0]
  if (first && typeof first.lat === 'number' && typeof first.lng === 'number') return { lat: first.lat, lng: first.lng }
  if (typeof e.meetingLat === 'number' && typeof e.meetingLng === 'number') return { lat: e.meetingLat, lng: e.meetingLng }
  return null
}

// "Walk" biases stops toward this travel-time ceiling (minutes) so the
// results stay within a realistic walking range from the user's start point.
const WALK_TRAVEL_TIME_MAX = 20

// Semantic design-system colors used for avatar initials & confetti,
// in place of the old raw hex palette.
const AV_COLORS = ['var(--rum)', 'var(--gold)', 'var(--live)', 'var(--info)']

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) { h = name.charCodeAt(i) + ((h << 5) - h) }
  return AV_COLORS[Math.abs(h) % AV_COLORS.length]
}



const MODE_KEY: Record<string, DictKey> = { WALKING: 'exp.mode.WALKING', TAXI: 'exp.mode.TAXI', BOAT: 'exp.mode.BOAT' }
type T = (key: DictKey, vars?: Record<string, string | number>) => string

// A generated route shown through the same cards and detail screen as a curated experience.
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

// Generated routes list every stop with the leg between; a curated experience
// without route data falls back to a travel leg + the experience itself.
function experienceStops(exp: Experience, t: T): BundleStop[] {
  if (exp.generated) {
    return exp.generated.stops.flatMap((st, i, all) => {
      const stop: BundleStop = {
        type: st.category === 'FOOD' || st.category === 'DRINKS' ? 'food' : 'activity',
        name: st.name,
        time: `${st.arrival} · ${st.plannedDuration} min${st.type === 'photospot' ? ` · ${t('m.exp.photoSpotShort')}` : ''}`,
        img: st.image ?? '',
        lat: st.lat,
        lng: st.lng,
        kind: st.type,
        refId: st.id,
        category: st.category
      }
      const leg: BundleStop[] = i < all.length - 1 && st.transportModeToNext
        ? [{ type: 'transport', name: '', time: '', img: '', label: `${MODE_KEY[st.transportModeToNext] ? t(MODE_KEY[st.transportModeToNext]) : st.transportModeToNext} · ${st.transportDurationToNext} min` }]
        : []
      return [stop, ...leg]
    })
  }
  return [
    { type: 'transport', name: '', time: '', img: '', label: t('m.exp.minFrom', { mode: exp.travelMode || t('m.exp.travel'), n: exp.travelTime, place: exp.startLocation }) },
    { type: 'activity', name: exp.name, time: exp.tagline, img: exp.imageUrl }
  ]
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

export default function ExperiencesPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<'survey' | 'loading' | 'results' | 'detail' | 'trip' | 'active'>('survey')
  const [surveyStep, setSurveyStep] = useState(0)
  const [survey, setSurvey] = useState<SurveyState>({ time: null, crew: [], mood: [], transport: null })
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [moods, setMoods] = useState<Mood[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [dataFailed, setDataFailed] = useState(false)
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null)
  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(null)
  // Route options from /api/experiences/generate for the current survey answers.
  const [bundles, setBundles] = useState<Experience[]>([])
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [activeStops, setActiveStops] = useState<BundleStop[]>([])
  const [currentStopIndex, setCurrentStopIndex] = useState(0)
  const [points, setPoints] = useState(0)
  // What the booking sheet is booking: the selected experience/route, or a planned crew trip.
  const [bookingFor, setBookingFor] = useState<'selected' | TripView | null>(null)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [groupMembers, setGroupMembers] = useState<Array<{ id?: string; name: string; status: string }>>([])
  // The crew trip started from the survey's invite step (before an experience is picked).
  const [draftTrip, setDraftTrip] = useState<TripView | null>(null)
  const [inviteName, setInviteName] = useState('')
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [splitOn, setSplitOn] = useState(true)
  const [sortBy, setSortBy] = useState<SortKey>('Recommended')
  const [priceCap, setPriceCap] = useState<number | null>(null)
  const [lengthFilter, setLengthFilter] = useState<LengthKey>(null)
  const [payingShare, setPayingShare] = useState(false)
  // The trip behind the current plan/booking (B1 group planning, B3 add-to-trip).
  const [activeTrip, setActiveTrip] = useState<TripView | null>(null)
  const [tripsInProgress, setTripsInProgress] = useState<TripView[]>([])
  const [startingTrip, setStartingTrip] = useState(false)
  const [tripError, setTripError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null)
  const online = useOnline()
  const { t } = useLang()
  const patois = usePatois()
  const errorText = useErrorText()
  const labels = useLabels()
  const { city: regionCity, town: regionTown } = useRegion()
  const [crewInput, setCrewInput] = useState('')
  const [showChangePlan, setShowChangePlan] = useState(false)
  const [showRouteSheet, setShowRouteSheet] = useState(false)
  const [swapSelection, setSwapSelection] = useState<string | null>(null)
  const [adapting, setAdapting] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [selectAnim, setSelectAnim] = useState<string | null>(null)
  const [planningPoints, setPlanningPoints] = useState(0)
  const [quickActionsBundle, setQuickActionsBundle] = useState<string | null>(null)
  const [booking, setBooking] = useState(false)
  const [showBookingSuccess, setShowBookingSuccess] = useState(false)
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0)
  const [tabMode, setTabMode] = useState<'plan' | 'discover'>('plan')
  const [mapVendors, setMapVendors] = useState<MapVendor[]>([])
  const [mapPhotoSpots, setMapPhotoSpots] = useState<MapPhotoSpot[]>([])
  const [discoverCategory, setDiscoverCategory] = useState<string | null>(null)
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const [stepDirection, setStepDirection] = useState<'forward' | 'back'>('forward')
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const surveySteps = ['mood', 'time', 'crew', 'transport']

  useEffect(() => {
    fetchAll()
    fetchMyTrips(['PLANNING']).then(setTripsInProgress).catch(() => {})
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
  }, [])

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

  // Live position for the active trip's map and ETA.
  const userPos = useWatchedLocation(screen === 'active' || tabMode === 'discover')
  // Hidden Gems on the Discover map (revealed near you; the rest stay fogged).
  const hiddenGems = useHiddenGems(userPos, tabMode === 'discover')
  const [selectedGem, setSelectedGem] = useState<GemDetail | null>(null)
  const [addingGem, setAddingGem] = useState(false)

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
        const list: Mood[] = Array.isArray(data) ? data : []
        setMoods(list)
        // Start the survey from the onboarding vibe's moods.
        const vibeNames = vibeMoodNames()
        const preset = list.filter(m => vibeNames.includes(m.name)).slice(0, 3).map(m => m.id)
        if (preset.length) setSurvey(prev => (prev.mood.length ? prev : { ...prev, mood: preset }))
      }
      if (vendorsRes.status === 'fulfilled' && vendorsRes.value.ok) {
        const data = await vendorsRes.value.json()
        setMapVendors(Array.isArray(data) ? data.filter((v: MapVendor) => v.visibleOnMap && !v.isTransport) : [])
      }
      if (spotsRes.status === 'fulfilled' && spotsRes.value.ok) {
        const data = await spotsRes.value.json()
        setMapPhotoSpots(Array.isArray(data) ? data : [])
      }
      if (bookingsRes.status === 'fulfilled' && bookingsRes.value.ok) {
        const currentUser = getCurrentUser()
        if (currentUser) {
          const data: Booking[] = await bookingsRes.value.json()
          const now = Date.now()
          const active = data
            .filter(b => b.status === 'CONFIRMED')
            .filter(b => {
              const t = new Date(b.date).getTime()
              return t >= now - 3 * 3600000 && t <= now + 6 * 3600000
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
          setActiveBooking(active || null)
        }
      }
    } catch (error) {
      console.error('Fetch error:', error)
      setDataFailed(true)
    } finally {
      setDataLoading(false)
    }
  }

  const triggerSelectAnim = (id: string) => {
    triggerHaptic('selection')
    setSelectAnim(id)
    setTimeout(() => setSelectAnim(null), 300)
  }

  // Real experiences filtered by the moods picked in the survey (same
  // matching pattern app/page.tsx uses), then biased by the transport
  // preference: "walk" narrows to stops within a realistic walking range
  // (using the experience's real travelTime field) when that leaves any
  // options at all; driving or having transport handled removes that cap.
  const filteredExperiences = (() => {
    const inRegion = experiences.filter(e => e.city === regionCity)
    const byMood = survey.mood.length > 0
      ? inRegion.filter(e => e.moods?.some(m => survey.mood.includes(m.id) || survey.mood.includes(m.name)))
      : inRegion
    if (survey.transport === 'walk') {
      const walkable = byMood.filter(e => e.travelTime <= WALK_TRAVEL_TIME_MAX)
      return walkable.length > 0 ? walkable : byMood
    }
    return byMood
  })()

  const nextStep = () => {
    hapticSurveyStepComplete()
    setStepDirection('forward')
    if (surveyStep >= surveySteps.length - 1) {
      setScreen('loading')
      setPlanningPoints(25)
      generateRoutes().then(() => {
        setScreen('results')
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 1500)
      })
      return
    }
    setSurveyStep(prev => prev + 1)
  }

  // Builds fresh route options from real vendors and photo spots. Keeps the
  // loading screen up at least ~1.5s so it doesn't flash.
  const generateRoutes = async () => {
    setGenerateError(null)
    const city = regionCity
    const [res] = await Promise.allSettled([
      fetch('/api/experiences/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moods: survey.mood, time: survey.time, crewSize: 1 + survey.crew.length, transport: survey.transport, city })
      }).then(r => r.json()),
      new Promise(r => setTimeout(r, 1500))
    ])
    if (res.status === 'fulfilled' && Array.isArray(res.value?.bundles) && res.value.bundles.length) {
      setBundles(res.value.bundles.map((b: GeneratedBundle) => bundleToExperience(b, t)))
    } else {
      // Fall back to the curated experiences for these moods.
      setBundles([])
      setGenerateError(t('m.exp.generateFailed'))
    }
  }

  const prevStep = () => {
    if (surveyStep <= 0) return
    triggerHaptic('selection')
    setStepDirection('back')
    setSurveyStep(prev => Math.max(0, prev - 1))
  }

  // Manual "Fawud"-equivalent steps (mood needs a pick, crew has no minimum);
  // time and transport auto-advance the instant a card is tapped, so a
  // forward swipe on those steps has nothing to confirm.
  const canSwipeForward = () => {
    if (surveyStep === 0) return survey.mood.length > 0
    if (surveyStep === 2) return true
    return false
  }

  const handleStepTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    setDragging(true)
  }

  const handleStepTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const dx = e.touches[0].clientX - touchStartRef.current.x
    const dy = e.touches[0].clientY - touchStartRef.current.y
    if (Math.abs(dy) > Math.abs(dx)) return
    const atStart = surveyStep === 0 && dx > 0
    const blockedForward = dx < 0 && !canSwipeForward()
    const eased = (atStart || blockedForward) ? dx * 0.25 : dx
    setDragX(Math.max(-120, Math.min(120, eased)))
  }

  const handleStepTouchEnd = () => {
    const dx = dragX
    setDragging(false)
    setDragX(0)
    touchStartRef.current = null
    const THRESHOLD = 56
    if (dx <= -THRESHOLD && canSwipeForward()) {
      nextStep()
    } else if (dx >= THRESHOLD && surveyStep > 0) {
      prevStep()
    }
  }

  const toggleMood = (moodId: string) => {
    setSurvey(prev => {
      const has = prev.mood.includes(moodId)
      if (has) return { ...prev, mood: prev.mood.filter(m => m !== moodId) }
      if (prev.mood.length >= 3) return prev
      triggerSelectAnim(moodId)
      return { ...prev, mood: [...prev.mood, moodId] }
    })
  }

  // Curated experiences have their own deep-linkable page; generated routes
  // only exist in this session, so they open the in-page detail screen.
  const openExperience = (exp: Experience) => {
    triggerHaptic('light')
    if (!exp.generated) {
      const crew = survey.crew.length ? `?crew=${encodeURIComponent(survey.crew.join(','))}` : ''
      router.push(`/experiences/${exp.id}${crew}`)
      return
    }
    setSelectedExperience(exp)
    setScreen('detail')
  }

  // "Plan a trip here" from a Discover-mode pin: pre-fill the survey's mood
  // step with a real mood that matches the vendor's category (via the same
  // icon convention both share), then hand off to Plan mode at step 0.
  const planTripFromVendor = (vendor: MapVendor) => {
    const icon = CATEGORY_TO_MOOD_ICON[vendor.category]
    const matchedMood = icon ? moods.find(m => m.icon === icon) : undefined
    setSurvey(prev => ({ ...prev, mood: matchedMood ? [matchedMood.id] : prev.mood }))
    setSelectedPin(null)
    setScreen('survey')
    setSurveyStep(0)
    setTabMode('plan')
  }

  const planTripFromPhotoSpot = () => {
    setSelectedPin(null)
    setScreen('survey')
    setSurveyStep(0)
    setTabMode('plan')
  }

  // Survey crew step: invite real people with a link. The first invite starts
  // a draft crew trip (no experience yet); picking one later fills it in.
  const ensureDraftTrip = async (): Promise<TripView> => {
    if (draftTrip) return draftTrip
    const trip = await createTrip({ name: t('m.survey.crewTrip'), city: regionCity, crew: survey.crew })
    setDraftTrip(trip)
    return trip
  }

  const shareInvite = async () => {
    setInviting(true)
    setInviteMsg(null)
    try {
      const trip = await ensureDraftTrip()
      const name = inviteName.trim()
      const url = await createInviteLink(trip.slug, name || undefined)
      await shareOrCopy({ title: trip.name, text: t('m.crew.inviteText', { name: trip.name }), url })
      triggerHaptic('medium')
      setInviteMsg(name ? t('m.survey.inviteSent', { name }) : t('m.survey.inviteSentAnon'))
      if (name && !survey.crew.some(c => c.toLowerCase() === name.toLowerCase())) setSurvey(prev => ({ ...prev, crew: [...prev.crew, name] }))
      setInviteName('')
    } catch (e) {
      setInviteMsg(errorText(e))
    } finally {
      setInviting(false)
    }
  }

  // Names typed after the draft exists are added to it too.
  const addCrewName = (name: string) => {
    setSurvey(prev => ({ ...prev, crew: [...prev.crew, name] }))
    if (draftTrip) tripApi(draftTrip.slug, '/members', { method: 'POST', body: { name } }).then(setDraftTrip).catch(() => {})
  }

  // Put the picked experience (or generated route) into the draft crew trip.
  const fillDraft = async (draft: TripView, exp: Experience): Promise<TripView> => {
    if (exp.generated) {
      let latest = draft
      for (const st of exp.generated.stops) {
        latest = await tripApi<TripView>(draft.slug, '/stops', { method: 'POST', body: st.type === 'vendor' ? { vendorId: st.id, time: st.arrival } : { photoSpotId: st.id, time: st.arrival } })
      }
      return tripApi<TripView>(draft.slug, '', { method: 'PATCH', body: { name: exp.name } })
    }
    return tripApi<TripView>(draft.slug, '', { method: 'PATCH', body: { name: exp.name, experienceId: exp.id } })
  }

  const tripFor = async (exp: Experience): Promise<TripView> => {
    if (draftTrip) {
      const filled = await fillDraft(draftTrip, exp)
      setDraftTrip(null)
      return { ...filled, canEdit: true }
    }
    return createTrip(tripInputFor(exp))
  }

  // Curated experiences are linked by id; generated routes become the trip's stops.
  const tripInputFor = (exp: Experience) => exp.generated
    ? {
        name: exp.name,
        crew: survey.crew,
        city: exp.city,
        stops: exp.generated.stops.map(st => (st.type === 'vendor' ? { vendorId: st.id, time: st.arrival } : { photoSpotId: st.id, time: st.arrival }))
      }
    : { name: exp.name, experienceId: exp.id, crew: survey.crew, city: exp.city }

  // "Plan with crew first": turn the chosen experience + the crew from the
  // survey into a shared trip the crew can vote on before anything is booked.
  const startCrewTrip = async () => {
    if (!selectedExperience) return
    setStartingTrip(true)
    setTripError(null)
    try {
      const trip = await tripFor(selectedExperience)
      setActiveTrip(trip)
      setTripsInProgress(prev => [trip, ...prev.filter(t => t.slug !== trip.slug)])
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
    const trip = target === 'selected' ? await tripFor(selectedExperience!) : target
    const estimate = trip.experience ? undefined : selectedExperience?.generated?.price
    const booked = await bookTripPaid(trip.slug, details, estimate, splitOn && trip.members.length > 1)
    setPoints(getCurrentUser()?.points ?? 0)
    // Save everything the active screen needs in case the signal drops (B2).
    cacheTripForOffline(booked)
    setTripsInProgress(prev => prev.filter(t => t.slug !== trip.slug))
    setActiveTrip(booked)
    return booked
  }

  const finishBookingFlow = () => {
    setBookingFor(null)
    if (activeTrip) enterActiveFromTrip(activeTrip)
    setScreen('active')
  }

  // Price per person the booking sheet charges: the curated price, the
  // generated route's estimate, or the trip's experience price.
  // Start times, capacity and the cancellation policy of what's being booked
  // (curated experiences only — generated routes have none), plus the split
  // option for crew trips.
  const bookingDetailsFor = (target: 'selected' | TripView | null) => {
    const exp = target === 'selected' ? (selectedExperience?.generated ? null : selectedExperience) : target?.experience ?? null
    const crewSize = target && target !== 'selected' ? target.members.length : draftTrip ? draftTrip.members.length : 1 + survey.crew.length
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

  // Long-press quick actions for experience cards
  const startBundleLongPress = (id: string) => {
    longPressTimer.current = setTimeout(() => {
      setQuickActionsBundle(id)
    }, 450)
  }

  const cancelBundleLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const dismissQuickActions = () => {
    setQuickActionsBundle(null)
  }

  const handleSaveBundle = (exp: Experience) => {
    hapticSaved()
    toggleSaved('experiences', exp.id)
    dismissQuickActions()
  }

  const handleShareBundle = (exp: Experience) => {
    shareOrCopy({ title: exp.name, text: `${exp.name} — ${exp.tagline}`, url: exp.generated ? absoluteUrl('/experiences') : absoluteUrl(`/experiences/${exp.id}`) }).catch(() => {})
    dismissQuickActions()
  }

  // Persistent Plan/Discover segmented control, shown atop survey, results
  // and detail screens. Switching modes never resets `screen`/`survey`/
  // `selectedExperience` state, so flipping back to Plan resumes exactly
  // where the user left off.
  const renderModeSwitch = () => (
    <div className="mode-switch-sticky" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div className="segmented-control" style={{ flex: 1 }}>
        <button aria-pressed={tabMode === 'plan'} className={`segmented-control-option ${tabMode === 'plan' ? 'active' : ''}`} onClick={() => { triggerHaptic('selection'); setTabMode('plan') }}>
          <Icon name="compass" size={16} />
          {t('m.exp.plan')}
        </button>
        <button aria-pressed={tabMode === 'discover'} className={`segmented-control-option ${tabMode === 'discover' ? 'active' : ''}`} onClick={() => { triggerHaptic('selection'); setTabMode('discover') }}>
          <Icon name="mapPin" size={16} />
          {t('m.exp.discover')}
        </button>
      </div>
      <RegionPill />
    </div>
  )

  const regionMapVendors = mapVendors.filter(v => v.city === regionCity)
  const filteredMapVendors = discoverCategory
    ? regionMapVendors.filter(v => v.category === discoverCategory)
    : regionMapVendors
  const regionPhotoSpots = mapPhotoSpots.filter(s => s.city === regionCity)

  const renderDiscover = () => (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px', display: 'flex', flexDirection: 'column' }}>
      {renderModeSwitch()}
      <div className="mood-picker" style={{ padding: '0 16px 12px' }}>
        {DISCOVER_CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => { triggerHaptic('selection'); setDiscoverCategory(discoverCategory === cat.value ? null : cat.value) }}
            className={`mood-pill ${discoverCategory === cat.value ? 'centre' : ''}`}
          >
            <Icon name={cat.icon} size={16} />
            {labels.category(cat.value)}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, position: 'relative', minHeight: '360px' }}>
        <ExploreMap
          key={regionCity}
          vendors={filteredMapVendors}
          photoSpots={regionPhotoSpots}
          center={[regionTown.lat, regionTown.lng]}
          onVendorTap={(v) => { triggerHaptic('light'); setSelectedPin({ type: 'vendor', data: v }) }}
          onPhotoSpotTap={(s) => { triggerHaptic('light'); setSelectedPin({ type: 'photospot', data: s }) }}
          gems={hiddenGems.gems}
          fog={hiddenGems.fog}
          user={userPos}
          onGemTap={(g) => { triggerHaptic('light'); setSelectedGem(hiddenGems.gems.find(x => x.id === g.id) ?? null) }}
        />
        <div style={{ position: 'absolute', left: '12px', right: '12px', bottom: '12px', zIndex: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="chip" style={{ cursor: 'default', fontSize: '13px', minHeight: '36px', background: 'var(--system-bg-elevated)', boxShadow: 'var(--shadow-card)' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#AF52DE' }} />
            {hiddenGems.failed ? t('m.gems.loadFailed') : t('m.gems.legend', { n: hiddenGems.gems.length, fogged: hiddenGems.fog.reduce((a, c) => a + c.count, 0) })}
          </span>
          <button className="btn btn-primary" onClick={() => { triggerHaptic('light'); setAddingGem(true) }} style={{ marginLeft: 'auto', minHeight: '40px', padding: '0 14px', fontSize: '14px', boxShadow: 'var(--shadow-elevated)' }}>
            <Icon name="plus" size={14} /> {t('m.gems.addShort')}
          </button>
        </div>
      </div>

      <GemDetailSheet gem={selectedGem} pos={userPos} onClose={() => setSelectedGem(null)} onChanged={hiddenGems.reload} />
      <AddGemSheet open={addingGem} pos={userPos} onClose={() => setAddingGem(false)} onAdded={hiddenGems.reload} />

      <div className={`bottom-sheet-overlay ${selectedPin ? 'open' : ''}`} onClick={() => setSelectedPin(null)} />
      <div className={`bottom-sheet ${selectedPin ? 'open' : ''}`}>
        <div className="sheet-grabber" />
        {selectedPin && selectedPin.type === 'vendor' && (
          <div style={{ padding: '0 20px 20px' }}>
            {selectedPin.data.images?.[0] && (
              <div style={{ height: '160px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '12px' }}><Img src={selectedPin.data.images[0]} alt={selectedPin.data.name} width={720} height={320} /></div>
            )}
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '4px' }}>{selectedPin.data.name}</h3>
            <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '20px' }}>
              {labels.category(selectedPin.data.category)} · {selectedPin.data.neighborhood}
            </p>
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: '8px' }} onClick={() => planTripFromVendor(selectedPin.data)}>
              {t('m.exp.planHere')}
            </button>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => router.push(`/vendor/${selectedPin.data.id}?from=experiences`)}>
              {t('m.exp.viewVendor')}
            </button>
          </div>
        )}
        {selectedPin && selectedPin.type === 'photospot' && (
          <div style={{ padding: '0 20px 20px' }}>
            {selectedPin.data.officialPhoto && (
              <div style={{ height: '160px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '12px' }}><Img src={selectedPin.data.officialPhoto} alt={selectedPin.data.name} width={720} height={320} /></div>
            )}
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '4px' }}>{selectedPin.data.name}</h3>
            <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '20px' }}>{selectedPin.data.description}</p>
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: '8px' }} onClick={planTripFromPhotoSpot}>
              {t('m.exp.planHere')}
            </button>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => router.push(`/photospot/${selectedPin.data.id}`)}>
              {t('m.exp.viewSpot')}
            </button>
          </div>
        )}
      </div>

      <Dock />
    </main>
  )

  if (tabMode === 'discover' && (screen === 'survey' || screen === 'results' || screen === 'detail')) {
    return renderDiscover()
  }

  // SURVEY
  if (screen === 'survey') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
        {renderModeSwitch()}
        {activeBooking && (
          <div style={{ padding: '16px 16px 0' }}>
            <ActiveTripBanner
                title={activeBooking.experience?.name || activeBooking.vendor?.name || t('m.home.yourTrip')}
                start={activeBooking.date}
                tripSlug={activeTrip?.status === 'BOOKED' ? activeTrip.slug : null}
                href="/bookings"
              />
          </div>
        )}
        <div style={{ padding: '16px' }}>
          {tripsInProgress.length > 0 && surveyStep === 0 && (
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.survey.tripsInProgress')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tripsInProgress.slice(0, 3).map(tr => (
                  <button
                    key={tr.slug}
                    onClick={() => { triggerHaptic('light'); setActiveTrip(tr); setScreen('trip') }}
                    className="card"
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: 'none', textAlign: 'left', fontFamily: 'inherit', width: '100%' }}
                  >
                    <span style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--rum-tint)', color: 'var(--rum-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name="route" size={18} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: 'var(--label-primary)' }}>{tr.name}</span>
                      <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>
                        {tr.stops.length === 1 ? t('m.addTrip.oneStop') : t('m.addTrip.stops', { n: tr.stops.length })} · {t('m.exp.inCrew', { n: tr.members.length })}
                      </span>
                    </span>
                    <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            {surveyStep > 0 && (
              <button
                onClick={prevStep}
                aria-label={t('m.common.back')}
                className="back-button"
              >
                <Icon name="back" size={16} />
              </button>
            )}
            <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
              {surveySteps.map((_, i) => (
                <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'var(--separator)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: i < surveyStep ? '100%' : i === surveyStep ? '50%' : '0%',
                    background: 'var(--rum)',
                    borderRadius: '2px',
                    transition: 'width 0.4s var(--spring-standard)'
                  }} />
                </div>
              ))}
            </div>
          </div>

          <div
            key={surveyStep}
            onTouchStart={handleStepTouchStart}
            onTouchMove={handleStepTouchMove}
            onTouchEnd={handleStepTouchEnd}
            className={!dragging ? (stepDirection === 'forward' ? 'survey-step-forward' : 'survey-step-back') : ''}
            style={dragging ? { transform: `translateX(${dragX}px)`, opacity: 1 - Math.min(0.6, Math.abs(dragX) / 300) } : undefined}
          >
          {surveyStep === 0 && (
            <>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.survey.step', { n: 1 })}</p>
              <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginBottom: '8px' }}>{t('m.survey.moodTitle')}</h2>
              <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '16px' }}>{t('m.survey.moodSub')}</p>
              {dataLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="skeleton-card" style={{ height: '96px' }}>
                      <div className="skeleton-image" style={{ height: '100%' }} />
                    </div>
                  ))}
                </div>
              ) : dataFailed ? (
                <ErrorState onRetry={fetchAll} />
              ) : moods.length === 0 ? (
                <div className="empty-state">
                  <Icon name="sparkle" size={32} style={{ color: 'var(--label-tertiary)' }} />
                  <p style={{ fontSize: '17px', fontWeight: 600 }}>{t('m.exp.noVibes')}</p>
                </div>
              ) : (
                <div className="mood-video-grid">
                  {moods.map((m, i) => (
                    <div
                      key={m.id}
                      onClick={() => toggleMood(m.id)}
                      {...pressable(() => toggleMood(m.id))}
                      aria-pressed={survey.mood.includes(m.id)}
                      aria-label={m.name}
                      className={`mood-video-tile mood-video-tile-compact ${survey.mood.includes(m.id) ? 'selected' : ''} ${selectAnim === m.id ? 'select-bounce' : ''}`}
                    >
                      {m.videoUrl ? (
                        <SmartVideo src={m.videoUrl} poster={m.coverImage} alt={m.name} />
                      ) : (
                        <Img src={m.coverImage} alt={m.name} width={300} height={300} sizes="33vw" />
                      )}
                      <div className="mood-video-tile-overlay" />
                      <div className="mood-video-tile-label mood-video-tile-label-compact" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Icon name={m.icon} size={12} />
                        {m.name}
                      </div>
                      {survey.mood.includes(m.id) && (
                        <div key={`check-${m.id}`} className="check-pop-in" style={{ position: 'absolute', top: '6px', right: '6px', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--rum)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="check" size={10} style={{ color: 'white' }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <button className="btn btn-primary" onClick={nextStep} disabled={survey.mood.length === 0} style={{ width: '100%', marginTop: '16px' }}>{patois.ctaPrimary}</button>
            </>
          )}

          {surveyStep === 1 && (
            <>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.survey.step', { n: 2 })}</p>
              <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginBottom: '16px' }}>{t('m.survey.timeTitle')}</h2>
              {Object.entries(TIME_META).map(([id, meta]) => (
                <div
                  key={id}
                  onClick={() => { setSurvey(prev => ({ ...prev, time: id })); triggerSelectAnim(id); setTimeout(nextStep, 250) }}
                  {...pressable(() => { setSurvey(prev => ({ ...prev, time: id })); triggerSelectAnim(id); setTimeout(nextStep, 250) })}
                  aria-pressed={survey.time === id}
                  className={selectAnim === id ? 'select-bounce' : ''}
                  style={{
                    padding: '16px',
                    borderRadius: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '8px',
                    background: survey.time === id ? 'var(--rum)' : 'var(--system-bg-elevated)',
                    border: '1px solid var(--separator)',
                    minHeight: '44px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{meta.emoji}</span>
                  <span style={{ fontSize: '17px', fontWeight: 600, color: survey.time === id ? 'white' : 'var(--label-primary)' }}>{t(meta.label)}</span>
                  {survey.time === id && (
                    <div key={`check-${id}`} className="check-pop-in" style={{ marginLeft: 'auto', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="check" size={12} style={{ color: 'white' }} />
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {surveyStep === 2 && (
            <>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.survey.step', { n: 3 })}</p>
              <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginBottom: '16px' }}>{t('m.survey.crewTitle')}</h2>
              <div className="card" style={{ padding: '14px', marginBottom: '16px', cursor: 'default' }}>
                <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)' }}><Icon name="users" size={18} style={{ color: 'var(--rum-text)' }} /> {t('m.survey.inviteTitle')}</p>
                <p style={{ fontSize: '13px', color: 'var(--label-secondary)', margin: '4px 0 10px', lineHeight: 1.4 }}>{t('m.survey.inviteBody')}</p>
                {getCurrentUser() ? (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input value={inviteName} maxLength={40} onChange={e => setInviteName(e.target.value)} placeholder={t('m.survey.inviteName')} aria-label={t('m.survey.inviteName')} style={{ flex: 1, minWidth: '140px', padding: '12px', borderRadius: '14px', border: '1px solid var(--separator)', background: 'var(--system-bg)', fontSize: '16px', fontFamily: 'inherit', color: 'var(--label-primary)', outline: 'none', minHeight: '44px' }} />
                    <button className="btn btn-primary" onClick={shareInvite} disabled={inviting} style={{ padding: '0 14px' }}><Icon name="share" size={16} /> {t('m.survey.inviteSend')}</button>
                  </div>
                ) : (
                  <Link href="/login?next=/experiences" className="btn btn-secondary" style={{ width: '100%', textDecoration: 'none' }}>{t('m.survey.inviteLogin')}</Link>
                )}
                {inviteMsg && <p role="status" style={{ fontSize: '13px', color: 'var(--label-primary)', marginTop: '8px' }}>{inviteMsg}</p>}
                {draftTrip && draftTrip.members.filter(m => m.hasAccount && !m.isOwner).length > 0 && (
                  <p style={{ fontSize: '12px', color: 'var(--success)', marginTop: '6px' }}>{t('m.survey.joined', { n: draftTrip.members.filter(m => m.hasAccount && !m.isOwner).length })}</p>
                )}
              </div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.survey.orType')}</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  value={crewInput}
                  onChange={(e) => setCrewInput(e.target.value)}
                  placeholder={t('m.survey.crewAdd')}
                  aria-label={t('m.survey.crewAdd')}
                  style={{ flex: 1, padding: '12px', borderRadius: '14px', border: '1px solid var(--separator)', background: 'var(--system-bg-elevated)', fontSize: '17px', fontFamily: 'inherit', color: 'var(--label-primary)', outline: 'none', minHeight: '44px' }}
                />
                <button aria-label={t('m.survey.crewAdd')} onClick={() => { if (crewInput.trim()) { addCrewName(crewInput.trim()); setCrewInput(''); triggerSelectAnim('crew') } }} style={{ width: '44px', borderRadius: '14px', background: 'var(--rum)', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px' }}>
                  <Icon name="plus" size={16} />
                </button>
              </div>
              {survey.crew.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {survey.crew.map((name, i) => (
                    <span key={i} style={{ padding: '6px 12px', borderRadius: '999px', background: 'var(--system-bg-elevated)', border: '1px solid var(--separator)', fontSize: '15px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', minHeight: '36px' }}>
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'white' }}>{name[0].toUpperCase()}</span>
                      {name}
                    </span>
                  ))}
                </div>
              )}
              <button className="btn btn-primary" onClick={nextStep} style={{ width: '100%' }}>{patois.ctaPrimary}</button>
            </>
          )}

          {surveyStep === 3 && (
            <>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.survey.step', { n: 4 })}</p>
              <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginBottom: '8px' }}>{t('m.survey.transportTitle')}</h2>
              <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '16px' }}>{t('m.survey.transportSub')}</p>
              {Object.entries(TRANSPORT_META).map(([id, meta]) => (
                <div
                  key={id}
                  onClick={() => { setSurvey(prev => ({ ...prev, transport: id })); triggerSelectAnim(id); setTimeout(nextStep, 300) }}
                  {...pressable(() => { setSurvey(prev => ({ ...prev, transport: id })); triggerSelectAnim(id); setTimeout(nextStep, 300) })}
                  aria-pressed={survey.transport === id}
                  className={selectAnim === id ? 'select-bounce' : ''}
                  style={{
                    padding: '16px',
                    borderRadius: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '8px',
                    background: survey.transport === id ? 'var(--rum)' : 'var(--system-bg-elevated)',
                    border: '1px solid var(--separator)',
                    minHeight: '44px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{meta.emoji}</span>
                  <span style={{ fontSize: '17px', fontWeight: 600, color: survey.transport === id ? 'white' : 'var(--label-primary)' }}>{t(meta.label)}</span>
                  {survey.transport === id && (
                    <div key={`check-${id}`} className="check-pop-in" style={{ marginLeft: 'auto', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="check" size={12} style={{ color: 'white' }} />
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
          </div>
        </div>
        <Dock />
      </main>
    )
  }

  // LOADING
  if (screen === 'loading') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', paddingBottom: '80px' }}>
        <div className="loading-icon-fade" style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--rum-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkle" size={22} style={{ color: 'var(--rum)' }} />
        </div>
        <p key={loadingMsgIndex} className="loading-text-fade" style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>
          {t(LOADING_MESSAGES[loadingMsgIndex])}
        </p>
      </main>
    )
  }

  // RESULTS with long-press quick actions
  if (screen === 'results') {
    const all = bundles.length ? bundles : filteredExperiences
    const kmTo = (e: Experience) => { const p = startPoint(e); return userPos && p ? haversineKm(userPos, p) : null }
    const filtered = all.filter(e => {
      if (priceCap !== null && e.price > priceCap) return false
      const mins = minutesOf(e)
      if (lengthFilter && mins !== null) {
        if (lengthFilter === 'short' && mins >= 180) return false
        if (lengthFilter === 'halfDay' && (mins < 180 || mins > 360)) return false
        if (lengthFilter === 'fullDay' && mins <= 360) return false
      }
      return true
    })
    const options = sortBy === 'Recommended' ? filtered : [...filtered].sort((a, b) => {
      if (sortBy === 'Price') return a.price - b.price
      if (sortBy === 'Duration') return (minutesOf(a) ?? Infinity) - (minutesOf(b) ?? Infinity)
      return (kmTo(a) ?? Infinity) - (kmTo(b) ?? Infinity)
    })
    const bestMatch = options[0]
    const others = options.slice(1)
    const filterChip = (active: boolean, label: string, onClick: () => void) => (
      <button key={label} className={`chip ${active ? 'active' : ''}`} aria-pressed={active} onClick={() => { triggerHaptic('selection'); onClick() }} style={{ flexShrink: 0, minHeight: '36px' }}>{label}</button>
    )

    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
        {showConfetti && (
          <>
            {[...Array(20)].map((_, i) => (
              <div key={i} className="confetti-piece" style={{ left: `${Math.random() * 100}%`, top: '-10px', background: AV_COLORS[i % AV_COLORS.length], animationDelay: `${Math.random() * 0.3}s` }} />
            ))}
          </>
        )}
        {renderModeSwitch()}
        <div style={{ padding: '16px' }}>
          {activeBooking && (
            <div style={{ marginBottom: '16px' }}>
              <ActiveTripBanner
                title={activeBooking.experience?.name || activeBooking.vendor?.name || t('m.home.yourTrip')}
                start={activeBooking.date}
                tripSlug={activeTrip?.status === 'BOOKED' ? activeTrip.slug : null}
                href="/bookings"
              />
            </div>
          )}

          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)' }}>{t('m.results.eyebrow')}</p>
            <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginTop: '2px' }}>{t('m.results.title')}</h2>
            <p style={{ fontSize: '15px', color: 'var(--rum-text)', fontWeight: 600, marginTop: '4px' }}>
              {t('m.results.points', { points: planningPoints })}
            </p>
          </div>

          {generateError && (
            <p role="status" style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '12px' }}>{generateError}</p>
          )}

          {all.length > 1 && (
            <div style={{ marginBottom: '16px' }}>
              <div className="horizontal-scroll" style={{ padding: '0 0 6px', gap: '6px' }} aria-label={t('m.results.sort')}>
                {SORTS.filter(k => k !== 'Distance' || userPos).map(k => filterChip(sortBy === k, t(`m.sort.${k}` as 'm.sort.Price'), () => setSortBy(k)))}
              </div>
              <div className="horizontal-scroll" style={{ padding: '0 0 6px', gap: '6px' }}>
                {PRICE_CAPS.map(cap => filterChip(priceCap === cap, cap === null ? t('m.results.anyPrice') : t('m.results.maxPrice', { price: `$${cap}` }), () => setPriceCap(cap)))}
              </div>
              <div className="horizontal-scroll" style={{ padding: 0, gap: '6px' }}>
                {LENGTHS.map(l => filterChip(lengthFilter === l, l === null ? t('m.results.anyLength') : t(`m.results.${l}` as 'm.results.short'), () => setLengthFilter(l)))}
              </div>
            </div>
          )}

          {options.length === 0 ? (
            <div className="empty-state">
              <Icon name="search" size={32} style={{ color: 'var(--label-tertiary)' }} />
              <p style={{ fontSize: '17px', fontWeight: 600 }}>{all.length ? t('m.results.none') : t('m.exp.noMatch')}</p>
              <button className="btn btn-secondary" onClick={() => (all.length ? (setPriceCap(null), setLengthFilter(null)) : setScreen('survey'))} style={{ marginTop: '12px' }}>{all.length ? t('m.common.clearAll') : t('m.exp.tryVibes')}</button>
            </div>
          ) : (
            <>
              {bestMatch && (
                <div
                  onTouchStart={() => startBundleLongPress(bestMatch.id)}
                  onTouchEnd={cancelBundleLongPress}
                  onTouchMove={cancelBundleLongPress}
                  onMouseDown={() => startBundleLongPress(bestMatch.id)}
                  onMouseUp={cancelBundleLongPress}
                  onMouseLeave={cancelBundleLongPress}
                  {...pressable(() => openExperience(bestMatch))}
                  aria-label={bestMatch.name}
                  onClick={() => {
                    if (quickActionsBundle === bestMatch.id) {
                      dismissQuickActions()
                      return
                    }
                    openExperience(bestMatch)
                  }}
                  className="card stagger-in"
                  style={{ position: 'relative', height: '280px', cursor: 'pointer', marginBottom: '16px', animationDelay: '0ms' }}
                >
                  <div style={{ position: 'absolute', inset: 0 }}><Img src={bestMatch.imageUrl} alt={bestMatch.name} width={1080} height={560} /></div>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.8))' }} />
                  <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'var(--rum)', color: 'white', fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: '999px' }}>
                    {t('m.exp.bestMatch')}
                  </div>

                  {quickActionsBundle === bestMatch.id && (
                    <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10, display: 'flex', gap: '6px' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSaveBundle(bestMatch) }}
                        className="tappable"
                        style={{ padding: '8px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.95)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--rum)', minHeight: '44px' }}
                      >
                        <Icon name="heart" size={14} />
                        {readSaved('experiences').includes(quickActionsBundle ?? '') ? t('m.saved.unsave') : t('m.exp.save')}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleShareBundle(bestMatch) }}
                        className="tappable"
                        style={{ padding: '8px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.95)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--rum)', minHeight: '44px' }}
                      >
                        <Icon name="share" size={14} />
                        {t('m.exp.share')}
                      </button>
                    </div>
                  )}

                  <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '20px', color: 'white' }}>
                    <h3 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>{bestMatch.name}</h3>
                    <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.85)', marginBottom: '8px' }}>{bestMatch.tagline}</p>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                      {bestMatch.generated
                        ? bestMatch.generated.stops.map(st => st.name).join(' → ')
                        : `${bestMatch.vendor?.name ? t('m.exp.hostedBy', { name: bestMatch.vendor.name }) : formatCity(bestMatch.city)} · ${t('m.exp.minAway', { n: bestMatch.travelTime })}`}
                    </p>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>
                      {bestMatch.generated ? t('m.exp.estimateNote', { pts: bestMatch.generated.pts }) : bestMatch.bookedToday ? t('m.exp.bookedToday', { n: bestMatch.bookedToday }) : null}
                      {kmTo(bestMatch) !== null && ` · ${t('m.results.kmAway', { km: kmTo(bestMatch)! < 1 ? `${Math.round(kmTo(bestMatch)! * 1000)} m` : `${kmTo(bestMatch)!.toFixed(1)} km` })}`}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Price usd={bestMatch.price} compact style={{ fontSize: '18px', fontWeight: 700 }} />
                      <span style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {t('m.exp.explore')} <Icon name="chevronRight" size={14} />
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {others.map((exp, idx) => (
                <div
                  key={exp.id}
                  onTouchStart={() => startBundleLongPress(exp.id)}
                  onTouchEnd={cancelBundleLongPress}
                  onTouchMove={cancelBundleLongPress}
                  onMouseDown={() => startBundleLongPress(exp.id)}
                  onMouseUp={cancelBundleLongPress}
                  onMouseLeave={cancelBundleLongPress}
                  {...pressable(() => openExperience(exp))}
                  aria-label={exp.name}
                  onClick={() => {
                    if (quickActionsBundle === exp.id) {
                      dismissQuickActions()
                      return
                    }
                    openExperience(exp)
                  }}
                  className="card stagger-in"
                  style={{ position: 'relative', height: '180px', cursor: 'pointer', marginBottom: '12px', animationDelay: `${(idx + 1) * 70}ms` }}
                >
                  <div style={{ position: 'absolute', inset: 0 }}><Img src={exp.imageUrl} alt={exp.name} width={1080} height={360} /></div>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.75))' }} />

                  {quickActionsBundle === exp.id && (
                    <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10, display: 'flex', gap: '6px' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSaveBundle(exp) }}
                        className="tappable"
                        style={{ padding: '8px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.95)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--rum)', minHeight: '44px' }}
                      >
                        <Icon name="heart" size={14} />
                        {readSaved('experiences').includes(quickActionsBundle ?? '') ? t('m.saved.unsave') : t('m.exp.save')}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleShareBundle(exp) }}
                        className="tappable"
                        style={{ padding: '8px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.95)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--rum)', minHeight: '44px' }}
                      >
                        <Icon name="share" size={14} />
                        {t('m.exp.share')}
                      </button>
                    </div>
                  )}

                  <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '16px', color: 'white' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '2px' }}>{exp.name}</h3>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>
                      {exp.generated
                        ? exp.generated.stops.map(st => st.name).join(' → ')
                        : `${exp.vendor?.name ? t('m.exp.hostedBy', { name: exp.vendor.name }) : formatCity(exp.city)} · ${t('m.exp.minAway', { n: exp.travelTime })}`}
                    </p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginBottom: '6px' }}>
                      {exp.generated ? exp.tagline : exp.bookedToday ? t('m.exp.bookedToday', { n: exp.bookedToday }) : null}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Price usd={exp.price} compact style={{ fontSize: '15px', fontWeight: 700 }} />
                      <span style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {t('m.exp.explore')} <Icon name="chevronRight" size={12} />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        <Dock />
      </main>
    )
  }

  // DETAIL
  if (screen === 'detail' && selectedExperience) {
    const stops = experienceStops(selectedExperience, t)
    return (
      <main className="screen-push-in" style={{ minHeight: '100dvh', background: '#0F0E0C', paddingBottom: '96px' }}>
        <div style={{ height: '46vh', minHeight: '280px', position: 'relative', overflow: 'hidden' }}>
          {selectedExperience.videoUrl ? (
            <SmartVideo src={selectedExperience.videoUrl} poster={selectedExperience.imageUrl} alt={selectedExperience.name} />
          ) : (
            <Img src={selectedExperience.imageUrl} alt={selectedExperience.name} width={1080} height={900} priority />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,14,12,0.35) 0%, transparent 30%, rgba(15,14,12,0.55) 75%, #0F0E0C 100%)' }} />
          <BackButton floating onClick={() => setScreen('results')} />
          <div style={{ position: 'absolute', bottom: '24px', left: '16px', right: '16px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{selectedExperience.name}</h2>
            <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.75)' }}>{selectedExperience.tagline}</p>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(180deg, rgba(15,14,12,0.12) 0%, var(--system-bg-elevated) 32px), var(--system-bg-elevated)', borderRadius: '20px 20px 0 0', boxShadow: 'var(--shadow-sheet)', marginTop: '-20px', position: 'relative', zIndex: 2, padding: '20px 16px 0' }}>
          <div className="sheet-grabber" />
          <div className="section-header">
            <div className="section-heading">
              <span className="section-eyebrow">{t('m.exp.yourRoute')}</span>
              <span className="section-title">{t('m.exp.timeline')}</span>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            {stops.map((stop, i) => (
              stop.type === 'transport' ? (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0 8px 16px', fontSize: '13px', color: 'var(--label-secondary)' }}>
                  <Icon name="chevronRight" size={12} />
                  {stop.label}
                </div>
              ) : (
                <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', padding: '12px' }}>
                  {stop.img ? <span style={{ width: '48px', height: '48px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}><Img src={stop.img} alt="" width={96} height={96} sizes="48px" /></span> : null}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{stop.name}</p>
                    <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{stop.time}</p>
                  </div>
                </div>
              )
            ))}
          </div>

          <div className="section-header">
            <div className="section-heading">
              <span className="section-eyebrow">{t('m.exp.splitEyebrow')}</span>
              <span className="section-title">{t('m.exp.whoPays')}</span>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            {[t('m.exp.you'), ...survey.crew].map((name, i) => (
              <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '32px', height: '32px', borderRadius: '50%', background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'white' }}>{name[0].toUpperCase()}</span>
                  <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{name}</span>
                </div>
                <Price usd={selectedExperience.price} compact style={{ fontSize: '17px', fontWeight: 700, color: 'var(--label-primary)' }} />
              </div>
            ))}
          </div>

          <div style={{ height: '4px' }} />
        </div>

        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, background: 'var(--system-bg-elevated)', borderTop: '0.5px solid var(--separator)', padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))', boxShadow: 'var(--shadow-sheet)' }}>
          {tripError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{tripError}</p>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={startCrewTrip} disabled={startingTrip || booking} style={{ flex: 1, padding: '0 12px' }}>
              <Icon name="users" size={16} />
              {startingTrip ? '…' : t('m.detail.planWithCrew')}
            </button>
            <button className="btn btn-primary" onClick={() => { triggerHaptic('light'); setBookingFor('selected') }} disabled={booking || startingTrip} style={{ flex: 1 }}>
              {booking ? '…' : t('m.detail.book')}
            </button>
          </div>
        </div>
        <BookingSheet
          open={bookingFor !== null}
          onClose={() => setBookingFor(null)}
          title={bookingFor === 'selected' ? selectedExperience?.name ?? '' : bookingFor?.name ?? ''}
          unitPrice={bookingUnitPrice}
          priceIsEstimate={bookingFor === 'selected' ? Boolean(selectedExperience?.generated) : !bookingFor?.experience}
          defaultPartySize={bookingFor && bookingFor !== 'selected' ? bookingFor.members.length : 1 + survey.crew.length}
          {...bookingDetailsFor(bookingFor)}
          onConfirm={confirmBooking}
          onDone={finishBookingFlow}
        />
      </main>
    )
  }

  // TRIP — group planning before booking
  if (screen === 'trip' && activeTrip) {
    return (
      <main className="screen-push-in" style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '96px' }}>
        <div style={{ padding: '16px' }}>
          <div style={{ marginBottom: '12px' }}><BackButton onClick={() => setScreen(selectedExperience ? 'detail' : 'survey')} /></div>
          <TripPlanner
            trip={activeTrip}
            mode={activeTrip.access === 'member' ? 'crew' : 'owner'}
            onTripChange={tr => { setActiveTrip(tr); setTripsInProgress(prev => prev.map(x => (x.slug === tr.slug ? tr : x))) }}
            onBook={() => setBookingFor(activeTrip)}
            booking={booking}
          />
          {tripError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginTop: '10px' }}>{tripError}</p>}
          <div style={{ marginTop: '16px' }}><CrewChat slug={activeTrip.slug} myMemberId={activeTrip.myMemberId ?? null} /></div>
        </div>
        <BookingSheet
          open={bookingFor !== null}
          onClose={() => setBookingFor(null)}
          title={bookingFor === 'selected' ? selectedExperience?.name ?? '' : bookingFor?.name ?? ''}
          unitPrice={bookingUnitPrice}
          priceIsEstimate={bookingFor === 'selected' ? Boolean(selectedExperience?.generated) : !bookingFor?.experience}
          defaultPartySize={bookingFor && bookingFor !== 'selected' ? bookingFor.members.length : 1 + survey.crew.length}
          {...bookingDetailsFor(bookingFor)}
          onConfirm={confirmBooking}
          onDone={finishBookingFlow}
        />
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
          />
        </div>

        <div style={{ position: 'absolute', top: '0', left: '0', right: '0', zIndex: 20, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <BackButton onClick={() => setScreen(survey.mood.length ? 'results' : 'survey')} />
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
