// app/vendors/page.tsx
'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import LongPressCard from '@/components/LongPressCard'
import { hapticSaved } from '@/lib/haptics'

interface Vendor {
  id: string
  name: string
  category: string
  neighborhood: string
  city: string
  priceRange: string
  description: string
  images: string[]
  open: boolean
  live: boolean
  isPremium: boolean
  whoThere: number
  rating?: number
  reviewCount?: number
  lat: number
  lng: number
}

const CATEGORIES = [
  { name: 'Food', icon: 'food' },
  { name: 'Drinks', icon: 'glass' },
  { name: 'Activities', icon: 'party' },
  { name: 'Wellness', icon: 'spa' },
  { name: 'Beach', icon: 'wave' }
]

const CITIES: Array<{ value: 'NEGRIL' | 'MONTEGO_BAY'; label: string }> = [
  { value: 'NEGRIL', label: 'Negril' },
  { value: 'MONTEGO_BAY', label: 'Montego Bay' }
]

const PRICE_TIERS = ['$', '$$', '$$$', '$$$$']

const SORT_OPTIONS = ['Recommended', 'Price', 'Rating', 'Distance']

const DEFAULT_LOCATION = { lat: 18.2723, lng: -78.3521 }

function formatCategory(category: string): string {
  return category.charAt(0) + category.slice(1).toLowerCase()
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function VendorsPage() {
  return (
    <Suspense fallback={null}>
      <VendorsContent />
    </Suspense>
  )
}

function VendorsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState<'NEGRIL' | 'MONTEGO_BAY' | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedPriceTier, setSelectedPriceTier] = useState<string | null>(null)
  const [premiumOnly, setPremiumOnly] = useState(false)
  const [sortBy, setSortBy] = useState('Recommended')
  const [savedVendors, setSavedVendors] = useState<string[]>([])
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  const [userLocation, setUserLocation] = useState(DEFAULT_LOCATION)

  useEffect(() => {
    fetchVendors()

    const saved = localStorage.getItem('savedVendors')
    if (saved) setSavedVendors(JSON.parse(saved))

    const categoryParam = searchParams.get('category')
    if (categoryParam) setSelectedCategory(categoryParam)

    const cityParam = searchParams.get('city')
    if (cityParam === 'NEGRIL' || cityParam === 'MONTEGO_BAY') setCity(cityParam)

    if (searchParams.get('premium') === 'true') setPremiumOnly(true)

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocation(DEFAULT_LOCATION)
      )
    }
  }, [])

  const fetchVendors = async () => {
    try {
      const res = await fetch('/api/vendors')
      const data = await res.json()
      setVendors(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSaveVendor = (vendorId: string) => {
    hapticSaved()
    const newSaved = savedVendors.includes(vendorId)
      ? savedVendors.filter(id => id !== vendorId)
      : [...savedVendors, vendorId]
    setSavedVendors(newSaved)
    localStorage.setItem('savedVendors', JSON.stringify(newSaved))
  }

  const filteredVendors = vendors
    .filter(v => !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.category.toLowerCase().includes(search.toLowerCase()) ||
      v.neighborhood.toLowerCase().includes(search.toLowerCase())
    )
    .filter(v => !city || v.city === city)
    .filter(v => !selectedCategory || v.category === selectedCategory.toUpperCase())
    .filter(v => !selectedPriceTier || v.priceRange === selectedPriceTier)
    .filter(v => !premiumOnly || v.isPremium)
    .sort((a, b) => {
      if (sortBy === 'Price') return (a.priceRange || '').length - (b.priceRange || '').length
      if (sortBy === 'Rating') return (b.rating || 0) - (a.rating || 0)
      if (sortBy === 'Distance') {
        return distanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng) -
          distanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng)
      }
      return 0
    })

  const activeFilterCount = [selectedCategory, city, selectedPriceTier, premiumOnly || null].filter(Boolean).length

  if (loading) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)' }}>
        <div style={{ paddingTop: '16px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: '100px' }}>
          <div className="skeleton-card" style={{ height: '44px', marginBottom: '24px' }}>
            <div className="skeleton-image" style={{ height: '100%' }} />
          </div>
          <div className="grid-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton-card" style={{ height: '200px' }}>
                <div className="skeleton-image" style={{ height: '100%' }} />
              </div>
            ))}
          </div>
        </div>
        <Dock />
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <div style={{ padding: '16px' }}>
        {/* Search + filter */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginBottom: '12px'
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
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', color: 'var(--label-primary)', fontSize: '17px', outline: 'none', fontFamily: 'inherit' }}
            />
          </div>
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

        {/* Count */}
        <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '12px' }}>
          <span className="num-font">{filteredVendors.length}</span> vendors
          {city && ` in ${city === 'NEGRIL' ? 'Negril' : 'Montego Bay'}`}
        </p>

        {/* Vendor grid - flat iOS-style cards, 2 columns */}
        {filteredVendors.length === 0 ? (
          <div className="empty-state">
            <Icon name="search" size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p style={{ fontSize: '17px', fontWeight: 600 }}>Nuttin nuh go suh</p>
            <p>Try a different search or filter</p>
          </div>
        ) : (
          <div className="grid-2">
            {filteredVendors.map(v => (
              <LongPressCard
                key={v.id}
                onPress={() => router.push(`/vendor/${v.id}`)}
                preview={
                  <div>
                    <img src={v.images[0]} alt={v.name} style={{ width: '100%', height: '60px', objectFit: 'cover', borderRadius: '8px', marginBottom: '6px' }} />
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-primary)' }}>{v.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--label-secondary)' }}>{formatCategory(v.category)} · {v.neighborhood}</p>
                  </div>
                }
              >
                <Link href={`/vendor/${v.id}`} style={{ textDecoration: 'none' }}>
                  <div className="card">
                    <div className="card-image" style={{ height: '120px' }}>
                      <img src={v.images[0]} alt={v.name} />
                      {v.isPremium && (
                        <div className="card-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Icon name="crown" size={11} />
                          Premium
                        </div>
                      )}
                      <button
                        className="heart-btn"
                        onClick={(e) => { e.preventDefault(); toggleSaveVendor(v.id) }}
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          width: '32px',
                          height: '32px',
                          color: savedVendors.includes(v.id) ? 'var(--rum)' : 'var(--label-secondary)'
                        }}
                      >
                        <Icon name="heart" size={15} className={savedVendors.includes(v.id) ? 'filled' : ''} />
                      </button>
                      {v.live && (
                        <div style={{ position: 'absolute', bottom: '6px', left: '6px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px' }}>
                          <span className="live-dot" />
                          <span className="num-font">{v.whoThere}</span> here
                        </div>
                      )}
                    </div>
                    <div className="card-content">
                      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '2px', lineHeight: 1.2 }}>{v.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--label-secondary)', marginBottom: '4px' }}>
                        {formatCategory(v.category)} · {v.neighborhood}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {v.open ? (
                          <span style={{ fontSize: '11px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="open-dot" /> Open
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--label-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="closed-dot" /> Closed
                          </span>
                        )}
                      </div>
                      {v.rating && (
                        <div className="rating-text" style={{ marginTop: '2px' }}>
                          ★ <span className="num-font">{v.rating}</span>
                          {v.reviewCount && <span> · <span className="num-font">{v.reviewCount}</span></span>}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </LongPressCard>
            ))}
          </div>
        )}
      </div>

      {/* Filter Sheet */}
      <div className={`bottom-sheet-overlay ${showFilterSheet ? 'open' : ''}`} onClick={() => setShowFilterSheet(false)} />
      <div className={`bottom-sheet ${showFilterSheet ? 'open' : ''}`}>
        <div className="sheet-grabber" />
        <div style={{ padding: '0 20px 20px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '16px' }}>Filter & Sort</h3>

          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>Category</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                className={`chip ${selectedCategory === cat.name ? 'active' : ''}`}
              >
                <Icon name={cat.icon as any} size={14} />
                {cat.name}
              </button>
            ))}
          </div>

          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>Destination</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {CITIES.map(c => (
              <button
                key={c.value}
                onClick={() => setCity(city === c.value ? null : c.value)}
                className={`chip ${city === c.value ? 'active' : ''}`}
              >
                <Icon name="mapPin" size={14} />
                {c.label}
              </button>
            ))}
          </div>

          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>Price</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {PRICE_TIERS.map(tier => (
              <button
                key={tier}
                onClick={() => setSelectedPriceTier(selectedPriceTier === tier ? null : tier)}
                className={`chip ${selectedPriceTier === tier ? 'active' : ''}`}
              >
                <span className="num-font">{tier}</span>
              </button>
            ))}
          </div>

          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>Sort By</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {SORT_OPTIONS.map(option => (
              <button
                key={option}
                onClick={() => setSortBy(option)}
                className={`chip ${sortBy === option ? 'active' : ''}`}
              >
                {option}
              </button>
            ))}
          </div>

          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>Show</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            <button
              onClick={() => setPremiumOnly(!premiumOnly)}
              className={`chip ${premiumOnly ? 'active' : ''}`}
            >
              <Icon name="crown" size={14} />
              Premium only
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {activeFilterCount > 0 && (
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => {
                  setSelectedCategory(null)
                  setCity(null)
                  setSelectedPriceTier(null)
                  setPremiumOnly(false)
                }}
              >
                Clear all
              </button>
            )}
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowFilterSheet(false)}>
              Done
            </button>
          </div>
        </div>
      </div>

      <Dock />
    </main>
  )
}
