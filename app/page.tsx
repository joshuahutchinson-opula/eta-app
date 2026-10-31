// app/page.tsx — Home. Everything here is for the selected region and is
// filtered on the server: Featured (B.O.N vendors with video), Right now,
// events, vibes → experiences, and the nearest vendors.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Dock from '@/components/Dock'
import VendorCard from '@/components/VendorCard'
import Icon from '@/lib/icons'
import BrandedRefresh from '@/components/BrandedRefresh'
import FloatingPill from '@/components/FloatingPill'
import ActiveTripBanner from '@/components/ActiveTripBanner'
import { triggerHaptic } from '@/lib/haptics'
import { getCurrentUser } from '@/lib/auth-client'
import { authHeaders } from '@/lib/api-client'
import EventsSection from '@/components/EventsSection'
import ExperienceCard from '@/components/ExperienceCard'
import RegionSelector from '@/components/RegionSelector'
import RegionMismatchPrompt from '@/components/RegionMismatchPrompt'
import RightNowStrip from '@/components/RightNowStrip'
import { useRegion } from '@/components/RegionProvider'
import { useLang } from '@/lib/i18n-client'
import StoriesRow from '@/components/StoriesRow'
import ContextTip from '@/components/ContextTip'
import NotificationBell from '@/components/NotificationBell'
import VerifyEmailBanner from '@/components/VerifyEmailBanner'
import SmartVideo from '@/components/SmartVideo'
import Img from '@/components/Img'
import { vibeMoodNames } from '@/lib/vibes'
import ErrorState from '@/components/ErrorState'
import { moodCategories } from '@/lib/mood-profiles'
import { categoryStyle } from '@/lib/vendor-style'
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
  totalDuration?: number | null
  bookedToday?: number
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
  experience?: { name: string } | null
  vendor?: { name: string } | null
  accommodation?: { name: string } | null
  trip?: { slug: string; status: string; name: string } | null
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

export default function HomePage() {
  const [featured, setFeatured] = useState<Vendor[]>([])
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
  const { city, town, ready } = useRegion()
  const { t } = useLang()

  // Pause the Featured auto-advance while a touch is active anywhere on the
  // page, so it doesn't fight the user mid-swipe, then resume on release.
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
    setFeaturedIndex(0)
    featuredScrollRef.current?.scrollTo({ left: 0 })
    if (featured.length <= 1) return
    const autoScroll = setInterval(() => {
      if (isTouchingRef.current) return
      setFeaturedIndex(prevIndex => {
        const nextIndex = (prevIndex + 1) % featured.length
        featuredScrollRef.current?.scrollTo({ left: nextIndex * featuredScrollRef.current.clientWidth, behavior: 'smooth' })
        return nextIndex
      })
    }, 5000)
    return () => clearInterval(autoScroll)
  }, [featured])

  const fetchAll = useCallback(async () => {
    try {
      const signedIn = Boolean(getCurrentUser())
      const [featuredRes, vendorsRes, experiencesRes, moodsRes, bookingsRes] = await Promise.allSettled([
        fetch(`/api/vendors?city=${city}&featured=1&limit=8`),
        fetch(`/api/vendors?city=${city}&limit=40`),
        fetch(`/api/experiences?city=${city}&limit=30`),
        fetch('/api/moods'),
        signedIn ? fetch('/api/bookings', { headers: authHeaders() }) : Promise.reject(new Error('signed out'))
      ])
      const ok = (r: PromiseSettledResult<Response>): r is PromiseFulfilledResult<Response> => r.status === 'fulfilled' && r.value.ok
      setLoadFailed(!ok(vendorsRes) && !ok(experiencesRes))
      if (ok(featuredRes)) { const d = await featuredRes.value.json(); setFeatured(Array.isArray(d) ? d : []) }
      if (ok(vendorsRes)) { const d = await vendorsRes.value.json(); setVendors(Array.isArray(d) ? d : []) }
      if (ok(experiencesRes)) { const d = await experiencesRes.value.json(); setExperiences(Array.isArray(d) ? d : []) }
      if (ok(moodsRes)) {
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
      if (ok(bookingsRes)) {
        const data: Booking[] = await bookingsRes.value.json()
        const now = Date.now()
        const active = data
          .filter(b => b.status === 'CONFIRMED')
          .filter(b => {
            const start = new Date(b.date).getTime()
            return start >= now - 3 * 3600000 && start <= now + 6 * 3600000
          })
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
        setActiveBooking(active || null)
      } else {
        setActiveBooking(null)
      }
    } catch (error) {
      console.error('Fetch error:', error)
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [city])

  useEffect(() => {
    const user = getCurrentUser()
    if (user?.name) setFirstName(user.name.split(' ')[0])
  }, [])

  useEffect(() => { if (ready) fetchAll() }, [ready, fetchAll])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }

  const handleFeaturedScroll = () => {
    if (featuredScrollRef.current) {
      const newIndex = Math.round(featuredScrollRef.current.scrollLeft / featuredScrollRef.current.clientWidth)
      setFeaturedIndex(Math.min(newIndex, featured.length - 1))
    }
  }

  const snapMoodToCentre = (moodId: string) => {
    triggerHaptic('selection')
    setSelectedMood(selectedMood === moodId ? null : moodId)
    const pill = moodPickerRef.current?.querySelector(`[data-mood="${moodId}"]`)
    pill?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  const filteredExperiences = selectedMood
    ? experiences.filter(e => e.moods?.some(m => m.id === selectedMood || m.name === selectedMood))
    : experiences

  // A mood maps to the vendor categories it's about (lib/mood-profiles.ts),
  // the same mapping the route generator uses.
  const moodCats = moods.find(m => m.id === selectedMood)?.categories ?? []
  const moodVendors = selectedMood ? vendors.filter(v => moodCats.includes(v.category)) : vendors
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

  const bookingTitle = activeBooking ? activeBooking.experience?.name || activeBooking.accommodation?.name || activeBooking.trip?.name || activeBooking.vendor?.name || t('m.home.yourTrip') : ''

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <FloatingPill />
      <BrandedRefresh refreshing={refreshing} onRefresh={handleRefresh} />

      <div className="content-fade-in">
        <RegionSelector />
        <RegionMismatchPrompt />

        {/* Greeting */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="greeting-text" style={{ flex: 1, minWidth: 0 }}>{t('m.home.greeting', { name: firstName ? `, ${firstName}` : '' })}</h1>
            <Link href="/search" aria-label={t('m.search.open')} className="heart-btn" style={{ background: 'var(--system-bg-elevated)', boxShadow: 'var(--shadow-card)', color: 'var(--label-primary)' }}>
              <Icon name="search" size={18} />
            </Link>
            <NotificationBell />
          </div>
        </div>

        <VerifyEmailBanner />

        {activeBooking && (
          <div style={{ paddingTop: '12px' }}>
            <ActiveTripBanner
              title={bookingTitle}
              start={activeBooking.date}
              tripSlug={activeBooking.trip?.status === 'BOOKED' ? activeBooking.trip.slug : null}
              href={activeBooking.trip?.status === 'BOOKED' ? `/experiences?trip=${activeBooking.trip.slug}` : '/bookings'}
            />
          </div>
        )}

        <StoriesRow />

        <ContextTip />

        <div className="divider-faded" />

        {/* Featured / Destinations — only when the region has featured vendors. */}
        {featured.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ padding: '0 16px 12px' }}>
              <div className="section-heading">
                <span className="section-eyebrow">{t('m.home.featured')}</span>
                <span className="section-title section-title-shimmer">{t('m.home.destinations')}</span>
              </div>
            </div>
            <div ref={featuredScrollRef} onScroll={handleFeaturedScroll} className="horizontal-scroll" style={{ padding: '8px 16px 12px', scrollSnapType: 'x mandatory' }}>
              {featured.map((vendor, index) => (
                <Link key={vendor.id} href={`/vendor/${vendor.id}`} onClick={() => triggerHaptic('light')} style={{ textDecoration: 'none', flexShrink: 0, width: '100%', scrollSnapAlign: 'center' }}>
                  <div className="featured-hero" style={{ margin: '0 4px' }}>
                    {vendor.videos?.[0] ? (
                      <SmartVideo src={vendor.videos[0]} poster={vendor.images[0]} alt={vendor.name} active={index === featuredIndex} />
                    ) : (
                      <Img src={vendor.images[0]} alt={vendor.name} width={1080} height={1350} priority={index === 0} />
                    )}
                    <div className="featured-hero-overlay" />
                    {vendor.live && (
                      <div className="featured-hero-badge">
                        <span className="live-dot" />
                        <span className="num-font">{vendor.whoThere}</span> {t('m.home.hereNow')}
                      </div>
                    )}
                    <div className="featured-hero-content">
                      <h2 className="featured-hero-title">{vendor.name}</h2>
                      <p className="featured-hero-sub">{categoryStyle(vendor.category).label} · {vendor.neighborhood}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {featured.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                {featured.map((_, i) => (
                  <div key={i} style={{ width: i === featuredIndex ? '16px' : '6px', height: '6px', borderRadius: '3px', background: i === featuredIndex ? 'var(--rum)' : 'var(--separator)', transition: 'all 0.3s ease' }} />
                ))}
              </div>
            )}
          </div>
        )}

        {loadFailed && <ErrorState onRetry={handleRefresh} />}

        {!loadFailed && vendors.length === 0 && experiences.length === 0 && (
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <Icon name="mapPin" size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.region.emptyTitle', { town: town.name })}</p>
            <p>{t('m.region.emptyBody')}</p>
          </div>
        )}

        <RightNowStrip />

        {/* This Week's Events */}
        <EventsSection />

        <div className="divider-faded" style={{ marginBottom: '48px' }} />

        {/* Moods */}
        {moods.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ padding: '0 16px 12px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)' }}>{t('m.home.chooseVibe')}</h2>
            </div>
            <div className="mood-picker" ref={moodPickerRef}>
              {moods.map(mood => (
                <button key={mood.id} data-mood={mood.id} onClick={() => snapMoodToCentre(mood.id)} className={`mood-pill ${selectedMood === mood.id ? 'centre' : ''}`}>
                  <Icon name={mood.icon} size={16} />
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
                <span className="section-eyebrow">{t('m.home.curated')}</span>
                <span className="section-title">{t('m.home.experiences')}</span>
              </div>
              <Link href="/experiences/browse" className="section-link">{t('m.common.seeAll')}</Link>
            </div>
            <div className="horizontal-scroll" style={{ padding: '4px 16px 12px' }}>
              {filteredExperiences.slice(0, 4).map(e => <ExperienceCard key={e.id} exp={e} />)}
            </div>
          </div>
        )}

        {/* Vendor list */}
        {filteredVendors.length > 0 && (
          <div style={{ padding: '0 16px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">{t('m.home.closeBy')}</span>
                <span className="section-title">{t('m.home.nearYou')}</span>
              </div>
              <Link href="/vendors" className="section-link">{t('m.common.seeAll')}</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredVendors.slice(0, 5).map(v => <VendorCard key={v.id} vendor={v} distanceKm={distanceFrom(userLocation, v)} />)}
            </div>
          </div>
        )}
      </div>

      <Dock />
    </main>
  )
}
