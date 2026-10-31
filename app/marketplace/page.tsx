// app/marketplace/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import { usePatois } from '@/lib/i18n-client'
import BrandedRefresh from '@/components/BrandedRefresh'
import VendorCard from '@/components/VendorCard'
import { syncAlerts } from '@/lib/alerts-client'
import { ACCESSIBILITY_OPTIONS } from '@/lib/accessibility'
import { useLang } from '@/lib/i18n-client'
import { hapticSaved } from '@/lib/haptics'
import EventsSection from '@/components/EventsSection'
import Price from '@/components/Price'
import { useRegion } from '@/components/RegionProvider'
import ErrorState from '@/components/ErrorState'
import { moodCategories } from '@/lib/mood-profiles'
import { distanceFrom, sortByDistance, useUserLocation } from '@/lib/geo'
import { RegionPill } from '@/components/RegionSelector'
import { useLabels } from '@/lib/labels'
import SmartVideo from '@/components/SmartVideo'
import Img from '@/components/Img'

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
  accessibility?: string[]
  dishOfDay?: { name: string; price?: number | null; imageUrl?: string | null; videoUrl?: string | null; prepMinutes?: number | null } | null
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
  city: string
  nightlyPrice?: number | null
}

interface FlashDeal {
  id: string
  deal: string
  expires: string
  vendor: { id: string; name: string; city: string; images?: string[]; isPremium?: boolean; rating?: number; reviewCount?: number }
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

function formatCategory(category: string): string {
  return category.charAt(0) + category.slice(1).toLowerCase()
}

export default function MarketplacePage() {
  const patois = usePatois()
  const { t } = useLang()
  const labels = useLabels()
  const router = useRouter()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [accommodations, setAccommodations] = useState<Accommodation[]>([])
  const [flashDeals, setFlashDeals] = useState<FlashDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const { city, town, ready } = useRegion()
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('Recommended')
  const [savedVendors, setSavedVendors] = useState<string[]>([])
  const [accommodationType, setAccommodationType] = useState('All-Inclusive')
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  const [showSavedOnly, setShowSavedOnly] = useState(false)
  const [selectedAccess, setSelectedAccess] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const realLocation = useUserLocation()
  const { town: regionTown } = useRegion()
  const userLocation = realLocation ?? { lat: regionTown.lat, lng: regionTown.lng }
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => { if (ready) fetchData() }, [ready, city])

  useEffect(() => {
    const saved = localStorage.getItem('savedVendors')
    if (saved) setSavedVendors(JSON.parse(saved))
    const savedMood = localStorage.getItem('marketplaceMood')
    if (savedMood) setSelectedMood(savedMood)
    const savedSort = localStorage.getItem('marketplaceSort')
    if (savedSort) setSortBy(savedSort)
  }, [])

  const fetchData = async () => {
    try {
      setLoadFailed(false)
      const [vendorsRes, accomRes, flashDealsRes] = await Promise.all([
        fetch(`/api/vendors?city=${city}`),
        fetch(`/api/accommodations?city=${city}`),
        fetch(`/api/flashdeals?city=${city}`)
      ])

      if (!vendorsRes.ok) throw new Error('vendors')
      const vendorsData = await vendorsRes.json()
      const accomData = await accomRes.json()
      const flashDealsData = await flashDealsRes.json()

      setVendors(Array.isArray(vendorsData) ? vendorsData : [])
      setAccommodations(Array.isArray(accomData) ? accomData : [])
      setFlashDeals(Array.isArray(flashDealsData) ? flashDealsData : [])
      
    } catch (error) {
      console.error(error)
      setLoadFailed(true)
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
    syncAlerts()
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

  // Dish of the Day: whatever vendors in this region have set (Vendor.dishOfDay).
  const dishesOfDay = vendors.filter(v => v.city === city && v.dishOfDay?.name)
  const premiumVendors = vendors.filter(v => v.isPremium && v.city === city)
  const regionFlashDeals = flashDeals.filter(fd => fd.vendor.city === city)

  const filteredVendors = vendors
    .filter(v => !search || 
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.category.toLowerCase().includes(search.toLowerCase()) ||
      v.neighborhood.toLowerCase().includes(search.toLowerCase())
    )
    .filter(v => !city || v.city === city)
    .filter(v => !selectedMood || moodCategories(selectedMood).includes(v.category))
    .filter(v => !showSavedOnly || savedVendors.includes(v.id))
    .filter(v => selectedAccess.every(k => v.accessibility?.includes(k)))
    .sort((a, b) => {
      if (sortBy === 'Price') return (a.priceRange || '').localeCompare(b.priceRange || '')
      if (sortBy === 'Rating') return (b.rating || 0) - (a.rating || 0)
      return 0
    })

  // Distance: real distance from you (or the town centre until location is allowed); no coordinates → last.
  const sortedVendors = sortBy === 'Distance' ? sortByDistance(filteredVendors, userLocation) : filteredVendors

  const activeFilterCount = [selectedMood, showSavedOnly || null].filter(Boolean).length + selectedAccess.length

  const filteredAccommodations = accommodations.filter(a =>
    a.city === city && (!accommodationType || a.type === accommodationType)
  )

  if (loading) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)' }}>
        <div style={{ paddingTop: '16px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: '100px' }}>
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
          <RegionPill />
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
              placeholder={t('m.market.search')}
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
              position: 'relative',
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
            {activeFilterCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--rum)',
                border: '1.5px solid var(--system-bg)'
              }} />
            )}
          </button>
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
              {filteredVendors.filter(v => v.lat && v.lng).map(v => {
                return (
                  <Marker key={v.id} position={[v.lat!, v.lng!]}>
                    <Popup>
                      <div style={{ minWidth: '150px', background: '#1C1C1E', color: '#FFFFFF', padding: '8px', borderRadius: '8px' }}>
                        <p style={{ fontSize: '15px', fontWeight: 600 }}>{v.name}</p>
                        <p style={{ fontSize: '13px', color: '#A1A1A1' }}>{labels.category(v.category)} · {v.priceRange}</p>
                        <p style={{ fontSize: '13px', color: v.open ? '#34C759' : '#A1A1A1' }}>
                          {v.open ? t('m.common.open') : t('m.common.closed')}
                          {v.isPremium && ' · ★ B.O.N'}
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
                <span className="section-eyebrow">{t('m.market.todaysPick')}</span>
                <span className="section-title">{t('m.market.dishOfDay')}</span>
              </div>
            </div>
            <div className="horizontal-scroll" style={{ padding: '4px 0 12px' }}>
              {dishesOfDay.map(v => {
                const dish = v.dishOfDay!
                const image = dish.imageUrl || v.images[0] || ''
                return (
                  <Link key={v.id} href={`/vendor/${v.id}`} style={{ textDecoration: 'none', flexShrink: 0, width: dishesOfDay.length > 1 ? '85%' : '100%' }}>
                    <div className="card" style={{ position: 'relative', height: '200px' }}>
                      {dish.videoUrl ? (
                        <div style={{ position: 'absolute', inset: 0 }}><SmartVideo src={dish.videoUrl} poster={image} alt={dish.name} /></div>
                      ) : image ? (
                        <Img src={image} alt={dish.name} width={800} height={600} style={{ position: 'absolute', inset: 0 }} />
                      ) : null}
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.8))' }} />
                      <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '16px', color: 'white' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', color: 'rgba(255,255,255,0.75)' }}>{v.name}</p>
                        <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>{dish.name}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {dish.price != null && <Price usd={dish.price} style={{ fontSize: '17px', fontWeight: 700, color: '#FFB4A3' }} />}
                          {dish.prepMinutes ? <span className="num-font" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>{dish.prepMinutes} min</span> : null}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Flash Deals */}
        {/* This Week's Events */}
        {viewMode === 'list' && !showSavedOnly && <EventsSection padded={false} />}

        {regionFlashDeals.length > 0 && viewMode === 'list' && (
          <div style={{ marginBottom: '24px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">{t('m.market.limited')}</span>
                <span className="section-title">{t('m.market.flashDeals')}</span>
              </div>
            </div>
            <div className="horizontal-scroll" style={{ padding: '4px 0 12px' }}>
              {regionFlashDeals.map(fd => (
                <Link key={fd.id} href={`/vendor/${fd.vendor.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                  <div className="card" style={{ width: '200px' }}>
                    <div className="card-image" style={{ height: '110px' }}>
                      {fd.vendor.images?.[0] && <Img src={fd.vendor.images[0]} alt={fd.vendor.name} width={600} height={400} sizes="80vw" />}
                      <div className="card-overlay" />
                    </div>
                    <div className="card-content">
                      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rum-text)' }}>{fd.vendor.name}</p>
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

        {/* B.O.N Members */}
        {premiumVendors.length > 0 && viewMode === 'list' && !showSavedOnly && (
          <div style={{ marginBottom: '24px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-title">{t('m.bon.members')}</span>
              </div>
              <Link href="/vendors?premium=true" className="section-link">{t('m.common.seeAll')}</Link>
            </div>
            <div className="horizontal-scroll" style={{ padding: '4px 0 12px' }}>
              {premiumVendors.map(v => (
                <div key={v.id} style={{ flexShrink: 0, width: '180px' }}>
                  <VendorCard vendor={v} variant="tile" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accommodation */}
        {filteredAccommodations.length > 0 && viewMode === 'list' && !showSavedOnly && (
          <div style={{ marginBottom: '24px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">{t('m.market.stayAwhile')}</span>
                <span className="section-title">{t('m.market.accommodation')}</span>
              </div>
              <Link href="/vendors" className="section-link">{t('m.common.seeAll')}</Link>
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
                <Link key={a.id} href={`/accommodations/${a.id}`} style={{ textDecoration: 'none', flexShrink: 0, width: '240px' }}>
                  <div className="card">
                    <div className="card-image" style={{ height: '160px' }}>
                      {a.media?.[0]?.url && <Img src={a.media[0].url} alt={a.name} width={600} height={400} sizes="80vw" />}
                    </div>
                    <div className="card-content">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                        <Icon name="star" size={14} style={{ color: 'var(--gold)' }} />
                        <span className="num-font" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>{a.googleStars}</span>
                      </div>
                      <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '2px' }}>{a.name}</p>
                      <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '4px' }}>{a.type}</p>
                      <p className="num-font" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--rum-text)' }}>
                        {a.nightlyPrice != null ? <Price usd={a.nightlyPrice} /> : a.priceRange}
                        <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--label-secondary)' }}> {t('m.common.perNightShort')}</span>
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
              <span className="section-title">{t('m.market.allVendors')}</span>
            </div>
            <Link href="/vendors" className="section-link">{t('m.common.seeAll')}</Link>
          </div>
          {loadFailed ? (
            <ErrorState onRetry={handleRefresh} />
          ) : sortedVendors.length === 0 ? (
            <div className="empty-state">
              <Icon name="search" size={32} style={{ color: 'var(--label-tertiary)' }} />
              {vendors.some(v => v.city === city) ? (
                <p style={{ fontSize: '17px', fontWeight: 600 }}>{patois.emptySearch}</p>
              ) : (
                <>
                  <p style={{ fontSize: '17px', fontWeight: 600 }}>{t('m.region.emptyTitle', { town: town.name })}</p>
                  <p>{t('m.region.emptyBody')}</p>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sortedVendors.slice(0, 5).map(v => (
                <VendorCard
                  key={v.id}
                  vendor={v}
                  distanceKm={distanceFrom(realLocation, v)}
                  saved={savedVendors.includes(v.id)}
                  onToggleSave={() => toggleSaveVendor(v.id)}
                />
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
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '16px' }}>{t('m.market.filterTitle')}</h3>

          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.market.moodCategory')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {MOOD_NAMES.map(mood => (
              <button
                key={mood}
                onClick={() => handleMoodChange(selectedMood === mood ? null : mood)}
                className={`chip ${selectedMood === mood ? 'active' : ''}`}
              >
                <Icon name={MOOD_ICONS[mood] as any} size={14} />
                {mood}
              </button>
            ))}
          </div>

          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.market.show')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            <button
              onClick={() => setShowSavedOnly(!showSavedOnly)}
              className={`chip ${showSavedOnly ? 'active' : ''}`}
            >
              <Icon name="heart" size={14} className={showSavedOnly ? 'filled' : ''} />
              {t('m.market.savedOnly')}
            </button>
          </div>

          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '4px' }}>{t('m.market.accessibility')}</p>
          <p style={{ fontSize: '12px', color: 'var(--label-tertiary)', marginBottom: '8px' }}>{t('m.market.accessNote')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {ACCESSIBILITY_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSelectedAccess(prev => prev.includes(opt.key) ? prev.filter(k => k !== opt.key) : [...prev, opt.key])}
                className={`chip ${selectedAccess.includes(opt.key) ? 'active' : ''}`}
                aria-pressed={selectedAccess.includes(opt.key)}
              >
                {labels.access(opt.key)}
              </button>
            ))}
          </div>

          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.market.sortBy')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {SORT_OPTIONS.map(option => (
              <button
                key={t(`m.sort.${option}` as 'm.sort.Price')}
                onClick={() => handleSortChange(option)}
                className={`chip ${sortBy === option ? 'active' : ''}`}
              >
                {option}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {activeFilterCount > 0 && (
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => {
                  handleMoodChange(null)
                  setShowSavedOnly(false)
                  setSelectedAccess([])
                }}
              >
                {t('m.common.clearAll')}
              </button>
            )}
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowFilterSheet(false)}>
              {t('m.common.done')}
            </button>
          </div>
        </div>
      </div>


      <Dock />
    </main>
  )
}