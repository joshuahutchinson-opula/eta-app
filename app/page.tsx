// app/page.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import FloatingPill from '@/components/FloatingPill'
import ActiveTripBanner from '@/components/ActiveTripBanner'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import { getBounceSuggestion } from '@/lib/context-engine'

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
  totalDuration?: number
  travelIncluded?: boolean
  stops?: Array<{ id: string; name: string; type: string }>
  vendor?: { name: string; isPremium?: boolean }
  moods?: Array<{ id: string; name: string; icon: string }>
  rating?: number
  reviewCount?: number
}

interface PhotoSpot {
  id: string
  name: string
  description: string
  officialPhoto: string
  bestTime: string
  lat?: number
  lng?: number
}

interface FlashDeal {
  id: string
  deal: string
  expires: string
  vendor: { id: string; name: string; images?: string[]; isPremium?: boolean; rating?: number; reviewCount?: number }
}

interface Mood {
  id: string
  name: string
  icon: string
  description: string
  coverImage: string
}

interface ActiveBooking {
  id: string
  experienceId?: string
  vendorId?: string
  status: string
  date: string
  experience?: { name: string; startTime?: string }
}

const MOOD_ICONS: Record<string, string> = {
  'R&R': 'wellness',
  'Just The Two Of Us': 'heart',
  'Party Time': 'moon',
  'Sunset Chaser': 'sun',
  'Water Life': 'activity',
  'Street Food Crawl': 'food',
  'Hangover Cures': 'drink',
  'Solo Missions': 'user',
  'Family Day': 'users',
  'Rum & Bass': 'drink'
}

const STORY_EXAMPLES = [
  { id: 'your-story', name: 'Your Story', type: 'user', image: '' },
  { id: 'story-1', name: 'Rick\'s', type: 'premium', image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=100&h=100&fit=crop' },
  { id: 'story-2', name: 'Pork Pit', type: 'standard', image: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=100&h=100&fit=crop' },
  { id: 'story-3', name: 'Catamaran', type: 'premium', image: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=100&h=100&fit=crop' },
  { id: 'story-4', name: 'Blue Hole', type: 'standard', image: 'https://images.unsplash.com/photo-1519111830404-c95d1a4d7332?w=100&h=100&fit=crop' },
  { id: 'story-5', name: 'Beach', type: 'standard', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=100&h=100&fit=crop' }
]

const EDITORIAL_SUBHEADS: Record<string, string> = {
  'Push Cart': 'Smoke and spice, the real deal',
  'Coral Reef Bar': 'Rum punch and good vibes',
  'MoBay Jerk House': 'The official taste of MoBay',
  'MoBay Watersports': 'Where the reef comes alive'
}

function formatCategory(category: string): string {
  return category.charAt(0) + category.slice(1).toLowerCase()
}

export default function HomePage() {
  const router = useRouter()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [photoSpots, setPhotoSpots] = useState<PhotoSpot[]>([])
  const [flashDeals, setFlashDeals] = useState<FlashDeal[]>([])
  const [moods, setMoods] = useState<Mood[]>([])
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [activeBooking, setActiveBooking] = useState<ActiveBooking | null>(null)
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const [recentlyViewed, setRecentlyViewed] = useState<Array<{ id: string; name: string; image: string; type: string }>>([])
  const featuredScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchAll()
    getUserLocation()
    checkActiveBooking()
    loadRecentlyViewed()
  }, [])

  useEffect(() => {
    const autoScroll = setInterval(() => {
      const featuredList = vendors.filter(v => v.isPremium && v.videos && v.videos.length > 0).slice(0, 5)
      if (featuredScrollRef.current && featuredList.length > 1) {
        const nextIndex = (featuredIndex + 1) % featuredList.length
        featuredScrollRef.current.scrollTo({
          left: nextIndex * featuredScrollRef.current.clientWidth,
          behavior: 'smooth'
        })
        setFeaturedIndex(nextIndex)
      }
    }, 5000)

    return () => clearInterval(autoScroll)
  }, [featuredIndex, vendors])

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocation({ lat: 18.2723, lng: -78.3521 })
      )
    } else {
      setUserLocation({ lat: 18.2723, lng: -78.3521 })
    }
  }

  const checkActiveBooking = () => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch('/api/bookings', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const active = data.find((b: any) => b.status === 'CONFIRMED' || b.status === 'PENDING')
          if (active) setActiveBooking(active)
        }
      })
      .catch(() => {})
  }

  const loadRecentlyViewed = () => {
    const saved = localStorage.getItem('recentlyViewed')
    if (saved) {
      try {
        setRecentlyViewed(JSON.parse(saved).slice(0, 6))
      } catch {}
    }
  }

  const fetchAll = async () => {
    try {
      const [vendorsRes, experiencesRes, photoSpotsRes, flashDealsRes, moodsRes] = await Promise.allSettled([
        fetch('/api/vendors'),
        fetch('/api/experiences'),
        fetch('/api/photospots'),
        fetch('/api/flashdeals'),
        fetch('/api/moods')
      ])

      if (vendorsRes.status === 'fulfilled' && vendorsRes.value.ok) {
        const data = await vendorsRes.value.json()
        setVendors(Array.isArray(data) ? data : [])
      }
      if (experiencesRes.status === 'fulfilled' && experiencesRes.value.ok) {
        const data = await experiencesRes.value.json()
        setExperiences(Array.isArray(data) ? data : [])
      }
      if (photoSpotsRes.status === 'fulfilled' && photoSpotsRes.value.ok) {
        const data = await photoSpotsRes.value.json()
        setPhotoSpots(Array.isArray(data) ? data : [])
      }
      if (flashDealsRes.status === 'fulfilled' && flashDealsRes.value.ok) {
        const data = await flashDealsRes.value.json()
        setFlashDeals(Array.isArray(data) ? data : [])
      }
      if (moodsRes.status === 'fulfilled' && moodsRes.value.ok) {
        const data = await moodsRes.value.json()
        const mappedMoods = data.map((mood: Mood) => {
          let name = mood.name
          if (name === 'Out Til Sunrise') name = 'Party Time'
          if (name === 'Golden Hour') name = 'Sunset Chaser'
          return { ...mood, name, icon: MOOD_ICONS[name] || mood.icon }
        })
        setMoods(mappedMoods)
      }
    } catch (error) {
      console.error('Fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const featuredVendors = vendors.filter(v => v.isPremium && v.videos && v.videos.length > 0).slice(0, 5)
  const hour = new Date().getHours()

  const getTimeEyebrow = () => {
    if (hour >= 6 && hour < 11) return 'MORNING PICKS'
    if (hour >= 11 && hour < 16) return 'MIDDAY PICKS'
    if (hour >= 16 && hour < 19) return 'SUNSET PICKS'
    if (hour >= 19 && hour < 23) return 'NIGHT PICKS'
    return 'LATE NIGHT'
  }

  const calculateDistance = (spotLat?: number, spotLng?: number) => {
    if (!spotLat || !spotLng || !userLocation) return null
    const R = 6371
    const dLat = (spotLat - userLocation.lat) * Math.PI / 180
    const dLng = (spotLng - userLocation.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(spotLat * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  const formatCountdown = (expires: string) => {
    const now = new Date()
    const expiry = new Date(expires)
    const diffMs = expiry.getTime() - now.getTime()
    if (diffMs <= 0) return 'Ended'
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 60) return `Ends in ${diffMin}m`
    return `Ends in ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`
  }

  const handleFeaturedScroll = () => {
    if (featuredScrollRef.current) {
      const scrollLeft = featuredScrollRef.current.scrollLeft
      const cardWidth = featuredScrollRef.current.clientWidth
      const newIndex = Math.round(scrollLeft / cardWidth)
      setFeaturedIndex(Math.min(newIndex, featuredVendors.length - 1))
    }
  }

  // Show all photo spots — fixed proximity filter
  const displayPhotoSpots = photoSpots

  const filteredExperiences = selectedMood 
    ? experiences.filter(e => e.moods?.some(m => m.id === selectedMood || m.name === selectedMood))
    : experiences

  const filteredVendors = selectedMood
    ? vendors.filter(v => v.category === selectedMood || v.neighborhood === selectedMood)
    : vendors

  const topRatedVendor = [...filteredVendors].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0]

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--off-white)', overflowX: 'hidden' }}>
        <FloatingPill />
        <div style={{ padding: '60px 16px 100px' }}>
          <div className="skeleton-card" style={{ width: '64px', height: '64px', borderRadius: '50%', marginBottom: '16px' }}>
            <div className="skeleton-image" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
          </div>
          <div className="skeleton-card" style={{ height: '380px', marginBottom: '24px' }}>
            <div className="skeleton-image" style={{ height: '100%' }} />
          </div>
          <div className="grid-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-image" style={{ height: '120px' }} />
                <div style={{ padding: '12px' }}>
                  <div className="skeleton-text" style={{ height: '14px', width: '80%', marginBottom: '8px' }} />
                  <div className="skeleton-text" style={{ height: '10px', width: '60%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <Dock />
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--off-white)', paddingBottom: '80px', overflowX: 'hidden' }}>
      <FloatingPill />

      {activeBooking && (
        <ActiveTripBanner 
          tripName={activeBooking.experience?.name || 'Your Experience'}
          etaMinutes={12}
          nextStopName="Rick's Café"
        />
      )}

      {/* Stories with shadow and separator */}
      <div className="stories-section" style={{ padding: '60px 0 0' }}>
        <div className="horizontal-scroll" style={{ padding: '0 16px 16px' }}>
          {STORY_EXAMPLES.map(story => (
            story.type === 'user' ? (
              <div key={story.id} style={{ textAlign: 'center', flexShrink: 0, cursor: 'pointer' }}>
                <div className="story-ring standard">
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px dashed var(--grey)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="camera" size={18} />
                  </div>
                </div>
                <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--black)', marginTop: '4px' }}>{story.name}</p>
              </div>
            ) : (
              <Link key={story.id} href="/stories" style={{ textDecoration: 'none', textAlign: 'center', flexShrink: 0 }}>
                <div className={`story-ring ${story.type === 'premium' ? 'premium' : 'standard'}`}>
                  <img src={story.image} alt={story.name} />
                </div>
                <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--black)', marginTop: '4px' }}>{story.name}</p>
              </Link>
            )
          ))}
        </div>
        <div className="stories-separator" />
      </div>

      {/* Featured */}
      {featuredVendors.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div className="featured-heading-container">
            <div className="featured-heading-row">
              <h2 className="featured-title">Featured</h2>
              <span className="featured-eyebrow">— {getTimeEyebrow()}</span>
            </div>
            <div className="featured-underline" />
          </div>

          <div
            ref={featuredScrollRef}
            onScroll={handleFeaturedScroll}
            className="horizontal-scroll"
            style={{ padding: '8px 0 16px 0', scrollSnapType: 'x mandatory' }}
          >
            {featuredVendors.map((vendor, index) => (
              <Link
                key={vendor.id}
                href={`/vendor/${vendor.id}`}
                style={{ textDecoration: 'none', flexShrink: 0, width: '100%', scrollSnapAlign: 'center' }}
              >
                <div className="featured-hero">
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
                      preload="auto"
                      poster={vendor.images[0]}
                      onClick={(e) => {
                        e.preventDefault()
                        const video = e.currentTarget
                        if (video.paused) {
                          video.muted = true
                          video.play().catch(() => {})
                        } else {
                          video.pause()
                        }
                      }}
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
                      {EDITORIAL_SUBHEADS[vendor.name] || `${formatCategory(vendor.category)} · ${vendor.neighborhood}`}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {featuredVendors.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
              {featuredVendors.map((_, i) => (
                <div key={i} style={{ width: i === featuredIndex ? '16px' : '4px', height: '4px', borderRadius: '2px', background: i === featuredIndex ? 'var(--rum)' : 'var(--light-grey)', transition: 'all 0.3s ease' }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recently Viewed */}
      {recentlyViewed.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            <div className="section-heading">
              <span className="section-eyebrow">CONTINUE BROWSING</span>
              <span className="section-title">Recently Viewed</span>
            </div>
          </div>
          <div className="horizontal-scroll" style={{ padding: '8px 16px 16px 16px' }}>
            {recentlyViewed.map(item => (
              <Link key={item.id} href={`/vendor/${item.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                <div className="card" style={{ width: '160px' }}>
                  <div className="card-image" style={{ height: '100px' }}>
                    <img src={item.image} alt={item.name} />
                  </div>
                  <div className="card-content">
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--black)' }}>{item.name}</p>
                    <p style={{ fontSize: '10px', color: 'var(--grey)' }}>{item.type}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Flash Deals */}
      {flashDeals.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            <div className="section-heading">
              <span className="section-eyebrow">LIMITED TIME</span>
              <span className="section-title">Flash Deals</span>
            </div>
          </div>
          <div className="horizontal-scroll" style={{ padding: '8px 16px 16px 16px' }}>
            {flashDeals.map(fd => (
              <Link key={fd.id} href={`/vendor/${fd.vendor.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                <div className="card" style={{ width: '200px' }}>
                  <div className="card-image" style={{ height: '110px' }}>
                    {fd.vendor.images?.[0] && <img src={fd.vendor.images[0]} alt={fd.vendor.name} />}
                    <div className="card-overlay" />
                  </div>
                  <div className="card-content">
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--rum)' }}>{fd.vendor.name}</p>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--black)' }}>{fd.deal}</p>
                    <p style={{ fontSize: '11px', color: 'var(--grey)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Icon name="clock" size={12} />
                      {formatCountdown(fd.expires)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Photo Spots - showing all spots, fixed */}
      {displayPhotoSpots.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            <div className="section-heading">
              <span className="section-eyebrow">CAPTURE IT</span>
              <span className="section-title">Photo Spots</span>
            </div>
          </div>
          <div className="horizontal-scroll" style={{ padding: '8px 16px 16px 16px' }}>
            {displayPhotoSpots.map((spot) => (
              <Link key={spot.id} href={`/photospot/${spot.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                <div className="polaroid" style={{ width: '180px' }}>
                  <div className="tape-strip" />
                  <div style={{ width: '100%', height: '120px', overflow: 'hidden', borderRadius: '4px' }}>
                    <img src={spot.officialPhoto} alt={spot.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div className="polaroid-caption">{spot.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', padding: '0 4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--grey)' }}>{spot.bestTime}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Rum divider */}
      <div className="section-divider" />

      {/* Moods */}
      {moods.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px', justifyContent: 'center' }}>
            <div className="section-heading" style={{ alignItems: 'center' }}>
              <span className="section-eyebrow">YOUR VIBE</span>
              <span className="section-title">How We Feelin Today?</span>
            </div>
          </div>
          <div className="horizontal-scroll" style={{ padding: '8px 16px 16px 16px', justifyContent: 'center' }}>
            {moods.map(mood => (
              <button
                key={mood.id}
                onClick={() => setSelectedMood(selectedMood === mood.id ? null : mood.id)}
                className={`chip ${selectedMood === mood.id ? 'active' : ''}`}
              >
                <Icon name={mood.icon as any} size={14} />
                {mood.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Experiences */}
      {filteredExperiences.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            <div className="section-heading">
              <span className="section-eyebrow">CURATED FOR YOU</span>
              <span className="section-title">Experiences</span>
            </div>
            <Link href="/experiences" className="section-link">See all <Icon name="chevronRight" size={14} /></Link>
          </div>
          <div className="horizontal-scroll" style={{ padding: '8px 16px 16px 16px' }}>
            {filteredExperiences.slice(0, 4).map(e => (
              <Link key={e.id} href="/experiences" style={{ textDecoration: 'none', flexShrink: 0 }}>
                <div className="card" style={{ width: '260px' }}>
                  <div className="card-image" style={{ height: '140px' }}>
                    <img src={e.imageUrl} alt={e.name} style={{ objectPosition: 'center' }} />
                    <div className="card-overlay" />
                  </div>
                  <div className="card-content">
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--black)', marginBottom: '2px' }}>{e.name}</h3>
                    <p style={{ fontSize: '11px', color: 'var(--grey)', marginBottom: '6px' }}>{e.tagline}</p>
                    {e.rating && (
                      <div className="rating-text" style={{ marginBottom: '6px' }}>
                        ★ <span className="num-font">{e.rating}</span>
                        {e.reviewCount && <span> · <span className="num-font">{e.reviewCount}</span></span>}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0' }}>
                      <span className="card-price">${e.price}</span>
                      <span className="num-font" style={{ fontSize: '11px', color: 'var(--grey)' }}>
                        {e.stops ? `${e.stops.length} stops` : '3 stops'} · {e.totalDuration ? `${e.totalDuration} hrs` : '4 hrs'}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Near You Now */}
      {filteredVendors.length > 0 && (
        <div>
          <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            <div className="section-heading">
              <span className="section-eyebrow">CLOSE BY</span>
              <span className="section-title">Near You Now</span>
            </div>
            <Link href="/vendors" className="section-link">See all <Icon name="chevronRight" size={14} /></Link>
          </div>
          <div style={{ padding: '0 16px' }}>
            <div className="grid-2" style={{ gap: '12px' }}>
              {filteredVendors.slice(0, 4).map((v, i) => (
                <Link 
                  key={v.id} 
                  href={`/vendor/${v.id}`} 
                  style={{ 
                    textDecoration: 'none',
                    gridColumn: i === 0 && v.id === topRatedVendor?.id ? '1 / -1' : 'auto'
                  }}
                >
                  <div className="card" style={i === 0 && v.id === topRatedVendor?.id ? { height: '200px' } : {}}>
                    <div className="card-image" style={{ height: i === 0 && v.id === topRatedVendor?.id ? '140px' : '100px' }}>
                      <img src={v.images[0]} alt={v.name} />
                      {v.live && (
                        <div className="card-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="live-dot" />
                          <span className="num-font">{v.whoThere}</span> here now
                        </div>
                      )}
                    </div>
                    <div className="card-content">
                      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--black)', marginBottom: '2px' }}>{v.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--grey)', marginBottom: '4px' }}>
                        {formatCategory(v.category)} · {v.neighborhood}
                        {!v.open && ' · Closed'}
                      </p>
                      {v.rating && (
                        <div className="rating-text" style={{ marginBottom: '4px' }}>
                          ★ <span className="num-font">{v.rating}</span>
                          {v.reviewCount && <span> · <span className="num-font">{v.reviewCount}</span></span>}
                        </div>
                      )}
                      <p className="price-tier">{v.priceRange}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <Dock />
    </main>
  )
}