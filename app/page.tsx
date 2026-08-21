// app/page.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import Dock from '@/components/Dock'
import StatusModule from '@/components/StatusModule'
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
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        },
        () => {
          setUserLocation({ lat: 18.2723, lng: -78.3521 })
        }
      )
    } else {
      setUserLocation({ lat: 18.2723, lng: -78.3521 })
    }
  }

  const checkActiveBooking = () => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch('/api/bookings', {
      headers: { Authorization: `Bearer ${token}` }
    })
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
          return {
            ...mood,
            name,
            icon: MOOD_ICONS[name] || mood.icon
          }
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

  const getSunsetTime = () => {
    const now = new Date()
    const sunset = new Date(now)
    sunset.setHours(18, 15, 0, 0)
    const diffMs = sunset.getTime() - now.getTime()
    const diffMin = Math.max(0, Math.round(diffMs / 60000))
    if (diffMin === 0) return 'Sunset now'
    if (diffMin > 60) return `Sunset in ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`
    return `Sunset in ${diffMin} min`
  }

  const isWithinSunsetWindow = () => {
    const now = new Date()
    const sunset = new Date(now)
    sunset.setHours(18, 15, 0, 0)
    const diffMs = sunset.getTime() - now.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    return diffHours >= 0 && diffHours <= 2
  }

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
    const diffHr = Math.floor(diffMin / 60)
    const remainingMin = diffMin % 60
    return `Ends in ${diffHr}h ${remainingMin}m`
  }

  const getVendorEta = (vendor: Vendor) => {
    if (!activeBooking || !userLocation) return null
    const baseEta = vendor.category === 'FOOD' ? 5 : vendor.category === 'DRINKS' ? 8 : 12
    return `${baseEta} min`
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
          <div className="skeleton" style={{ height: '40px', borderRadius: '10px', marginBottom: '16px' }} />
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', overflowX: 'auto' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ width: '66px', height: '66px', borderRadius: '50%', flexShrink: 0 }} />
            ))}
          </div>
          <div className="skeleton" style={{ height: '220px', borderRadius: '12px', marginBottom: '20px' }} />
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ marginBottom: '24px' }}>
              <div className="skeleton" style={{ width: '150px', height: '20px', marginBottom: '12px' }} />
              <div className="skeleton" style={{ height: '100px', borderRadius: '12px' }} />
            </div>
          ))}
        </div>
        <Dock />
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--off-white)', paddingBottom: '80px', overflowX: 'hidden' }}>
      <TopBar />

      {/* Stories Row - ABOVE StatusModule (change 6) */}
      <div className="horizontal-scroll" style={{ padding: '0 16px 4px' }}>
        <div style={{ textAlign: 'center', flexShrink: 0, cursor: 'pointer' }}>
          <div className="story-ring standard" style={{ background: 'var(--light-grey)' }}>
            <div style={{ width: '58px', height: '58px', borderRadius: '50%', border: '2px dashed var(--grey)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="camera" size={20} />
            </div>
          </div>
          <p style={{ fontSize: '10px', color: 'var(--grey)', marginTop: '4px' }}>Your Story</p>
        </div>
        {vendors.filter(v => v.stories && v.stories.length > 0).map(v => (
          <Link key={v.id} href="/stories" style={{ textDecoration: 'none', textAlign: 'center', flexShrink: 0 }}>
            <div className={`story-ring ${v.isPremium ? 'premium' : 'standard'}`}>
              <img src={v.images[0]} alt={v.name} />
            </div>
            <p style={{ fontSize: '10px', color: 'var(--grey)', marginTop: '4px' }}>
              {v.name.split(' ')[0]}
            </p>
          </Link>
        ))}
      </div>

      {/* Status Module (change 1) */}
      <div style={{ padding: '16px 16px 0' }}>
        <StatusModule />
      </div>

      {/* Today Strip - sleek pills (change 5) */}
      <div style={{ display: 'flex', gap: '8px', padding: '0 16px 12px', alignItems: 'center' }}>
        <span className="today-pill today-pill-weather">
          <Icon name="sun" size={14} className="weather-pulse" style={{ color: 'var(--gold)' }} />
          28°C
        </span>
        {isWithinSunsetWindow() && (
          <span className="today-pill today-pill-sunset">
            <Icon name="sun" size={14} style={{ color: 'var(--gold)' }} />
            {getSunsetTime()}
          </span>
        )}
      </div>

      {/* Featured Section (changes 9, 10) */}
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
                style={{ textDecoration: 'none', flexShrink: 0, width: '85%', scrollSnapAlign: 'center' }}
              >
                <div className="featured-card">
                  <div className="card-image" style={{ height: '220px' }}>
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
                      <div className="premium-badge" style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 2 }}>
                        <Icon name="crown" size={12} />
                        PREMIUM
                      </div>
                    )}
                    {vendor.live && (
                      <div className="card-badge" style={{ 
                        top: 'auto', 
                        bottom: '12px', 
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
                        {vendor.category} • {getVendorEta(vendor) || 'Featured'}
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
                <div
                  key={i}
                  style={{
                    width: i === featuredIndex ? '20px' : '6px',
                    height: '6px',
                    borderRadius: '3px',
                    background: i === featuredIndex ? 'var(--rum)' : 'var(--light-grey)',
                    transition: 'all 0.3s ease'
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Not Feeling It Here? */}
      {activeBooking && (
        <div style={{ padding: '0 16px', marginBottom: '20px' }}>
          <div className="section-header">
            <div className="section-heading section-heading-animate section-heading-glow">
              <span className="section-eyebrow">Let&apos;s Bounce</span>
              <div className="section-title-row">
                <span className="section-accent-bar" />
                <span className="section-title">Not Feeling It Here?</span>
              </div>
            </div>
          </div>
          <Link href={bounce.action === 'map' ? '/explore' : '/experiences'} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Icon name={bounce.icon as any} size={24} />
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--black)' }}>{bounce.title}</h3>
                <p style={{ fontSize: '13px', color: 'var(--grey)' }}>{bounce.desc}</p>
              </div>
              <span style={{ marginLeft: 'auto' }}>
                <Icon name="chevronRight" size={18} />
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* Flash Deals */}
      {!activeBooking && flashDeals.length > 0 && (
        <div style={{ marginBottom: '20px', overflow: 'visible' }}>
          <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            <div className="section-heading section-heading-animate section-heading-glow">
              <span className="section-eyebrow">Limited Time</span>
              <div className="section-title-row">
                <span className="section-accent-bar" />
                <span className="section-title">Flash Deals</span>
              </div>
            </div>
          </div>
          <div className="horizontal-scroll" style={{ padding: '10px 16px 30px 16px' }}>
            {flashDeals.map(fd => (
              <Link key={fd.id} href={`/vendor/${fd.vendor.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                <div className="card" style={{ width: '220px' }}>
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
      )}

      {/* Photo Spots with Polaroid style (change 1 - overflow fix) */}
      {photoSpots.length > 0 && (
        <div style={{ marginBottom: '20px', overflow: 'visible' }}>
          <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            <div className="section-heading section-heading-animate section-heading-glow">
              <span className="section-eyebrow">Capture It</span>
              <div className="section-title-row">
                <span className="section-accent-bar" />
                <span className="section-title">Photo Spots</span>
              </div>
            </div>
          </div>
          <div className="horizontal-scroll" style={{ padding: '20px 16px 30px 16px' }}>
            {photoSpots.map((spot) => (
              <Link key={spot.id} href={`/photospot/${spot.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                <div className="polaroid" style={{ width: '200px' }}>
                  <div className="tape-strip" />
                  <div style={{ 
                    width: '100%', 
                    height: '140px', 
                    overflow: 'hidden',
                    borderRadius: '4px'
                  }}>
                    <img 
                      src={spot.officialPhoto} 
                      alt={spot.name} 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover',
                        transition: 'transform 0.3s ease'
                      }}
                    />
                  </div>
                  <div className="polaroid-caption">
                    {spot.name}
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    marginTop: '4px',
                    padding: '0 4px'
                  }}>
                    <span style={{ fontSize: '10px', color: 'var(--rum)', fontWeight: 600 }}>
                      Best: {spot.bestTime}
                    </span>
                    {calculateDistance(spot.lat, spot.lng) && (
                      <span style={{ fontSize: '10px', color: 'var(--sea)', fontWeight: 600 }}>
                        {calculateDistance(spot.lat, spot.lng)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Moods */}
      {moods.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            <div className="section-heading section-heading-animate section-heading-glow">
              <span className="section-eyebrow">How Yuh Feel?</span>
              <div className="section-title-row">
                <span className="section-accent-bar" />
                <span className="section-title">Moods</span>
              </div>
            </div>
          </div>
          <div className="horizontal-scroll" style={{ padding: '10px 16px 20px 16px' }}>
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

      {/* Experiences filtered by mood */}
      {filteredExperiences.length > 0 && (
        <div style={{ marginBottom: '20px', overflow: 'visible' }}>
          <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            <div className="section-heading section-heading-animate section-heading-glow">
              <span className="section-eyebrow">Curated For You</span>
              <div className="section-title-row">
                <span className="section-accent-bar" />
                <span className="section-title">Experiences</span>
              </div>
            </div>
            <Link href="/experiences" className="section-link">
              See all <Icon name="chevronRight" size={14} />
            </Link>
          </div>
          <div className="horizontal-scroll" style={{ padding: '10px 16px 30px 16px' }}>
            {filteredExperiences.slice(0, 4).map(e => (
              <Link key={e.id} href="/experiences" style={{ textDecoration: 'none', flexShrink: 0 }}>
                <div className="card" style={{ width: '280px' }}>
                  <div className="card-image" style={{ height: '160px' }}>
                    <img src={e.imageUrl} alt={e.name} />
                    <div className="card-overlay" />
                    {e.vendor?.isPremium && (
                      <div className="premium-badge" style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 2 }}>
                        <Icon name="crown" size={12} />
                        PREMIUM
                      </div>
                    )}
                  </div>
                  <div className="card-content">
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--black)' }}>{e.name}</h3>
                    <p style={{ fontSize: '12px', color: 'var(--grey)' }}>{e.tagline}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10px', color: 'var(--sea)', fontWeight: 600 }}>
                        {e.stops ? `${e.stops.length} STOPS` : '3 STOPS'}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--grey)' }}>
                        {e.totalDuration ? `${e.totalDuration} HRS` : '4 HRS'}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--gold)', fontWeight: 600 }}>
                        TRAVEL INCLUDED
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <span className="card-price">${e.price}</span>
                      {activeBooking && (
                        <span style={{ fontSize: '11px', color: 'var(--sea)' }}>
                          ETA: {e.travelTime} min
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Near You Now filtered by mood */}
      {filteredVendors.length > 0 && (
        <div>
          <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            <div className="section-heading section-heading-animate section-heading-glow">
              <span className="section-eyebrow">Close By</span>
              <div className="section-title-row">
                <span className="section-accent-bar" />
                <span className="section-title">Near You Now</span>
              </div>
            </div>
            <Link href="/marketplace" className="section-link">
              See all <Icon name="chevronRight" size={14} />
            </Link>
          </div>
          <div className="grid-2" style={{ padding: '0 16px' }}>
            {filteredVendors.slice(0, 4).map(v => (
              <Link key={v.id} href={`/vendor/${v.id}`} style={{ textDecoration: 'none' }}>
                <div className="card">
                  <div className="card-image" style={{ height: '120px' }}>
                    <img src={v.images[0]} alt={v.name} />
                    {v.isPremium && (
                      <div className="premium-badge" style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 2 }}>
                        <Icon name="crown" size={10} />
                        PREMIUM
                      </div>
                    )}
                    {v.live && (
                      <div style={{
                        position: 'absolute',
                        bottom: '8px',
                        left: '8px',
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '10px',
                        fontWeight: 600,
                        color: '#00C853'
                      }}>
                        <span className="live-dot" />
                        {v.whoThere} here now
                      </div>
                    )}
                  </div>
                  <div className="card-content">
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--black)' }}>{v.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--grey)' }}>
                      {v.category}
                      {activeBooking && getVendorEta(v) && ` • ${getVendorEta(v)}`}
                      {!v.open && ' • Closed'}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Dock />
    </main>
  )
}