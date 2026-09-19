// app/experiences/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import FloatingPill from '@/components/FloatingPill'
import ActiveTripBanner from '@/components/ActiveTripBanner'
import ExploreMap, { type MapVendor, type MapPhotoSpot } from '@/components/ExploreMap'
import { hapticSurveyStepComplete, hapticSaved } from '@/lib/haptics'
import { getCurrentUser } from '@/lib/auth-client'

type Pin = { type: 'vendor'; data: MapVendor } | { type: 'photospot'; data: MapPhotoSpot }

const DISCOVER_CATEGORIES = [
  { value: 'FOOD', label: 'Food', icon: 'food' },
  { value: 'DRINKS', label: 'Drinks', icon: 'glass' },
  { value: 'ACTIVITY', label: 'Activity', icon: 'party' },
  { value: 'WELLNESS', label: 'Wellness', icon: 'spa' },
  { value: 'BEACH', label: 'Beach', icon: 'wave' }
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
}

interface Mood {
  id: string
  name: string
  icon: string
  description: string
  coverImage: string
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
  budget: number
  occasion: string | null
}

const TIME_META: Record<string, { label: string; emoji: string }> = {
  '2hr': { label: '2 hrs', emoji: '⚡' },
  'half': { label: 'Half day', emoji: '🌤' },
  'full': { label: 'Full day', emoji: '☀️' },
  'night': { label: 'All night', emoji: '🌙' }
}

const OCCASION_META: Record<string, { label: string; emoji: string }> = {
  birthday: { label: 'Celebration', emoji: '🎉' },
  romantic: { label: 'Just us two', emoji: '❤️' },
  family: { label: 'Family day', emoji: '👨‍👩‍👧' },
  none: { label: 'Surprise me', emoji: '🙅' }
}

// Semantic design-system colors used for avatar initials & confetti,
// in place of the old raw hex palette.
const AV_COLORS = ['var(--rum)', 'var(--gold)', 'var(--live)', 'var(--info)']

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) { h = name.charCodeAt(i) + ((h << 5) - h) }
  return AV_COLORS[Math.abs(h) % AV_COLORS.length]
}

function formatCity(city: string): string {
  return city.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
}

// The Experience model has no stops/itinerary sub-model, so we synthesize a
// lightweight two-leg itinerary (a travel leg + the experience itself) from
// the real fields that do exist (startLocation/travelMode/travelTime).
function experienceStops(exp: Experience): BundleStop[] {
  return [
    { type: 'transport', name: '', time: '', img: '', label: `${exp.travelMode || 'Travel'} · ${exp.travelTime} min from ${exp.startLocation}` },
    { type: 'activity', name: exp.name, time: exp.tagline, img: exp.imageUrl }
  ]
}

export default function ExperiencesPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<'survey' | 'loading' | 'results' | 'detail' | 'active'>('survey')
  const [surveyStep, setSurveyStep] = useState(0)
  const [survey, setSurvey] = useState<SurveyState>({ time: null, crew: [], mood: [], budget: 2, occasion: null })
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [moods, setMoods] = useState<Mood[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null)
  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(null)
  const [activeStops, setActiveStops] = useState<BundleStop[]>([])
  const [currentStopIndex, setCurrentStopIndex] = useState(0)
  const [points, setPoints] = useState(640)
  const [etaSeconds, setEtaSeconds] = useState(12 * 60)
  const [groupMembers, setGroupMembers] = useState<Array<{ name: string; status: string }>>([])
  const [payments, setPayments] = useState<Array<{ name: string; amount: number; paid: boolean }>>([])
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
  const [tabMode, setTabMode] = useState<'plan' | 'discover'>('plan')
  const [mapVendors, setMapVendors] = useState<MapVendor[]>([])
  const [mapPhotoSpots, setMapPhotoSpots] = useState<MapPhotoSpot[]>([])
  const [discoverCategory, setDiscoverCategory] = useState<string | null>(null)
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)

  const surveySteps = ['mood', 'time', 'crew', 'budget', 'occasion']

  useEffect(() => {
    fetchAll()
  }, [])

  useEffect(() => {
    if (screen === 'active') {
      const etaTimer = setInterval(() => {
        setEtaSeconds(prev => prev > 60 ? prev - 15 : prev)
      }, 2500)
      return () => clearInterval(etaTimer)
    }
  }, [screen])

  const fetchAll = async () => {
    try {
      const [expRes, moodRes, bookingsRes, vendorsRes, spotsRes] = await Promise.allSettled([
        fetch('/api/experiences'),
        fetch('/api/moods'),
        fetch('/api/bookings'),
        fetch('/api/vendors'),
        fetch('/api/photospots')
      ])

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
      if (bookingsRes.status === 'fulfilled' && bookingsRes.value.ok) {
        const currentUser = getCurrentUser()
        if (currentUser) {
          const data: Booking[] = await bookingsRes.value.json()
          const now = Date.now()
          const active = data
            .filter(b => b.userId === currentUser.id && b.status === 'CONFIRMED')
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
    } finally {
      setDataLoading(false)
    }
  }

  const triggerSelectAnim = (id: string) => {
    setSelectAnim(id)
    setTimeout(() => setSelectAnim(null), 300)
  }

  // Real experiences filtered by the moods picked in the survey (same
  // matching pattern app/page.tsx uses).
  const filteredExperiences = survey.mood.length > 0
    ? experiences.filter(e => e.moods?.some(m => survey.mood.includes(m.id) || survey.mood.includes(m.name)))
    : experiences

  const nextStep = () => {
    hapticSurveyStepComplete()
    if (surveyStep >= surveySteps.length - 1) {
      setScreen('loading')
      setPlanningPoints(25)
      setTimeout(() => {
        setScreen('results')
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 1500)
      }, 1500)
      return
    }
    setSurveyStep(prev => prev + 1)
  }

  const toggleMood = (moodId: string) => {
    setSurvey(prev => {
      const has = prev.mood.includes(moodId)
      if (has) return { ...prev, mood: prev.mood.filter(m => m !== moodId) }
      if (prev.mood.length >= 2) return prev
      triggerSelectAnim(moodId)
      return { ...prev, mood: [...prev.mood, moodId] }
    })
  }

  const openExperience = (exp: Experience) => {
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

  const confirmExperience = async () => {
    if (!selectedExperience) return
    setActiveStops(experienceStops(selectedExperience))
    setCurrentStopIndex(0)
    const currentUser = getCurrentUser()
    setPoints(currentUser?.points ?? 640)
    setEtaSeconds(selectedExperience.travelTime ? selectedExperience.travelTime * 60 : 12 * 60)
    const crew = ['You', ...(survey.crew.length ? survey.crew : ['Jules', 'Ken', 'Priya'])]
    const per = Math.round(selectedExperience.price)
    setGroupMembers(crew.map((n, i) => ({ name: n, status: i === 0 ? 'arrived' : i === 1 ? 'enroute' : 'pending' })))
    setPayments(crew.map((n, i) => ({ name: n, amount: per, paid: i === 0 })))

    if (currentUser) {
      setBooking(true)
      try {
        const bookingDate = new Date(Date.now() + 3 * 24 * 3600000)
        await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            experienceId: selectedExperience.id,
            date: bookingDate.toISOString(),
            totalPrice: selectedExperience.price,
            pointsEarned: Math.floor(selectedExperience.price),
            status: 'CONFIRMED'
          })
        })
      } catch (error) {
        console.error('Booking error:', error)
      } finally {
        setBooking(false)
      }
    } else {
      console.warn('No signed-in user — booking was not saved.')
    }

    setScreen('active')
  }

  const realStops = () => activeStops.filter(s => s.type !== 'transport')

  const cycleStatus = (i: number) => {
    const order = ['pending', 'enroute', 'arrived']
    setGroupMembers(prev => {
      const next = [...prev]
      next[i].status = order[(order.indexOf(next[i].status) + 1) % order.length]
      return next
    })
  }

  const togglePaid = (i: number) => {
    setPayments(prev => {
      const next = [...prev]
      next[i].paid = !next[i].paid
      return next
    })
  }

  // Data-driven swap choices for the "Change plan" sheet: other real
  // experiences, preferring ones in the same city or sharing a mood.
  const swapOptions = (() => {
    if (!selectedExperience) return []
    const others = experiences.filter(e => e.id !== selectedExperience.id)
    const relevant = others.filter(e =>
      e.city === selectedExperience.city ||
      e.moods?.some(m => selectedExperience.moods?.some(sm => sm.id === m.id))
    )
    return (relevant.length > 0 ? relevant : others).slice(0, 3)
  })()

  const applySwap = () => {
    setShowChangePlan(false)
    if (!swapSelection) return
    setAdapting(true)
    setTimeout(() => {
      setActiveStops(prev => {
        const next = [...prev]
        const real = next.filter(s => s.type !== 'transport')
        if (real[currentStopIndex]) real[currentStopIndex].name = swapSelection
        return next
      })
      setEtaSeconds(Math.floor(Math.random() * 10 + 6) * 60)
      setAdapting(false)
      setSwapSelection(null)
    }, 1300)
  }

  const statusLabel = (s: string) => s === 'arrived' ? 'Arrived' : s === 'enroute' ? 'En route' : 'Not started'

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
    const saved = localStorage.getItem('savedBundles')
    const savedBundles = saved ? JSON.parse(saved) : []
    const updated = savedBundles.includes(exp.id)
      ? savedBundles.filter((id: string) => id !== exp.id)
      : [...savedBundles, exp.id]
    localStorage.setItem('savedBundles', JSON.stringify(updated))
    dismissQuickActions()
  }

  const handleShareBundle = (exp: Experience) => {
    if (navigator.share) {
      navigator.share({
        title: exp.name,
        text: `${exp.name} — ${exp.tagline}`,
        url: window.location.href
      }).catch(() => {})
    }
    dismissQuickActions()
  }

  // Persistent Plan/Discover segmented control, shown atop survey, results
  // and detail screens. Switching modes never resets `screen`/`survey`/
  // `selectedExperience` state, so flipping back to Plan resumes exactly
  // where the user left off.
  const renderModeSwitch = () => (
    <div className="segmented-control" style={{ margin: 'calc(env(safe-area-inset-top, 0px) + 40px) 0 16px' }}>
      <button className={`segmented-control-option ${tabMode === 'plan' ? 'active' : ''}`} onClick={() => setTabMode('plan')}>
        <Icon name="compass" size={16} />
        Plan
      </button>
      <button className={`segmented-control-option ${tabMode === 'discover' ? 'active' : ''}`} onClick={() => setTabMode('discover')}>
        <Icon name="mapPin" size={16} />
        Discover
      </button>
    </div>
  )

  const filteredMapVendors = discoverCategory
    ? mapVendors.filter(v => v.category === discoverCategory)
    : mapVendors

  const renderDiscover = () => (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px', display: 'flex', flexDirection: 'column' }}>
      <FloatingPill />
      <div style={{ padding: '16px 16px 0' }}>
        {renderModeSwitch()}
      </div>
      <div className="mood-picker" style={{ padding: '0 16px 12px' }}>
        {DISCOVER_CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setDiscoverCategory(discoverCategory === cat.value ? null : cat.value)}
            className={`mood-pill ${discoverCategory === cat.value ? 'centre' : ''}`}
          >
            <Icon name={cat.icon as any} size={16} />
            {cat.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, position: 'relative', minHeight: '360px' }}>
        <ExploreMap
          vendors={filteredMapVendors}
          photoSpots={mapPhotoSpots}
          onVendorTap={(v) => setSelectedPin({ type: 'vendor', data: v })}
          onPhotoSpotTap={(s) => setSelectedPin({ type: 'photospot', data: s })}
        />
      </div>

      <div className={`bottom-sheet-overlay ${selectedPin ? 'open' : ''}`} onClick={() => setSelectedPin(null)} />
      <div className={`bottom-sheet ${selectedPin ? 'open' : ''}`}>
        <div className="sheet-grabber" />
        {selectedPin && selectedPin.type === 'vendor' && (
          <div style={{ padding: '0 20px 20px' }}>
            {selectedPin.data.images?.[0] && (
              <img src={selectedPin.data.images[0]} alt={selectedPin.data.name} style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: 'var(--radius-lg)', marginBottom: '12px' }} />
            )}
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '4px' }}>{selectedPin.data.name}</h3>
            <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '20px' }}>
              {formatCategory(selectedPin.data.category)} · {selectedPin.data.neighborhood}
            </p>
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: '8px' }} onClick={() => planTripFromVendor(selectedPin.data)}>
              Plan a trip here
            </button>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => router.push(`/vendor/${selectedPin.data.id}`)}>
              View Vendor
            </button>
          </div>
        )}
        {selectedPin && selectedPin.type === 'photospot' && (
          <div style={{ padding: '0 20px 20px' }}>
            {selectedPin.data.officialPhoto && (
              <img src={selectedPin.data.officialPhoto} alt={selectedPin.data.name} style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: 'var(--radius-lg)', marginBottom: '12px' }} />
            )}
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '4px' }}>{selectedPin.data.name}</h3>
            <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '20px' }}>{selectedPin.data.description}</p>
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: '8px' }} onClick={planTripFromPhotoSpot}>
              Plan a trip here
            </button>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => router.push(`/photospot/${selectedPin.data.id}`)}>
              View Photo Spot
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
        <FloatingPill />
        {activeBooking && (
          <div style={{ padding: '16px 16px 0' }}>
            <ActiveTripBanner
              tripName={activeBooking.experience?.name || activeBooking.vendor?.name || 'Your trip'}
              etaMinutes={Math.max(0, Math.round((new Date(activeBooking.date).getTime() - Date.now()) / 60000))}
              nextStopName={activeBooking.experience?.name || activeBooking.vendor?.name || 'your stop'}
            />
          </div>
        )}
        <div style={{ padding: '16px' }}>
          {renderModeSwitch()}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
            {surveySteps.map((_, i) => (
              <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i < surveyStep ? 'var(--rum)' : 'var(--separator)', transition: 'background 0.3s ease' }} />
            ))}
          </div>

          {surveyStep === 0 && (
            <>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>Step 1 of 5</p>
              <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginBottom: '8px' }}>What&apos;s calling you?</h2>
              <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '16px' }}>Pick up to two.</p>
              {dataLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="skeleton-card" style={{ height: '160px' }}>
                      <div className="skeleton-image" style={{ height: '100%' }} />
                    </div>
                  ))}
                </div>
              ) : moods.length === 0 ? (
                <div className="empty-state">
                  <Icon name="sparkle" size={32} style={{ color: 'var(--label-tertiary)' }} />
                  <p style={{ fontSize: '17px', fontWeight: 600 }}>No vibes to pick from right now</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {moods.map(m => (
                    <div
                      key={m.id}
                      onClick={() => toggleMood(m.id)}
                      className={`mood-video-tile ${survey.mood.includes(m.id) ? 'selected' : ''} ${selectAnim === m.id ? 'select-bounce' : ''}`}
                    >
                      <img src={m.coverImage} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div className="mood-video-tile-overlay" />
                      <div className="mood-video-tile-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon name={m.icon as any} size={14} />
                        {m.name}
                      </div>
                      {survey.mood.includes(m.id) && (
                        <div style={{ position: 'absolute', top: '8px', right: '8px', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--rum)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="check" size={12} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <button className="btn btn-primary" onClick={nextStep} disabled={survey.mood.length === 0} style={{ width: '100%', marginTop: '16px' }}>Fawud</button>
            </>
          )}

          {surveyStep === 1 && (
            <>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>Step 2 of 5</p>
              <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginBottom: '16px' }}>How much time?</h2>
              {Object.entries(TIME_META).map(([id, meta]) => (
                <div
                  key={id}
                  onClick={() => { setSurvey(prev => ({ ...prev, time: id })); triggerSelectAnim(id); setTimeout(nextStep, 250) }}
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
                  <span style={{ fontSize: '17px', fontWeight: 600, color: survey.time === id ? 'white' : 'var(--label-primary)' }}>{meta.label}</span>
                </div>
              ))}
            </>
          )}

          {surveyStep === 2 && (
            <>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>Step 3 of 5</p>
              <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginBottom: '16px' }}>Who&apos;s coming?</h2>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  value={crewInput}
                  onChange={(e) => setCrewInput(e.target.value)}
                  placeholder="Add a name"
                  style={{ flex: 1, padding: '12px', borderRadius: '14px', border: '1px solid var(--separator)', background: 'var(--system-bg-elevated)', fontSize: '17px', fontFamily: 'inherit', color: 'var(--label-primary)', outline: 'none', minHeight: '44px' }}
                />
                <button onClick={() => { if (crewInput.trim()) { setSurvey(prev => ({ ...prev, crew: [...prev.crew, crewInput.trim()] })); setCrewInput(''); triggerSelectAnim('crew') } }} style={{ width: '44px', borderRadius: '14px', background: 'var(--rum)', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px' }}>
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
              <button className="btn btn-primary" onClick={nextStep} style={{ width: '100%' }}>Fawud</button>
            </>
          )}

          {surveyStep === 3 && (
            <>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>Step 4 of 5</p>
              <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginBottom: '24px' }}>How yuh want to spend?</h2>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <span style={{ fontSize: '40px', fontWeight: 700, fontFamily: 'Space Mono, monospace', color: 'var(--rum)' }}>
                  {['$', '$$', '$$$', '$$$$'][survey.budget - 1]}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="4"
                value={survey.budget}
                onChange={(e) => setSurvey(prev => ({ ...prev, budget: parseInt(e.target.value) }))}
                style={{ width: '100%', height: '4px', borderRadius: '2px', background: 'var(--separator)', outline: 'none', WebkitAppearance: 'none', marginBottom: '8px', minHeight: '44px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--label-secondary)', fontWeight: 500, marginBottom: '24px' }}>
                <span>Local</span>
                <span>No limit</span>
              </div>
              <button className="btn btn-primary" onClick={nextStep} style={{ width: '100%' }}>Fawud</button>
            </>
          )}

          {surveyStep === 4 && (
            <>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>Step 5 of 5</p>
              <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginBottom: '16px' }}>One more ting.</h2>
              {Object.entries(OCCASION_META).map(([id, meta]) => (
                <div
                  key={id}
                  onClick={() => { setSurvey(prev => ({ ...prev, occasion: id })); triggerSelectAnim(id); setTimeout(nextStep, 300) }}
                  className={selectAnim === id ? 'select-bounce' : ''}
                  style={{
                    padding: '16px',
                    borderRadius: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '8px',
                    background: survey.occasion === id ? 'var(--rum)' : 'var(--system-bg-elevated)',
                    border: '1px solid var(--separator)',
                    minHeight: '44px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{meta.emoji}</span>
                  <span style={{ fontSize: '17px', fontWeight: 600, color: survey.occasion === id ? 'white' : 'var(--label-primary)' }}>{meta.label}</span>
                </div>
              ))}
            </>
          )}
        </div>
        <Dock />
      </main>
    )
  }

  // LOADING
  if (screen === 'loading') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', paddingBottom: '80px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--separator)', borderTopColor: 'var(--rum)', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>Wi a look fi di best spot</p>
        <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    )
  }

  // RESULTS with long-press quick actions
  if (screen === 'results') {
    const bestMatch = filteredExperiences[0]
    const others = filteredExperiences.slice(1)

    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
        <FloatingPill />
        {showConfetti && (
          <>
            {[...Array(20)].map((_, i) => (
              <div key={i} className="confetti-piece" style={{ left: `${Math.random() * 100}%`, top: '-10px', background: AV_COLORS[i % AV_COLORS.length], animationDelay: `${Math.random() * 0.3}s` }} />
            ))}
          </>
        )}
        <div style={{ padding: '16px' }}>
          {renderModeSwitch()}
          {activeBooking && (
            <div style={{ marginBottom: '16px' }}>
              <ActiveTripBanner
                tripName={activeBooking.experience?.name || activeBooking.vendor?.name || 'Your trip'}
                etaMinutes={Math.max(0, Math.round((new Date(activeBooking.date).getTime() - Date.now()) / 60000))}
                nextStopName={activeBooking.experience?.name || activeBooking.vendor?.name || 'your stop'}
              />
            </div>
          )}

          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)' }}>Curated for You</p>
            <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginTop: '2px' }}>Yuh vibe, bundled.</h2>
            <p style={{ fontSize: '15px', color: 'var(--rum)', fontWeight: 600, marginTop: '4px' }}>
              +{planningPoints} pts for planning your trip
            </p>
          </div>

          {filteredExperiences.length === 0 ? (
            <div className="empty-state">
              <Icon name="search" size={32} style={{ color: 'var(--label-tertiary)' }} />
              <p style={{ fontSize: '17px', fontWeight: 600 }}>Nuttin match dat vibe yet</p>
              <button className="btn btn-secondary" onClick={() => setScreen('survey')} style={{ marginTop: '12px' }}>Try different vibes</button>
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
                  onClick={() => {
                    if (quickActionsBundle === bestMatch.id) {
                      dismissQuickActions()
                      return
                    }
                    openExperience(bestMatch)
                  }}
                  className="card"
                  style={{ position: 'relative', height: '280px', cursor: 'pointer', marginBottom: '16px' }}
                >
                  <img src={bestMatch.imageUrl} alt={bestMatch.name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.8))' }} />
                  <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'var(--rum)', color: 'white', fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: '999px' }}>
                    Best Match
                  </div>

                  {quickActionsBundle === bestMatch.id && (
                    <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10, display: 'flex', gap: '6px' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSaveBundle(bestMatch) }}
                        className="tappable"
                        style={{ padding: '8px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.95)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--rum)', minHeight: '44px' }}
                      >
                        <Icon name="heart" size={14} />
                        Save
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleShareBundle(bestMatch) }}
                        className="tappable"
                        style={{ padding: '8px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.95)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--rum)', minHeight: '44px' }}
                      >
                        <Icon name="share" size={14} />
                        Share
                      </button>
                    </div>
                  )}

                  <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '20px', color: 'white' }}>
                    <h3 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>{bestMatch.name}</h3>
                    <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.85)', marginBottom: '8px' }}>{bestMatch.tagline}</p>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '12px' }}>
                      {bestMatch.vendor?.name ? `Hosted by ${bestMatch.vendor.name}` : formatCity(bestMatch.city)} · {bestMatch.travelTime} min away
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="num-font" style={{ fontSize: '18px', fontWeight: 700 }}>${bestMatch.price}</span>
                      <span style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Explore <Icon name="chevronRight" size={14} />
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {others.map(exp => (
                <div
                  key={exp.id}
                  onTouchStart={() => startBundleLongPress(exp.id)}
                  onTouchEnd={cancelBundleLongPress}
                  onTouchMove={cancelBundleLongPress}
                  onMouseDown={() => startBundleLongPress(exp.id)}
                  onMouseUp={cancelBundleLongPress}
                  onMouseLeave={cancelBundleLongPress}
                  onClick={() => {
                    if (quickActionsBundle === exp.id) {
                      dismissQuickActions()
                      return
                    }
                    openExperience(exp)
                  }}
                  className="card"
                  style={{ position: 'relative', height: '180px', cursor: 'pointer', marginBottom: '12px' }}
                >
                  <img src={exp.imageUrl} alt={exp.name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.75))' }} />

                  {quickActionsBundle === exp.id && (
                    <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10, display: 'flex', gap: '6px' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSaveBundle(exp) }}
                        className="tappable"
                        style={{ padding: '8px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.95)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--rum)', minHeight: '44px' }}
                      >
                        <Icon name="heart" size={14} />
                        Save
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleShareBundle(exp) }}
                        className="tappable"
                        style={{ padding: '8px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.95)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--rum)', minHeight: '44px' }}
                      >
                        <Icon name="share" size={14} />
                        Share
                      </button>
                    </div>
                  )}

                  <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '16px', color: 'white' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '2px' }}>{exp.name}</h3>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>
                      {exp.vendor?.name ? `Hosted by ${exp.vendor.name}` : formatCity(exp.city)} · {exp.travelTime} min away
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="num-font" style={{ fontSize: '15px', fontWeight: 700 }}>${exp.price}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Explore <Icon name="chevronRight" size={12} />
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
    const stops = experienceStops(selectedExperience)
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
        <FloatingPill />
        <div style={{ height: '200px', position: 'relative', overflow: 'hidden', marginBottom: '16px' }}>
          <img src={selectedExperience.imageUrl} alt={selectedExperience.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.8))' }} />
          <button onClick={() => setScreen('results')} style={{ position: 'absolute', top: '16px', left: '16px', width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Icon name="back" size={18} />
          </button>
          <h2 style={{ position: 'absolute', bottom: '16px', left: '16px', fontSize: '24px', fontWeight: 700, color: 'white' }}>{selectedExperience.name}</h2>
        </div>

        <div style={{ padding: '0 16px' }}>
          {renderModeSwitch()}
          <div className="section-header">
            <div className="section-heading">
              <span className="section-eyebrow">Your Route</span>
              <span className="section-title">Timeline</span>
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
                  <img src={stop.img} alt={stop.name} style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover' }} />
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
              <span className="section-eyebrow">Split Payment</span>
              <span className="section-title">Who Pays What</span>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            {['You', ...(survey.crew.length ? survey.crew : ['Jules', 'Ken', 'Priya'])].map((name, i) => (
              <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '32px', height: '32px', borderRadius: '50%', background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'white' }}>{name[0].toUpperCase()}</span>
                  <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{name}</span>
                </div>
                <span className="num-font" style={{ fontSize: '17px', fontWeight: 700, color: 'var(--label-primary)' }}>${Math.round(selectedExperience.price)}</span>
              </div>
            ))}
          </div>

          <button className="btn btn-primary" onClick={confirmExperience} disabled={booking} style={{ width: '100%' }}>
            {booking ? 'Booking...' : 'Dun — book dis'}
          </button>
        </div>
        <Dock />
      </main>
    )
  }

  // ACTIVE
  if (screen === 'active') {
    const realStopsList = realStops()
    const nextStop = realStopsList[currentStopIndex]
    const paidCount = payments.filter(p => p.paid).length
    const totalPaid = payments.reduce((a, p) => a + p.amount, 0)
    const etaMin = Math.floor(etaSeconds / 60)

    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '0', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'var(--system-bg)' }}>
          <svg viewBox="0 0 500 900" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%' }}>
            <rect width="500" height="900" fill="var(--system-bg-secondary)" />
            {[...Array(10)].map((_, i) => <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2="900" stroke="var(--separator)" strokeWidth="1" />)}
            {[...Array(18)].map((_, i) => <line key={`h${i}`} x1="0" y1={i * 50} x2="500" y2={i * 50} stroke="var(--separator)" strokeWidth="1" />)}
            <path d="M 80 620 Q 180 480 260 500 T 400 260" fill="none" style={{ stroke: 'var(--live)' }} strokeWidth="3" strokeDasharray="6 6" opacity="0.8" />
            <circle cx="400" cy="260" r="8" style={{ fill: 'var(--gold)' }} />
            <circle cx="80" cy="620" r="9" style={{ fill: 'var(--rum)' }} />
          </svg>
        </div>

        <div style={{ position: 'absolute', top: '0', left: '0', right: '0', zIndex: 20, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setScreen('results')} style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--system-bg-elevated)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-primary)', boxShadow: 'var(--shadow-card)' }}>
            <Icon name="back" size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--system-bg-elevated)', padding: '8px 12px', borderRadius: '999px', minHeight: '44px', boxShadow: 'var(--shadow-card)' }}>
            <Icon name="sparkle" size={14} style={{ color: 'var(--gold)' }} />
            <span className="num-font" style={{ fontWeight: 700, fontSize: '15px', color: 'var(--gold)' }}>{points}</span>
          </div>
        </div>

        <div style={{ position: 'absolute', left: '0', right: '0', bottom: '0', zIndex: 10, background: 'var(--system-bg-elevated)', borderRadius: '20px 20px 0 0', boxShadow: 'var(--shadow-sheet)', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid var(--separator)' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--label-tertiary)' }}>Next Stop</p>
              <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginTop: '2px' }}>{nextStop?.name || 'Complete'}</p>
            </div>
            <span className="num-font" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--live)' }}>{etaMin} min</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', marginBottom: '16px' }}>
              {realStopsList.map((stop, i) => (
                <div key={i} style={{ flexShrink: 0, padding: '8px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', background: i < currentStopIndex ? 'var(--system-bg-secondary)' : i === currentStopIndex ? 'var(--rum-tint)' : 'var(--system-bg-secondary)', color: i < currentStopIndex ? 'var(--success)' : i === currentStopIndex ? 'var(--rum)' : 'var(--label-tertiary)', minHeight: '36px', display: 'flex', alignItems: 'center' }}>
                  {stop.name}
                </div>
              ))}
            </div>

            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '8px' }}>Your crew</p>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {groupMembers.map((member, i) => (
                <div key={i} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', minHeight: '44px' }} onClick={() => cycleStatus(i)}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: avatarColor(member.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: 'white', border: member.status === 'arrived' ? '2px solid var(--success)' : '2px solid transparent' }}>
                    {member.name[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--label-secondary)' }}>{member.name}</span>
                  <span style={{ fontSize: '10px', color: 'var(--label-tertiary)' }}>{statusLabel(member.status)}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '8px' }}>Split payment</p>
            <div style={{ background: 'var(--system-bg-secondary)', borderRadius: '14px', padding: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="num-font" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)' }}>${totalPaid}</span>
                <span className="num-font" style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{paidCount} of {payments.length} paid</span>
              </div>
              {payments.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: i > 0 ? '0.5px solid var(--separator)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: avatarColor(p.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white' }}>{p.name[0].toUpperCase()}</span>
                    <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--label-primary)' }}>{p.name}</span>
                  </div>
                  <span onClick={() => togglePaid(i)} style={{ fontSize: '13px', fontWeight: 600, padding: '6px 10px', borderRadius: '999px', cursor: 'pointer', background: p.paid ? 'var(--system-bg)' : 'var(--rum-tint)', color: p.paid ? 'var(--success)' : 'var(--rum)', minHeight: '36px', display: 'flex', alignItems: 'center' }}>
                    {p.paid ? 'Paid' : `$${p.amount}`}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowChangePlan(true)} style={{ flex: 1, padding: '12px', borderRadius: '14px', background: 'var(--system-bg-secondary)', border: 'none', cursor: 'pointer', color: 'var(--label-primary)', fontFamily: 'inherit', fontSize: '15px', fontWeight: 600, minHeight: '44px' }}>
                Change plan
              </button>
              <button onClick={() => setShowRouteSheet(true)} style={{ flex: 1, padding: '12px', borderRadius: '14px', background: 'var(--system-bg-secondary)', border: 'none', cursor: 'pointer', color: 'var(--label-primary)', fontFamily: 'inherit', fontSize: '15px', fontWeight: 600, minHeight: '44px' }}>
                Full route
              </button>
            </div>
          </div>
        </div>

        {adapting && (
          <div style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: 'var(--system-bg-elevated)', padding: '12px 16px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-elevated)' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--separator)', borderTopColor: 'var(--rum)', animation: 'spin 0.7s linear infinite' }} />
            <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--label-primary)' }}>Updating plan...</span>
          </div>
        )}

        {showChangePlan && (
          <>
            <div className="bottom-sheet-overlay open" onClick={() => setShowChangePlan(false)} />
            <div className="bottom-sheet open" style={{ padding: '20px' }}>
              <div className="sheet-grabber" />
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '12px' }}>Change your plan</h3>
              {swapOptions.length === 0 ? (
                <div className="empty-state">
                  <Icon name="shuffle" size={28} style={{ color: 'var(--label-tertiary)' }} />
                  <p style={{ fontSize: '15px', fontWeight: 600 }}>No other experiences to swap in right now</p>
                </div>
              ) : (
                swapOptions.map(exp => (
                  <div
                    key={exp.id}
                    onClick={() => setSwapSelection(exp.name)}
                    style={{
                      padding: '14px',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      marginBottom: '8px',
                      background: swapSelection === exp.name ? 'var(--rum-tint)' : 'var(--system-bg-secondary)',
                      border: swapSelection === exp.name ? '1px solid var(--rum)' : '1px solid var(--separator)',
                      minHeight: '44px'
                    }}
                  >
                    <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{exp.name}</p>
                    <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{exp.vendor?.name || formatCity(exp.city)} · ${exp.price}</p>
                  </div>
                ))
              )}
              <button className="btn btn-primary" onClick={applySwap} disabled={!swapSelection} style={{ width: '100%', marginTop: '8px' }}>Fawud</button>
            </div>
          </>
        )}

        {showRouteSheet && (
          <>
            <div className="bottom-sheet-overlay open" onClick={() => setShowRouteSheet(false)} />
            <div className="bottom-sheet open" style={{ padding: '20px' }}>
              <div className="sheet-grabber" />
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '12px' }}>Full route</h3>
              {activeStops.map((stop, i) => (
                stop.type === 'transport' ? (
                  <div key={i} style={{ padding: '6px 0 6px 16px', fontSize: '13px', color: 'var(--label-tertiary)' }}>{stop.label}</div>
                ) : (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '14px', marginBottom: '4px', background: 'var(--system-bg-secondary)' }}>
                    <img src={stop.img} alt={stop.name} style={{ width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover' }} />
                    <div>
                      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{stop.name}</p>
                      <p style={{ fontSize: '13px', color: 'var(--label-tertiary)' }}>{stop.time}</p>
                    </div>
                  </div>
                )
              ))}
            </div>
          </>
        )}

        <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    )
  }

  return null
}
