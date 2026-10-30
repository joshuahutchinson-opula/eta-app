// app/page.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import VendorCard from '@/components/VendorCard'
import Icon from '@/lib/icons'
import LongPressCard from '@/components/LongPressCard'
import BrandedRefresh from '@/components/BrandedRefresh'
import FloatingPill from '@/components/FloatingPill'
import ActiveTripBanner from '@/components/ActiveTripBanner'
import { triggerHaptic } from '@/lib/haptics'
import { getCurrentUser } from '@/lib/auth-client'
import { authHeaders } from '@/lib/api-client'
import EventsSection from '@/components/EventsSection'
import ExperienceCard from '@/components/ExperienceCard'
import RegionSelector from '@/components/RegionSelector'
import { useRegion } from '@/components/RegionProvider'
import { useLang } from '@/lib/i18n-client'
import StoriesRow from '@/components/StoriesRow'
import ContextTip from '@/components/ContextTip'
import NotificationBell from '@/components/NotificationBell'
import { vibeMoodNames } from '@/lib/vibes'
import ErrorState from '@/components/ErrorState'
import { moodCategories } from '@/lib/mood-profiles'
import { distanceFrom, sortByDistance, useUserLocation } from '@/lib/geo'

interface Vendor {
  id: string
  name: string
  category: string
  neighborhood: string
  city: string
  priceRange: string
  description: string
  images: string[]
  videos: string[]
  open: boolean
  live: boolean
  isPremium: boolean
  whoThere: number
  lat?: number | null
  lng?: number | null
  rating?: number
  reviewCount?: number
  stories: Array<{ id: string; content: string; type: string; imageUrl: string }>
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
  stopCount?: number
  totalDuration?: number | null
  bookedToday?: number
  travelIncluded?: boolean
  stops?: Array<{ id: string; name: string; type: string }>
  vendor?: { name: string; isPremium?: boolean }
  moods?: Array<{ id: string; name: string; icon: string }>
  rating?: number
  reviewCount?: number
}

interface Mood {
  id: string
  name: string
  icon: string
  description: string
  coverImage: string
  categories?: string[]
}

interface Booking {
  id: string
  status: string
  date: string
  userId: string
  experience?: { name: string } | null
  vendor?: { name: string } | null
}

const MOOD_ICONS: Record<string, string> = {
  'R&R': 'spa',
  'Just The Two Of Us': 'heart',
  'Party Time': 'party',
  'Sunset Chaser': 'sun',
  'Water Life': 'wave',
  'Street Food Crawl': 'food',
  'Hangover Cures': 'recharge',
  'Solo Missions': 'user',
  'Family Day': 'users',
  'Rum & Bass': 'glass'
}

function formatCategory(category: string): string {
  return category.charAt(0) + category.slice(1).toLowerCase()
}

export default function HomePage() {
  const router = useRouter()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [moods, setMoods] = useState<Mood[]>([])
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null)
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const userLocation = useUserLocation()
  const [refreshing, setRefreshing] = useState(false)
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const [firstName, setFirstName] = useState<string | null>(null)
  const featuredScrollRef = useRef<HTMLDivElement>(null)
  const moodPickerRef = useRef<HTMLDivElement>(null)
  const isTouchingRef = useRef(false)
  const vibeAppliedRef = useRef(false)
  const { city, town } = useRegion()
  const { t } = useLang()

  useEffect(() => {
    fetchAll()
    const user = getCurrentUser()
    if (user?.name) setFirstName(user.name.split(' ')[0])
  }, [])

  // Pause the Featured auto-advance while a touch is active anywhere on the
  // page (not just on the carousel), so it doesn't fight the user mid-swipe
  // or mid-scroll elsewhere, then resumes on release.
  useEffect(() => {
    const handleTouchStart = () => { isTouchingRef.current = true }
    const handleTouchEnd = () => { isTouchingRef.current = false }
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [])

  useEffect(() => {
    const featuredList = vendors.filter(v => v.city === city && v.isPremium && v.videos && v.videos.length > 0)
    setFeaturedIndex(0)
    featuredScrollRef.current?.scrollTo({ left: 0 })
    if (featuredList.length <= 1) return

    const autoScroll = setInterval(() => {
      if (isTouchingRef.current) return
      setFeaturedIndex(prevIndex => {
        const nextIndex = (prevIndex + 1) % featuredList.length
        if (featuredScrollRef.current) {
          featuredScrollRef.current.scrollTo({
            left: nextIndex * featuredScrollRef.current.clientWidth,
            behavior: 'smooth'
          })
        }
        return nextIndex
      })
    }, 5000)

    return () => clearInterval(autoScroll)
  }, [vendors, city])

  const fetchAll = async () => {
    try {
      const [vendorsRes, experiencesRes, moodsRes, bookingsRes] = await Promise.allSettled([
        fetch('/api/vendors'),
        fetch('/api/experiences'),
        fetch('/api/moods'),
        fetch('/api/bookings', { headers: authHeaders() })
      ])

      setLoadFailed(!(vendorsRes.status === 'fulfilled' && vendorsRes.value.ok) && !(experiencesRes.status === 'fulfilled' && experiencesRes.value.ok))
      if (vendorsRes.status === 'fulfilled' && vendorsRes.value.ok) {
        const data = await vendorsRes.value.json()
        setVendors(Array.isArray(data) ? data : [])
      }
      if (experiencesRes.status === 'fulfilled' && experiencesRes.value.ok) {
        const data = await experiencesRes.value.json()
        setExperiences(Array.isArray(data) ? data : [])
      }
      if (moodsRes.status === 'fulfilled' && moodsRes.value.ok) {
        const data = await moodsRes.value.json()
        const mappedMoods = data.map((mood: Mood) => {
          let name = mood.name
          if (name === 'Out Til Sunrise') name = 'Party Time'
          if (name === 'Golden Hour') name = 'Sunset Chaser'
          return { ...mood, name, icon: MOOD_ICONS[name] || mood.icon, categories: moodCategories(mood.name, mood.icon) }
        })
        // The onboarding vibe puts its moods first and preselects the top one
        // (once — after that the traveler's own pick wins).
        const vibeNames = vibeMoodNames()
        const ordered = vibeNames.length
          ? [...mappedMoods.filter((m: Mood) => vibeNames.includes(m.name)), ...mappedMoods.filter((m: Mood) => !vibeNames.includes(m.name))]
          : mappedMoods
        setMoods(ordered)
        const first = ordered.find((m: Mood) => vibeNames.includes(m.name))
        if (first && !vibeAppliedRef.current) setSelectedMood(first.id)
        vibeAppliedRef.current = true
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
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }

  const regionVendors = vendors.filter(v => v.city === city)
  const regionExperiences = experiences.filter(e => e.city === city)
  const featuredVendors = regionVendors.filter(v => v.isPremium && v.videos && v.videos.length > 0)

  const handleFeaturedScroll = () => {
    if (featuredScrollRef.current) {
      const scrollLeft = featuredScrollRef.current.scrollLeft
      const cardWidth = featuredScrollRef.current.clientWidth
      const newIndex = Math.round(scrollLeft / cardWidth)
      setFeaturedIndex(Math.min(newIndex, featuredVendors.length - 1))
    }
  }

  const snapMoodToCentre = (moodId: string) => {
    triggerHaptic('selection')
    setSelectedMood(selectedMood === moodId ? null : moodId)
    if (moodPickerRef.current) {
      const pill = moodPickerRef.current.querySelector(`[data-mood="${moodId}"]`)
      if (pill) {
        pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }
    }
  }

  const filteredExperiences = selectedMood
    ? regionExperiences.filter(e => e.moods?.some(m => m.id === selectedMood || m.name === selectedMood))
    : regionExperiences

  // A mood maps to the vendor categories it's about (lib/mood-profiles.ts),
  // the same mapping the route generator uses.
  const moodCats = moods.find(m => m.id === selectedMood)?.categories ?? []
  const moodVendors = selectedMood
    ? regionVendors.filter(v => moodCats.includes(v.category))
    : regionVendors
  // Near You Now: nearest first by real distance; no coordinates → last.
  const filteredVendors = sortByDistance(moodVendors, userLocation)

  if (loading) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)' }}>
        <div style={{ paddingTop: '16px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: '100px' }}>
          <div className="skeleton-card" style={{ width: '64px', height: '64px', borderRadius: '50%', marginBottom: '16px' }}>
            <div className="skeleton-image" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
          </div>
          <div className="skeleton-card" style={{ height: '380px', marginBottom: '24px' }}>
            <div className="skeleton-image" style={{ height: '100%' }} />
          </div>
        </div>
        <Dock />
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <FloatingPill />
      <BrandedRefresh refreshing={refreshing} onRefresh={handleRefresh} />

      <div className="content-fade-in">
        <RegionSelector />

        {/* Greeting */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="greeting-text" style={{ flex: 1, minWidth: 0 }}>Wah Gwan{firstName ? `, ${firstName}` : ''}</h1>
            <Link href="/search" aria-label={t('m.search.open')} className="heart-btn" style={{ background: 'var(--system-bg-elevated)', boxShadow: 'var(--shadow-card)', color: 'var(--label-primary)' }}>
              <Icon name="search" size={18} />
            </Link>
            <NotificationBell />
          </div>
        </div>

        {activeBooking && (
          <div style={{ paddingTop: '12px' }}>
            <ActiveTripBanner
              tripName={activeBooking.experience?.name || activeBooking.vendor?.name || 'Your trip'}
              etaMinutes={Math.max(0, Math.round((new Date(activeBooking.date).getTime() - Date.now()) / 60000))}
              nextStopName={activeBooking.experience?.name || activeBooking.vendor?.name || 'your stop'}
            />
          </div>
        )}

        <StoriesRow />

        <ContextTip />

        {/* Divider below stories */}
        <div className="divider-faded" />

        {/* Featured / Destinations */}
        <div style={{ padding: '0 16px 12px' }}>
          <div className="section-heading">
            <span className="section-eyebrow">Featured</span>
            <span className="section-title section-title-shimmer">Destinations</span>
          </div>
        </div>

        {/* Featured Cards */}
        {featuredVendors.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div
              ref={featuredScrollRef}
              onScroll={handleFeaturedScroll}
              className="horizontal-scroll"
              style={{ padding: '8px 16px 12px', scrollSnapType: 'x mandatory' }}
            >
              {featuredVendors.map((vendor, index) => (
                <Link
                  key={vendor.id}
                  href={`/vendor/${vendor.id}`}
                  onClick={() => triggerHaptic('light')}
                  style={{ textDecoration: 'none', flexShrink: 0, width: '100%', scrollSnapAlign: 'center' }}
                >
                  <div className="featured-hero" style={{ margin: '0 4px' }}>
                    {vendor.videos && vendor.videos.length > 0 ? (
                      <video
                        ref={(el) => {
                          if (el && index === featuredIndex) {
                            el.muted = true
                            el.playsInline = true
                            el.play().catch(() => {})
                          }
                        }}
                        src={vendor.videos[0]}
                        muted
                        loop
                        playsInline
                        preload={index === featuredIndex || index === (featuredIndex + 1) % featuredVendors.length ? 'auto' : 'metadata'}
                        poster={vendor.images[0]}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <img src={vendor.images[0]} alt={vendor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <div className="featured-hero-overlay" />
                    {vendor.live && (
                      <div className="featured-hero-badge">
                        <span className="live-dot" />
                        <span className="num-font">{vendor.whoThere}</span> here now
                      </div>
                    )}
                    <div className="featured-hero-content">
                      <h2 className="featured-hero-title">{vendor.name}</h2>
                      <p className="featured-hero-sub">
                        {formatCategory(vendor.category)} · {vendor.neighborhood}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {featuredVendors.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                {featuredVendors.map((_, i) => (
                  <div key={i} style={{ width: i === featuredIndex ? '16px' : '6px', height: '6px', borderRadius: '3px', background: i === featuredIndex ? 'var(--rum)' : 'var(--separator)', transition: 'all 0.3s ease' }} />
                ))}
              </div>
            )}
          </div>
        )}

        {loadFailed && <ErrorState onRetry={handleRefresh} />}

        {!loadFailed && regionVendors.length === 0 && regionExperiences.length === 0 && (
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <Icon name="mapPin" size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.region.emptyTitle', { town: town.name })}</p>
            <p>{t('m.region.emptyBody')}</p>
          </div>
        )}

        {/* This Week's Events (replaces Promotions) */}
        <EventsSection />


        {/* Divider above moods with extra spacing */}
        <div className="divider-faded" style={{ marginBottom: '48px' }} />

        {/* Moods */}
        {moods.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ padding: '0 16px 12px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)' }}>
                Choose Your Vibe
              </h2>
            </div>
            <div className="mood-picker" ref={moodPickerRef}>
              {moods.map(mood => (
                <button
                  key={mood.id}
                  data-mood={mood.id}
                  onClick={() => snapMoodToCentre(mood.id)}
                  className={`mood-pill ${selectedMood === mood.id ? 'centre' : ''}`}
                >
                  <Icon name={mood.icon as any} size={16} />
                  {mood.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Experiences */}
        {filteredExperiences.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
              <div className="section-heading">
                <span className="section-eyebrow">Curated for You</span>
                <span className="section-title">Experiences</span>
              </div>
              <Link href="/experiences/browse" className="section-link">{t('m.common.seeAll')}</Link>
            </div>
            <div className="horizontal-scroll" style={{ padding: '4px 16px 12px' }}>
              {filteredExperiences.slice(0, 4).map(e => (
                <ExperienceCard key={e.id} exp={e} />
              ))}
            </div>
          </div>
        )}

        {/* Vendor list */}
        {filteredVendors.length > 0 && (
          <div style={{ padding: '0 16px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">Close By</span>
                <span className="section-title">Near You Now</span>
              </div>
              <Link href="/vendors" className="section-link">See All</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredVendors.slice(0, 5).map(v => (
                <VendorCard key={v.id} vendor={v} distanceKm={distanceFrom(userLocation, v)} />
              ))}
            </div>
          </div>
        )}
      </div>

      <Dock />
    </main>
  )
}