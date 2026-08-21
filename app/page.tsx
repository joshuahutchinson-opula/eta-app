'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import StatusModule from '@/components/StatusModule'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import { patois } from '@/lib/patois'
import { getBounceSuggestion } from '@/lib/context-engine'

interface Vendor {
  id: string
  name: string
  category: string
  neighborhood: string
  priceRange: string
  description: string
  images: string[]
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
  travelTime: number
  travelMode: string
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

interface CheckInUser {
  name: string
  avatarUrl?: string | null
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
  const [checkIns, setCheckIns] = useState<Array<{ id: string; user: CheckInUser; vendor: { name: string } }>>([])

  useEffect(() => {
    fetchAll()
    getUserLocation()
  }, [])

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

  const fetchAll = async () => {
    try {
      const [vendorsRes, experiencesRes, photoSpotsRes, flashDealsRes, moodsRes, checkInsRes] = await Promise.allSettled([
        fetch('/api/vendors'),
        fetch('/api/experiences'),
        fetch('/api/photospots'),
        fetch('/api/flashdeals'),
        fetch('/api/moods'),
        fetch('/api/checkins')
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
        setMoods(Array.isArray(data) ? data : [])
      }
      if (checkInsRes.status === 'fulfilled' && checkInsRes.value.ok) {
        const data = await checkInsRes.value.json()
        setCheckIns(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const heroVendor = vendors.find(v => v.live) || vendors[0] || null
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
    if (!userLocation || !vendor) return null
    const baseEta = vendor.category === 'FOOD' ? 5 : vendor.category === 'DRINKS' ? 8 : 12
    return `${baseEta} min`
  }

  const curatedCollections = [
    {
      name: 'Sunset Spots',
      icon: 'sun',
      vendors: vendors.filter(v => v.category === 'DRINKS' || v.name.includes('Cliff')).slice(0, 3),
      photoSpots: photoSpots.filter(ps => ps.bestTime === 'Golden Hour').slice(0, 2)
    },
    {
      name: 'Local Favorites',
      icon: 'flame',
      vendors: vendors.filter(v => v.isPremium).slice(0, 4)
    },
    {
      name: 'Hidden Gems',
      icon: 'sparkle',
      vendors: vendors.filter(v => !v.isPremium && v.category !== 'TRANSPORT').slice(0, 3),
      photoSpots: photoSpots.filter(ps => ps.bestTime === 'Dawn').slice(0, 2)
    }
  ]

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        <TopBar />
        <div style={{ padding: '16px', paddingBottom: '120px' }}>
          {/* Today Strip Skeleton */}
          <div className="glass-pill" style={{ padding: '12px 16px', marginBottom: '16px' }}>
            <div style={{ width: '120px', height: '16px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
          {/* Stories Skeleton */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', overflowX: 'auto' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
            ))}
          </div>
          {/* Hero Skeleton */}
          <div className="glass" style={{ height: '220px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s ease-in-out infinite', marginBottom: '20px' }} />
          {/* Section Skeleton */}
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ marginBottom: '24px' }}>
              <div style={{ width: '150px', height: '20px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', marginBottom: '12px', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div className="glass" style={{ height: '100px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          ))}
        </div>
        <Dock />
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <TopBar />
      <StatusModule />

      {/* Today Strip */}
      <div className="glass-pill" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', margin: '8px 16px 0', fontSize: '13px', color: 'var(--sand-dim)', position: 'relative', zIndex: 2 }}>
        <Icon name="sun" size={16} />
        <span>28°C, light breeze</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--gold)', fontWeight: 600, fontSize: '12px' }}>
          <Icon name="sun" size={14} />
          {getSunsetTime()}
        </span>
      </div>

      {/* Stories Row */}
      <div style={{ display: 'flex', gap: '14px', padding: '14px 16px 4px', overflowX: 'auto', scrollbarWidth: 'none', position: 'relative', zIndex: 2 }}>
        {/* Your Story */}
        <div style={{ textDecoration: 'none', flexShrink: 0, textAlign: 'center', cursor: 'pointer' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '2px dashed var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
            <Icon name="camera" size={20} />
          </div>
          <p style={{ fontSize: '9px', color: 'var(--sand-dim)', marginTop: '4px' }}>Your Story</p>
        </div>
        {vendors.filter(v => v.stories && v.stories.length > 0).map(v => (
          <Link key={v.id} href="/stories" style={{ textDecoration: 'none', flexShrink: 0, textAlign: 'center' }}>
            <div className={`story-ring ${v.isPremium ? 'premium' : 'standard'}`}>
              <img
                src={v.images[0]}
                alt={v.name}
                style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--black)', display: 'block' }}
              />
            </div>
            <p style={{ fontSize: '9px', color: 'var(--sand-dim)', marginTop: '4px' }}>
              {v.name.split(' ')[0]}
            </p>
          </Link>
        ))}
        {vendors.filter(v => v.stories && v.stories.length > 0).length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--sand-dim)', padding: '12px 0' }}>
            <Icon name="camera" size={16} />
            {patois.emptySaved}
          </div>
        )}
      </div>

      <div style={{ padding: '16px', paddingBottom: '120px', position: 'relative', zIndex: 2 }}>
        {/* Sunset Countdown */}
        <Link href="/explore" style={{ textDecoration: 'none' }}>
          <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', marginBottom: '16px', cursor: 'pointer' }}>
            <Icon name="sun" size={20} />
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sand)' }}>{getSunsetTime()}</p>
              <p style={{ fontSize: '11px', color: 'var(--sand-dim)' }}>Tap for best sunset spots</p>
            </div>
          </div>
        </Link>

        {/* Hero Card */}
        {heroVendor && (
          <Link href={`/vendor/${heroVendor.id}`} style={{ textDecoration: 'none', color: 'var(--sand)' }}>
            <div className="glass" style={{ position: 'relative', height: '240px', overflow: 'hidden', cursor: 'pointer', marginBottom: '16px', borderRadius: '16px' }}>
              <img src={heroVendor.images[0]} alt={heroVendor.name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 30%, rgba(15,14,12,0.95))' }} />
              {heroVendor.isPremium && <div className="bond-badge">PREMIUM</div>}
              <div style={{ position: 'absolute', bottom: '14px', left: '14px', right: '14px' }}>
                {heroVendor.live && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <p style={{ fontSize: '10px', color: 'var(--sea)', fontWeight: 600 }}>
                      ● LIVE • {heroVendor.whoThere} here now
                    </p>
                    {checkIns.length > 0 && (
                      <div style={{ display: 'flex', marginLeft: 'auto' }}>
                        {checkIns.slice(0, 3).map((ci, i) => (
                          <div key={ci.id} style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid var(--black)', background: 'var(--rum)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, marginLeft: i === 0 ? '0' : '-8px' }}>
                            {ci.user.name?.[0]}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <h3 style={{ fontSize: '22px', fontWeight: 700 }}>{heroVendor.name}</h3>
                <p style={{ fontSize: '12px', color: 'var(--sand-dim)' }}>
                  {heroVendor.category} • {heroVendor.name} ETA: {getVendorEta(heroVendor) || '5 min'}
                </p>
              </div>
            </div>
          </Link>
        )}

        {/* Not Feeling It Here? Let's Bounce */}
        <Link href={bounce.action === 'vendor' && bounce.vendorId ? `/vendor/${bounce.vendorId}` : bounce.action === 'map' ? '/explore' : '/experiences'} style={{ textDecoration: 'none', color: 'var(--sand)' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <Icon name={bounce.icon as any} size={18} />
              Not Feeling It Here? Let&apos;s Bounce
            </h2>
            <div className="glass" style={{ padding: '16px', cursor: 'pointer', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{bounce.title}</h3>
              <p style={{ fontSize: '13px', color: 'var(--sand-dim)' }}>{bounce.desc}</p>
            </div>
          </div>
        </Link>

        {/* Flash Deals */}
        {flashDeals.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon name="flame" size={18} />
              Flash Deals
            </h2>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {flashDeals.map(fd => (
                <Link key={fd.id} href={`/vendor/${fd.vendor.id}`} style={{ textDecoration: 'none', color: 'var(--sand)', flexShrink: 0 }}>
                  <div className="glass" style={{ padding: '14px', cursor: 'pointer', minWidth: '220px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      {fd.vendor.images?.[0] && (
                        <img src={fd.vendor.images[0]} alt={fd.vendor.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                      )}
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--rum-bright)' }}>{fd.vendor.name}</p>
                        <p style={{ fontSize: '13px', fontWeight: 600 }}>{fd.deal}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: '10px', color: 'var(--sand-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Icon name="clock" size={12} />
                        {formatCountdown(fd.expires)}
                      </p>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gold)' }}>
                        CLAIM
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Photo Spots */}
        {photoSpots.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon name="camera" size={18} />
              Photo Spots
            </h2>
            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>
              {photoSpots.map(spot => (
                <Link key={spot.id} href={`/photospot/${spot.id}`} style={{ textDecoration: 'none', color: 'var(--black)', background: '#F5EFE6', padding: '8px 8px 14px', borderRadius: '4px', cursor: 'pointer', flexShrink: 0, width: '170px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  <img src={spot.officialPhoto} alt={spot.name} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '2px' }} />
                  <p style={{ fontSize: '12px', fontWeight: 600, marginTop: '8px', textAlign: 'center', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                    {spot.name}
                  </p>
                  <p style={{ fontSize: '10px', color: '#666', textAlign: 'center' }}>{spot.description}</p>
                  <p style={{ fontSize: '9px', color: 'var(--rum)', textAlign: 'center', marginTop: '4px', fontWeight: 600 }}>
                    Best: {spot.bestTime}
                  </p>
                  {spot.userPhotos && spot.userPhotos.length > 0 && (
                    <p style={{ fontSize: '9px', color: '#999', textAlign: 'center', marginTop: '2px' }}>
                      {spot.userPhotos.length} photos
                    </p>
                  )}
                  {calculateDistance(spot.lat, spot.lng) && (
                    <p style={{ fontSize: '9px', color: 'var(--sea)', textAlign: 'center', marginTop: '2px', fontWeight: 600 }}>
                      {calculateDistance(spot.lat, spot.lng)}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Moods */}
        {moods.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>Moods</h2>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {moods.map(mood => (
                <button
                  key={mood.id}
                  onClick={() => setSelectedMood(selectedMood === mood.id ? null : mood.id)}
                  className="mood-chip"
                  style={{
                    background: selectedMood === mood.id ? 'var(--rum)' : 'var(--glass-bg)',
                    color: selectedMood === mood.id ? 'var(--sand)' : 'var(--sand-dim)',
                    border: selectedMood === mood.id ? '1px solid var(--rum-bright)' : '1px solid var(--glass-border)',
                    transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    transform: selectedMood === mood.id ? 'scale(1.05)' : 'scale(1)'
                  }}
                >
                  <Icon name={mood.icon as any} size={14} />
                  {mood.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Curated Collections */}
        {curatedCollections.map(collection => (
          <div key={collection.name} style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon name={collection.icon as any} size={18} />
              {collection.name}
            </h2>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {collection.vendors.map(v => (
                <Link key={v.id} href={`/vendor/${v.id}`} style={{ textDecoration: 'none', color: 'var(--sand)', flexShrink: 0 }}>
                  <div className="window-card" style={{ position: 'relative', width: '180px', height: '200px' }}>
                    <img src={v.images[0]} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {v.isPremium && <div className="bond-badge">PREMIUM</div>}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px', background: 'linear-gradient(180deg, transparent, rgba(15,14,12,0.95) 50%)' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 700 }}>{v.name}</h4>
                      <p style={{ fontSize: '10px', color: 'var(--sand-dim)' }}>
                        {v.category} • {getVendorEta(v) || '5 min'}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
              {collection.photoSpots && collection.photoSpots.map(spot => (
                <Link key={spot.id} href={`/photospot/${spot.id}`} style={{ textDecoration: 'none', color: 'var(--sand)', flexShrink: 0 }}>
                  <div className="window-card" style={{ position: 'relative', width: '180px', height: '200px' }}>
                    <img src={spot.officialPhoto} alt={spot.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px', background: 'linear-gradient(180deg, transparent, rgba(15,14,12,0.95) 50%)' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 700 }}>{spot.name}</h4>
                      <p style={{ fontSize: '10px', color: 'var(--sand-dim)' }}>
                        Photo Spot • {spot.bestTime}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* Experiences Preview */}
        {experiences.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>Experiences</h2>
            {experiences.slice(0, 2).map(e => (
              <Link key={e.id} href={`/experiences`} style={{ textDecoration: 'none', color: 'var(--sand)', display: 'block' }}>
                <div className="ticket-card" style={{ position: 'relative', marginBottom: '10px' }}>
                  <div style={{ width: '40%', minWidth: '40%', backgroundImage: `url(${e.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  <div style={{ position: 'absolute', left: '40%', top: 0, bottom: 0, width: '20px', borderLeft: '2px dashed rgba(255,255,255,0.2)' }} />
                  <div style={{ flex: 1, padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{e.name}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--sand-dim)' }}>{e.tagline}</p>
                    {e.vendor && (
                      <p style={{ fontSize: '11px', color: 'var(--sand-dim)' }}>{e.vendor.name}</p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <p style={{ fontSize: '12px', color: 'var(--sea)' }}>
                        {e.name} ETA: {e.travelTime} min
                      </p>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gold)', marginLeft: 'auto' }}>
                        ${e.price}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Near You Now */}
        {vendors.length > 0 && (
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>Near You Now</h2>
            <div className="vendor-grid">
              {vendors.slice(0, 4).map(v => (
                <Link key={v.id} href={`/vendor/${v.id}`} className={`window-card ${v.isPremium ? 'bond' : ''}`} style={{ textDecoration: 'none', color: 'var(--sand)', position: 'relative' }}>
                  <img src={v.images[0]} alt={v.name} style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }} />
                  {v.isPremium && <div className="bond-badge">PREMIUM</div>}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px', background: 'linear-gradient(180deg, transparent, rgba(15,14,12,0.95) 50%)' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 700 }}>{v.name}</h4>
                    <p style={{ fontSize: '11px', color: 'var(--sand-dim)' }}>
                      {v.category} • {getVendorEta(v) || '5 min'}
                      {!v.open && ' • Closed'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dock />
    </main>
  )
}