// app/marketplace/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import { patois } from '@/lib/patois'
import BrandedRefresh from '@/components/BrandedRefresh'
import { hapticSaved } from '@/lib/haptics'

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false })

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
  lat?: number
  lng?: number
}

interface Accommodation {
  id: string
  name: string
  type: string
  googleStars: number
  description: string
  priceRange: string
  media: Array<{ type: string; url: string }>
  vetted?: boolean
}

interface FlashDeal {
  id: string
  deal: string
  expires: string
  vendor: { id: string; name: string; images?: string[]; isPremium?: boolean; rating?: number; reviewCount?: number }
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

const MOOD_NAMES = [
  'R&R',
  'Just The Two Of Us',
  'Party Time',
  'Sunset Chaser',
  'Water Life',
  'Street Food Crawl',
  'Hangover Cures',
  'Solo Missions',
  'Family Day',
  'Rum & Bass'
]

const SORT_OPTIONS = ['Recommended', 'Price', 'Rating', 'Distance']

const MOCK_FLASH_DEALS: FlashDeal[] = [
  { 
    id: 'fd-1', 
    deal: '20% off jerk chicken', 
    expires: new Date(Date.now() + 6 * 3600000).toISOString(), 
    vendor: { id: 'v1', name: 'Push Cart', images: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800'], isPremium: true } 
  },
  { 
    id: 'fd-2', 
    deal: '2-for-1 rum punch', 
    expires: new Date(Date.now() + 4 * 3600000).toISOString(), 
    vendor: { id: 'v2', name: 'Coral Reef Bar', images: ['https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800'], isPremium: true } 
  },
  { 
    id: 'fd-3', 
    deal: 'Free dessert with lobster', 
    expires: new Date(Date.now() + 3 * 3600000).toISOString(), 
    vendor: { id: 'v3', name: 'Cliffside Grill', images: ['https://images.unsplash.com/photo-1544025162-d76694265947?w=800'], isPremium: true } 
  },
]

function formatCategory(category: string): string {
  return category.charAt(0) + category.slice(1).toLowerCase()
}

export default function MarketplacePage() {
  const router = useRouter()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [accommodations, setAccommodations] = useState<Accommodation[]>([])
  const [flashDeals, setFlashDeals] = useState<FlashDeal[]>(MOCK_FLASH_DEALS)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState<'NEGRIL' | 'MONTEGO_BAY'>('NEGRIL')
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('Recommended')
  const [savedVendors, setSavedVendors] = useState<string[]>([])
  const [accommodationType, setAccommodationType] = useState('All-Inclusive')
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  const [showSavedOnly, setShowSavedOnly] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>({ lat: 18.2723, lng: -78.3521 })
  const [dishesOfDay, setDishesOfDay] = useState<Array<{ id: string; vendorId: string; vendorName: string; dish: string; price: number; eta: string; imageUrl: string }>>([])

  useEffect(() => {
    fetchData()
    const saved = localStorage.getItem('savedVendors')
    if (saved) setSavedVendors(JSON.parse(saved))
    const savedCity = localStorage.getItem('marketplaceCity')
    if (savedCity) setCity(savedCity as 'NEGRIL' | 'MONTEGO_BAY')
    const savedMood = localStorage.getItem('marketplaceMood')
    if (savedMood) setSelectedMood(savedMood)
    const savedSort = localStorage.getItem('marketplaceSort')
    if (savedSort) setSortBy(savedSort)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocation({ lat: 18.2723, lng: -78.3521 })
      )
    }
  }, [])

  const fetchData = async () => {
    try {
      const [vendorsRes, accomRes, flashDealsRes] = await Promise.all([
        fetch('/api/vendors'),
        fetch('/api/accommodations'),
        fetch('/api/flashdeals')
      ])

      const vendorsData = await vendorsRes.json()
      const accomData = await accomRes.json()
      const flashDealsData = await flashDealsRes.json()

      setVendors(Array.isArray(vendorsData) ? vendorsData : [])
      setAccommodations(Array.isArray(accomData) ? accomData : [])
      setFlashDeals(Array.isArray(flashDealsData) && flashDealsData.length > 0 ? flashDealsData : MOCK_FLASH_DEALS)
      
      const foodVendors = Array.isArray(vendorsData) ? vendorsData.filter((v: Vendor) => v.category === 'FOOD').slice(0, 3) : []
      const mockDishes = foodVendors.map((v: Vendor, i: number) => ({
        id: `dish-${v.id}`,
        vendorId: v.id,
        vendorName: v.name,
        dish: ['Jerk Chicken Plate', 'Curry Goat Special', 'Fresh Catch of the Day'][i] || 'Daily Special',
        price: [15, 18, 22][i] || 20,
        eta: ['15 min', '20 min', '25 min'][i] || '20 min',
        imageUrl: v.images[0] || ''
      }))
      setDishesOfDay(mockDishes)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const toggleSaveVendor = (vendorId: string) => {
    hapticSaved()
    const newSaved = savedVendors.includes(vendorId)
      ? savedVendors.filter(id => id !== vendorId)
      : [...savedVendors, vendorId]
    setSavedVendors(newSaved)
    localStorage.setItem('savedVendors', JSON.stringify(newSaved))
  }

  const handleCityChange = (c: 'NEGRIL' | 'MONTEGO_BAY') => {
    setCity(c)
    localStorage.setItem('marketplaceCity', c)
  }

  const handleMoodChange = (mood: string | null) => {
    setSelectedMood(mood)
    if (mood) localStorage.setItem('marketplaceMood', mood)
    else localStorage.removeItem('marketplaceMood')
  }

  const handleSortChange = (sort: string) => {
    setSortBy(sort)
    localStorage.setItem('marketplaceSort', sort)
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

  const premiumVendors = vendors.filter(v => v.isPremium)

  const filteredVendors = vendors
    .filter(v => !search || 
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.category.toLowerCase().includes(search.toLowerCase()) ||
      v.neighborhood.toLowerCase().includes(search.toLowerCase())
    )
    .filter(v => !city || v.city === city)
    .filter(v => !selectedMood || v.category === selectedMood.toUpperCase() || v.neighborhood === selectedMood)
    .filter(v => !showSavedOnly || savedVendors.includes(v.id))
    .sort((a, b) => {
      if (sortBy === 'Price') return (a.priceRange || '').localeCompare(b.priceRange || '')
      if (sortBy === 'Rating') return (b.rating || 0) - (a.rating || 0)
      if (sortBy === 'Distance') return (a.neighborhood || '').localeCompare(b.neighborhood || '')
      return 0
    })

  const filteredAccommodations = accommodations.filter(a => 
    !accommodationType || a.type === accommodationType
  )

  if (loading) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)' }}>
        <div style={{ padding: '16px', paddingBottom: '100px' }}>
          <div className="skeleton-card" style={{ height: '44px', marginBottom: '24px' }}>
            <div className="skeleton-image" style={{ height: '100%' }} />
          </div>
          <div className="skeleton-card" style={{ height: '200px', marginBottom: '24px' }}>
            <div className="skeleton-image" style={{ height: '100%' }} />
          </div>
        </div>
        <Dock />
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <BrandedRefresh refreshing={refreshing} onRefresh={handleRefresh} />

      <div className="content-fade-in" style={{ padding: '16px' }}>
        {/* Search bar with controls */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px',
          marginBottom: '12px',
          minHeight: '44px'
        }}>
          <div className="card" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            padding: '10px 12px',
            flex: 1,
            minWidth: 0,
            minHeight: '44px'
          }}>
            <Icon name="search" size={16} style={{ color: 'var(--label-secondary)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', color: 'var(--label-primary)', fontSize: '17px', outline: 'none', fontFamily: 'inherit' }}
            />
          </div>
          <button
            onClick={() => setViewMode('list')}
            style={{ 
              background: viewMode === 'list' ? 'var(--rum)' : 'var(--system-bg-elevated)',
              border: 'none',
              cursor: 'pointer',
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: viewMode === 'list' ? 'white' : 'var(--label-secondary)',
              flexShrink: 0
            }}
          >
            <Icon name="journal" size={16} />
          </button>
          <button
            onClick={() => setViewMode('map')}
            style={{ 
              background: viewMode === 'map' ? 'var(--rum)' : 'var(--system-bg-elevated)',
              border: 'none',
              cursor: 'pointer',
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: viewMode === 'map' ? 'white' : 'var(--label-secondary)',
              flexShrink: 0
            }}
          >
            <Icon name="mapPin" size={16} />
          </button>
          <button
            onClick={() => setShowFilterSheet(true)}
            style={{ 
              background: 'var(--system-bg-elevated)',
              border: 'none',
              cursor: 'pointer',
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--label-secondary)',
              flexShrink: 0
            }}
          >
            <Icon name="filter" size={16} />
          </button>
        </div>

        {/* Mood pills - same as homepage + Saved */}
        <div className="mood-picker" style={{ padding: '4px 0 12px' }}>
          <button
            onClick={() => setShowSavedOnly(!showSavedOnly)}
            className={`mood-pill ${showSavedOnly ? 'centre' : ''}`}
          >
            <Icon name="heart" size={16} className={showSavedOnly ? 'filled' : ''} />
            Saved
          </button>
          {MOOD_NAMES.map(mood => (
            <button
              key={mood}
              onClick={() => handleMoodChange(selectedMood === mood ? null : mood)}
              className={`mood-pill ${selectedMood === mood ? 'centre' : ''}`}
            >
              <Icon name={MOOD_ICONS[mood] as any} size={16} />
              {mood}
            </button>
          ))}
        </div>

        {/* Map view */}
        {viewMode === 'map' && (
          <div style={{ height: '400px', borderRadius: '14px', overflow: 'hidden', marginBottom: '16px' }}>
            <MapContainer
              center={[userLocation.lat, userLocation.lng]}
              zoom={14}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap &copy; CARTO'
              />
              {filteredVendors.map(v => {
                const vendorLat = v.lat || userLocation.lat + (Math.random() * 0.02 - 0.01)
                const vendorLng = v.lng || userLocation.lng + (Math.random() * 0.02 - 0.01)
                return (
                  <Marker key={v.id} position={[vendorLat, vendorLng]}>
                    <Popup>
                      <div style={{ minWidth: '150px', background: '#1C1C1E', color: '#FFFFFF', padding: '8px', borderRadius: '8px' }}>
                        <p style={{ fontSize: '15px', fontWeight: 600 }}>{v.name}</p>
                        <p style={{ fontSize: '13px', color: '#A1A1A1' }}>{formatCategory(v.category)} · {v.priceRange}</p>
                        <p style={{ fontSize: '13px', color: v.open ? '#34C759' : '#A1A1A1' }}>
                          {v.open ? 'Open' : 'Closed'}
                          {v.isPremium && ' · ★ Premium'}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}
            </MapContainer>
          </div>
        )}

        {/* Dish Of The Day */}
        {dishesOfDay.length > 0 && viewMode === 'list' && !showSavedOnly && (
          <div style={{ marginBottom: '24px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">Today&apos;s Pick</span>
                <span className="section-title">Dish Of The Day</span>
              </div>
            </div>
            <Link href={`/vendor/${dishesOfDay[0].vendorId}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ position: 'relative', height: '200px' }}>
                <img src={dishesOfDay[0].imageUrl} alt={dishesOfDay[0].dish} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.8))' }} />
                <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '16px', color: 'white' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', color: 'rgba(255,255,255,0.7)' }}>
                    {dishesOfDay[0].vendorName}
                  </p>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>{dishesOfDay[0].dish}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="num-font" style={{ fontSize: '17px', fontWeight: 700, color: 'var(--rum)' }}>
                      ${dishesOfDay[0].price}
                    </span>
                    <span className="num-font" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                      {dishesOfDay[0].eta}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Flash Deals */}
        {flashDeals.length > 0 && viewMode === 'list' && (
          <div style={{ marginBottom: '24px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">Limited Time</span>
                <span className="section-title">Flash Deals</span>
              </div>
            </div>
            <div className="horizontal-scroll" style={{ padding: '4px 0 12px' }}>
              {flashDeals.map(fd => (
                <Link key={fd.id} href={`/vendor/${fd.vendor.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                  <div className="card" style={{ width: '200px' }}>
                    <div className="card-image" style={{ height: '110px' }}>
                      {fd.vendor.images?.[0] && <img src={fd.vendor.images[0]} alt={fd.vendor.name} />}
                      <div className="card-overlay" />
                    </div>
                    <div className="card-content">
                      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rum)' }}>{fd.vendor.name}</p>
                      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{fd.deal}</p>
                      <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
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

        {/* Premium Members */}
        {premiumVendors.length > 0 && viewMode === 'list' && !showSavedOnly && (
          <div style={{ marginBottom: '24px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-title">Premium Members</span>
              </div>
            </div>
            <div className="horizontal-scroll" style={{ padding: '4px 0 12px' }}>
              {premiumVendors.map(v => (
                <Link key={v.id} href={`/vendor/${v.id}`} style={{ textDecoration: 'none', flexShrink: 0, width: '180px' }}>
                  <div className="card">
                    <div className="card-image" style={{ height: '120px' }}>
                      <img src={v.images[0]} alt={v.name} />
                      {v.live && (
                        <div className="card-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="live-dot" />
                          <span className="num-font">{v.whoThere}</span> here now
                        </div>
                      )}
                    </div>
                    <div className="card-content">
                      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '2px' }}>{v.name}</p>
                      <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '4px' }}>{formatCategory(v.category)} · {v.neighborhood}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {v.open ? <span className="open-dot" /> : <span className="closed-dot" />}
                        <span style={{ fontSize: '13px', color: v.open ? 'var(--success)' : 'var(--label-tertiary)' }}>
                          {v.open ? 'Open' : 'Closed'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Accommodation */}
        {filteredAccommodations.length > 0 && viewMode === 'list' && !showSavedOnly && (
          <div style={{ marginBottom: '24px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">Stay Awhile</span>
                <span className="section-title">Accommodation</span>
              </div>
              <Link href="/vendors" className="section-link">See All</Link>
            </div>
            <div style={{ display: 'flex', gap: '8px', padding: '0 0 12px' }}>
              {['All-Inclusive', 'À la carte', 'Villa'].map(type => (
                <button
                  key={type}
                  onClick={() => setAccommodationType(type)}
                  className={`chip ${accommodationType === type ? 'active' : ''}`}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="horizontal-scroll" style={{ padding: '4px 0 12px' }}>
              {filteredAccommodations.map(a => (
                <Link key={a.id} href={`/accommodation/${a.id}`} style={{ textDecoration: 'none', flexShrink: 0, width: '240px' }}>
                  <div className="card">
                    <div className="card-image" style={{ height: '160px' }}>
                      <img src={a.media?.[0]?.url || ''} alt={a.name} />
                    </div>
                    <div className="card-content">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                        <Icon name="star" size={14} style={{ color: 'var(--gold)' }} />
                        <span className="num-font" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>{a.googleStars}</span>
                      </div>
                      <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '2px' }}>{a.name}</p>
                      <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '4px' }}>{a.type}</p>
                      <p className="num-font" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--rum)' }}>
                        {a.priceRange}<span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--label-secondary)' }}> /night</span>
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All Vendors Preview - 5 cards */}
        <div>
          <div className="section-header">
            <div className="section-heading">
              <span className="section-title">All Vendors</span>
            </div>
            <Link href="/vendors" className="section-link">See All</Link>
          </div>
          {filteredVendors.length === 0 ? (
            <div className="empty-state">
              <Icon name="search" size={32} style={{ color: 'var(--label-tertiary)' }} />
              <p style={{ fontSize: '17px', fontWeight: 600 }}>{patois.emptySearch || "Nuttin nuh go suh"}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredVendors.slice(0, 5).map(v => (
                <Link key={v.id} href={`/vendor/${v.id}`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ display: 'flex', gap: '12px', padding: '12px' }}>
                    <div style={{ width: '100px', height: '100px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={v.images[0]} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '2px' }}>{v.name}</p>
                        <button
                          className="heart-btn"
                          onClick={(e) => { e.preventDefault(); toggleSaveVendor(v.id) }}
                          style={{ color: savedVendors.includes(v.id) ? 'var(--rum)' : 'var(--label-secondary)' }}
                        >
                          <Icon name="heart" size={18} className={savedVendors.includes(v.id) ? 'filled' : ''} />
                        </button>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '4px' }}>
                        {formatCategory(v.category)} · {v.neighborhood}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        {v.open ? (
                          <>
                            <span className="open-dot" />
                            <span style={{ fontSize: '13px', color: 'var(--success)' }}>Open</span>
                          </>
                        ) : (
                          <>
                            <span className="closed-dot" />
                            <span style={{ fontSize: '13px', color: 'var(--label-tertiary)' }}>Closed</span>
                          </>
                        )}
                        {v.live && (
                          <span style={{ fontSize: '13px', color: 'var(--live)', marginLeft: '4px' }}>
                            · {v.whoThere} here now
                          </span>
                        )}
                      </div>
                      {v.rating && (
                        <div className="rating-text">
                          ★ <span className="num-font">{v.rating}</span>
                          {v.reviewCount && <span> · <span className="num-font">{v.reviewCount}</span></span>}
                        </div>
                      )}
                      <p className="price-tier" style={{ marginTop: '4px' }}>{v.priceRange}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter Sheet */}
      <div className={`bottom-sheet-overlay ${showFilterSheet ? 'open' : ''}`} onClick={() => setShowFilterSheet(false)} />
      <div className={`bottom-sheet ${showFilterSheet ? 'open' : ''}`}>
        <div className="sheet-grabber" />
        <div style={{ padding: '0 20px 20px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '16px' }}>Filter & Sort</h3>
          
          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>Location</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {['NEGRIL', 'MONTEGO_BAY'].map(c => (
              <button
                key={c}
                onClick={() => handleCityChange(c as 'NEGRIL' | 'MONTEGO_BAY')}
                className={`chip ${city === c ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {c === 'NEGRIL' ? 'Negril' : 'Montego Bay'}
              </button>
            ))}
          </div>

          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>Sort By</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {SORT_OPTIONS.map(option => (
              <button
                key={option}
                onClick={() => handleSortChange(option)}
                className={`chip ${sortBy === option ? 'active' : ''}`}
              >
                {option}
              </button>
            ))}
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowFilterSheet(false)}>
            Done
          </button>
        </div>
      </div>

      <Dock />
    </main>
  )
}