// app/page.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
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
}

interface PhotoSpot {
  id: string
  name: string
  description: string
  officialPhoto: string
  bestTime: string
  lat?: number
  lng?: number
  userPhotos?: Array<{ id: string; url: string; likes: number }>
}

interface FlashDeal {
  id: string
  deal: string
  expires: string
  vendor: { id: string; name: string; images?: string[]; isPremium?: boolean }
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

export default function HomePage() {
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
  const featuredScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchAll()
    getUserLocation()
    checkActiveBooking()
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
  const bounce = getBounceSuggestion(null, userLocation, hour)

  const calculateDistance = (spotLat?: number, spotLng?: number) => {
    if (!spotLat || !spotLng || !userLocation) return null
    const R = 6371
    const dLat = (spotLat - userLocation.lat) * Math.PI / 180
    const dLng = (spotLng - userLocation.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(spotLat * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distanceKm = R * c
    if (distanceKm < 1) return `${Math.round(distanceKm * 1000)}m away`
    return `${distanceKm.toFixed(1)}km away`
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

  const filteredExperiences = selectedMood 
    ? experiences.filter(e => e.moods?.some(m => m.id === selectedMood || m.name === selectedMood))
    : experiences

  const filteredVendors = selectedMood
    ? vendors.filter(v => v.category === selectedMood || v.neighborhood === selectedMood)
    : vendors

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--off-white)', overflowX: 'hidden' }}>
        <TopBar />
        <div style={{ padding: '16px', paddingBottom: '100px' }}>
          <div className="skeleton" style={{ height: '66px', borderRadius: '50%', width: '66px', marginBottom: '4px' }} />
          <div className="skeleton" style={{ height: '280px', borderRadius: '12px', marginBottom: '16px' }} />
          <div className="skeleton" style={{ height: '100px', borderRadius: '12px' }} />
        </div>
        <Dock />
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--off-white)', paddingBottom: '80px', overflowX: 'hidden' }}>
      <TopBar />

      {/* Stories Row */}
      <div className="horizontal-scroll" style={{ padding: '24px 16px 4px' }}>
        {STORY_EXAMPLES.map(story => (
          story.type === 'user' ? (
            <div key={story.id} style={{ textAlign: 'center', flexShrink: 0, cursor: 'pointer' }}>
              <div className="story-ring standard" style={{ background: 'var(--light-grey)' }}>
                <div style={{ width: '58px', height: '58px', borderRadius: '50%', border: '2px dashed var(--grey)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="camera" size={20} />
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

      {/* Featured - no white container */}
      {featuredVendors.length > 0 && (
        <div style={{ marginBottom: '20px', overflow: 'visible' }}>
          <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            <div className="section-heading">
              <span className="section-eyebrow">Explore Jamaica</span>
              <div className="section-title-row">
                <span className="section-accent-bar" />
                <span className="section-title featured-heading-text">Featured</span>
              </div>
            </div>
          </div>
          <div
            ref={featuredScrollRef}
            onScroll={handleFeaturedScroll}
            className="horizontal-scroll"
            style={{ padding: '20px 16px 30px 16px', scrollSnapType: 'x mandatory' }}
          >
            {featuredVendors.map((vendor) => (
              <Link
                key={vendor.id}
                href={`/vendor/${vendor.id}`}
                style={{ textDecoration: 'none', flexShrink: 0, width: '100%', scrollSnapAlign: 'center' }}
              >
                <div className="featured-card">
                  <div className="card-image" style={{ height: '280px' }}>
                    {vendor.videos && vendor.videos.length > 0 ? (
                      <video
                        src={vendor.videos[0]}
                        muted
                        loop
                        autoPlay
                        playsInline
                        preload="auto"
                        poster={vendor.images[0]}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <img src={vendor.images[0]} alt={vendor.name} />
                    )}
                    <div className="card-overlay" />
                    {vendor.isPremium && (
                      <div className="premium-crown premium-pulse" style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 2 }}>
                        <Icon name="crown" size={14} />
                      </div>
                    )}
                    {vendor.live && (
                      <div className="card-badge" style={{ 
                        top: '12px', 
                        right: '12px', 
                        left: 'auto',
                        background: 'var(--sea)', 
                        color: '#0F0E0C',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span className="live-dot" />
                        LIVE • {vendor.whoThere} here now
                      </div>
                    )}
                    <div className="card-content" style={{ position: 'absolute', bottom: '0', left: '0', right: '0' }}>
                      <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'white' }}>{vendor.name}</h3>
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
                        {vendor.category}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {featuredVendors.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '10px' }}>
              {featuredVendors.map((_, i) => (
                <div key={i} style={{ width: i === featuredIndex ? '20px' : '6px', height: '6px', borderRadius: '3px', background: i === featuredIndex ? 'var(--rum)' : 'var(--light-grey)', transition: 'all 0.3s ease' }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Flash Deals - content in white container */}
      {flashDeals.length > 0 && (
        <div style={{ marginBottom: '20px', overflow: 'visible' }}>
          <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            <div className="section-heading section-heading-animate">
              <span className="section-eyebrow">Limited Time</span>
              <div className="section-title-row">
                <span className="section-accent-bar" />
                <span className="section-title">Flash Deals</span>
              </div>
            </div>
          </div>
          <div className="section-content-card">
            <div className="horizontal-scroll" style={{ padding: '0' }}>
              {flashDeals.map(fd => (
                <Link key={fd.id} href={`/vendor/${fd.vendor.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                  <div className="card" style={{ width: '200px', margin: '0' }}>
                    <div className="card-image" style={{ height: '120px' }}>
                      {fd.vendor.images?.[0] && <img src={fd.vendor.images[0]} alt={fd.vendor.name} />}
                      <div className="card-overlay" />
                      <div className="card-badge" style={{ background: 'var(--rum)', color: 'white' }}>DEAL</div>
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
        </div>
      )}

      {/* Photo Spots - content in white container */}
      {photoSpots.length > 0 && (
        <div style={{ marginBottom: '20px', overflow: 'visible' }}>
          <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            <div className="section-heading section-heading-animate">
              <span className="section-eyebrow">Capture It</span>
              <div className="section-title-row">
                <span className="section-accent-bar" />
                <span className="section-title">Photo Spots</span>
              </div>
            </div>
          </div>
          <div className="section-content-card">
            <div className="horizontal-scroll" style={{ padding: '10px 0 20px 0' }}>
              {photoSpots.map((spot) => (
                <Link key={spot.id} href={`/photospot/${spot.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                  <div className="polaroid" style={{ width: '180px' }}>
                    <div className="tape-strip" />
                    <div style={{ width: '100%', height: '130px', overflow: 'hidden', borderRadius: '4px' }}>
                      <img src={spot.officialPhoto} alt={spot.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div className="polaroid-caption">{spot.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', padding: '0 4px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--rum)', fontWeight: 600 }}>Best: {spot.bestTime}</span>
                      {calculateDistance(spot.lat, spot.lng) && (
                        <span style={{ fontSize: '10px', color: 'var(--sea)', fontWeight: 600 }}>{calculateDistance(spot.lat, spot.lng)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Moods - centered, no white container */}
      {moods.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '12px', padding: '0 16px' }}>
            <h2 className="moods-heading-text" style={{ fontSize: '22px', fontWeight: 800 }}>How We Feelin Today?</h2>
          </div>
          <div className="horizontal-scroll" style={{ padding: '10px 16px 20px 16px', justifyContent: 'center' }}>
            {moods.map(mood => (
              <button
                key={mood.id}
                onClick={() => setSelectedMood(selectedMood === mood.id ? null : mood.id)}
                className={`chip ${selectedMood === mood.id ? 'active' : ''}`}
                style={{
                  background: selectedMood === mood.id ? 'var(--rum)' : 'var(--card-bg)',
                  color: selectedMood === mood.id ? 'white' : 'var(--black)',
                  boxShadow: selectedMood === mood.id ? 'none' : 'var(--card-shadow)'
                }}
              >
                <Icon name={mood.icon as any} size={14} />
                {mood.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Experiences - content in white container */}
      {filteredExperiences.length > 0 && (
        <div style={{ marginBottom: '20px', overflow: 'visible' }}>
          <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            <div className="section-heading section-heading-animate">
              <span className="section-eyebrow">Curated For You</span>
              <div className="section-title-row">
                <span className="section-accent-bar" />
                <span className="section-title">Experiences</span>
              </div>
            </div>
            <Link href="/experiences" className="section-link">See all <Icon name="chevronRight" size={14} /></Link>
          </div>
          <div className="section-content-card">
            <div className="horizontal-scroll" style={{ padding: '0' }}>
              {filteredExperiences.slice(0, 4).map(e => (
                <Link key={e.id} href="/experiences" style={{ textDecoration: 'none', flexShrink: 0 }}>
                  <div className="card" style={{ width: '260px', margin: '0' }}>
                    <div className="card-image" style={{ height: '150px' }}>
                      <img src={e.imageUrl} alt={e.name} />
                      <div className="card-overlay" />
                      {e.vendor?.isPremium && (
                        <div className="premium-crown premium-pulse" style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 2 }}>
                          <Icon name="crown" size={14} />
                        </div>
                      )}
                    </div>
                    <div className="card-content">
                      <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--black)' }}>{e.name}</h3>
                      <p style={{ fontSize: '12px', color: 'var(--grey)' }}>{e.tagline}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '10px', color: 'var(--sea)', fontWeight: 600 }}>{e.stops ? `${e.stops.length} STOPS` : '3 STOPS'}</span>
                        <span style={{ fontSize: '10px', color: 'var(--grey)' }}>{e.totalDuration ? `${e.totalDuration} HRS` : '4 HRS'}</span>
                        <span style={{ fontSize: '10px', color: 'var(--gold)', fontWeight: 600 }}>TRAVEL INCLUDED</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                        <span className="card-price">${e.price}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Near You Now - content in white container */}
      {filteredVendors.length > 0 && (
        <div>
          <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            <div className="section-heading section-heading-animate">
              <span className="section-eyebrow">Close By</span>
              <div className="section-title-row">
                <span className="section-accent-bar" />
                <span className="section-title">Near You Now</span>
              </div>
            </div>
            <Link href="/marketplace" className="section-link">See all <Icon name="chevronRight" size={14} /></Link>
          </div>
          <div className="section-content-card">
            <div className="grid-2" style={{ gap: '8px' }}>
              {filteredVendors.slice(0, 4).map(v => (
                <Link key={v.id} href={`/vendor/${v.id}`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ margin: '0' }}>
                    <div className="card-image" style={{ height: '110px' }}>
                      <img src={v.images[0]} alt={v.name} />
                      {v.isPremium && (
                        <div className="premium-crown premium-pulse" style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 2 }}>
                          <Icon name="crown" size={12} />
                        </div>
                      )}
                      {v.live && (
                        <div style={{ position: 'absolute', bottom: '8px', left: '8px', zIndex: 2, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 600, color: '#00C853' }}>
                          <span className="live-dot" />
                          {v.whoThere} here now
                        </div>
                      )}
                    </div>
                    <div className="card-content">
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--black)' }}>{v.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--grey)' }}>
                        {v.category}
                        {!v.open && ' • Closed'}
                      </p>
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