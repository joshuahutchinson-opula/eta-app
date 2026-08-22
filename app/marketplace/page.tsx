// app/marketplace/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import { patois } from '@/lib/patois'

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

const CATEGORIES = [
  { name: 'Food', icon: 'food' },
  { name: 'Drinks', icon: 'drink' },
  { name: 'Activities', icon: 'activity' },
  { name: 'Wellness', icon: 'wellness' },
  { name: 'Beach', icon: 'sun' },
  { name: 'Transport', icon: 'compass' }
]

const SORT_OPTIONS = ['Recommended', 'Price', 'Rating', 'Distance']

export default function MarketplacePage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [accommodations, setAccommodations] = useState<Accommodation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState<'NEGRIL' | 'MONTEGO_BAY'>('NEGRIL')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('Recommended')
  const [savedVendors, setSavedVendors] = useState<string[]>([])
  const [accommodationType, setAccommodationType] = useState('All-Inclusive')
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  const [dishesOfDay, setDishesOfDay] = useState<Array<{ id: string; vendorId: string; vendorName: string; dish: string; price: number; eta: string; imageUrl: string }>>([])

  useEffect(() => {
    fetchData()
    const saved = localStorage.getItem('savedVendors')
    if (saved) setSavedVendors(JSON.parse(saved))
  }, [])

  const fetchData = async () => {
    try {
      const [vendorsRes, accomRes] = await Promise.all([
        fetch('/api/vendors'),
        fetch('/api/accommodations')
      ])

      const vendorsData = await vendorsRes.json()
      const accomData = await accomRes.json()

      setVendors(Array.isArray(vendorsData) ? vendorsData : [])
      setAccommodations(Array.isArray(accomData) ? accomData : [])
      
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

  const toggleSaveVendor = (vendorId: string) => {
    const newSaved = savedVendors.includes(vendorId)
      ? savedVendors.filter(id => id !== vendorId)
      : [...savedVendors, vendorId]
    setSavedVendors(newSaved)
    localStorage.setItem('savedVendors', JSON.stringify(newSaved))
  }

  const premiumVendors = vendors.filter(v => v.isPremium)

  const filteredVendors = vendors
    .filter(v => !search || 
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.category.toLowerCase().includes(search.toLowerCase()) ||
      v.neighborhood.toLowerCase().includes(search.toLowerCase())
    )
    .filter(v => !city || v.city === city)
    .filter(v => !selectedCategory || v.category === selectedCategory.toUpperCase())
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
      <main style={{ minHeight: '100vh', background: 'var(--off-white)', overflowX: 'hidden' }}>
        <TopBar />
        <div style={{ padding: '16px', paddingBottom: '100px' }}>
          <div className="skeleton" style={{ height: '44px', borderRadius: '12px', marginBottom: '24px' }} />
          <div className="skeleton" style={{ height: '200px', borderRadius: '12px', marginBottom: '32px' }} />
          <div className="grid-2">
            {[...Array(6)].map((_, i) => (
              <div key={i}>
                <div className="skeleton" style={{ height: '140px', borderRadius: '12px', marginBottom: '8px' }} />
                <div className="skeleton" style={{ height: '16px', width: '80%', marginBottom: '4px' }} />
                <div className="skeleton" style={{ height: '12px', width: '60%' }} />
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
      <TopBar />

      <div style={{ padding: '16px' }}>
        {/* Search bar */}
        <div className="card" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          padding: '10px 14px',
          marginBottom: '24px',
          position: 'sticky',
          top: '52px',
          zIndex: 30
        }}>
          <Icon name="search" size={16} style={{ color: 'var(--grey)' }} />
          <input
            type="text"
            placeholder="Search vendors, food, drinks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--black)', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }}
          />
          <span onClick={() => setShowFilterSheet(true)} style={{ cursor: 'pointer' }}>
            <Icon name="filter" size={16} style={{ color: 'var(--grey)' }} />
          </span>
        </div>

        {/* Dish Of The Day */}
        {dishesOfDay.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">Today&apos;s Pick</span>
                <span className="section-title">Dish Of The Day</span>
              </div>
            </div>
            <Link href={`/vendor/${dishesOfDay[0].vendorId}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ position: 'relative', height: '200px' }}>
                <img src={dishesOfDay[0].imageUrl} alt={dishesOfDay[0].dish} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.8))' }} />
                <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '16px', color: 'white' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', color: 'rgba(255,255,255,0.7)' }}>
                    {dishesOfDay[0].vendorName}
                  </p>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>{dishesOfDay[0].dish}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="price-font" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--rum)' }}>
                      ${dishesOfDay[0].price}
                    </span>
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                      ETA: {dishesOfDay[0].eta}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Premium Members */}
        {premiumVendors.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">Top Tier</span>
                <span className="section-title">Premium Members</span>
              </div>
              <span className="section-link">See all</span>
            </div>
            <div className="section-content-card">
              <div className="horizontal-scroll" style={{ padding: '0' }}>
                {premiumVendors.map(v => (
                  <Link key={v.id} href={`/vendor/${v.id}`} style={{ textDecoration: 'none', flexShrink: 0, width: '180px' }}>
                    <div className="card">
                      <div className="card-image" style={{ height: '120px' }}>
                        <img src={v.images[0]} alt={v.name} />
                        {v.live && (
                          <div className="card-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="live-dot" />
                            {v.whoThere} here
                          </div>
                        )}
                      </div>
                      <div className="card-content">
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--black)' }}>{v.name}</p>
                        <p style={{ fontSize: '11px', color: 'var(--grey)' }}>{v.category} • {v.neighborhood}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Accommodation */}
        {filteredAccommodations.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">Stay Awhile</span>
                <span className="section-title">Accommodation</span>
              </div>
              <span className="section-link">See all</span>
            </div>
            <div className="segmented-control" style={{ marginBottom: '12px', marginLeft: '16px', marginRight: '16px' }}>
              {['All-Inclusive', 'À la carte', 'Villa'].map(type => (
                <button
                  key={type}
                  className={`segmented-item ${accommodationType === type ? 'active' : ''}`}
                  onClick={() => setAccommodationType(type)}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    border: 'none',
                    fontFamily: 'inherit',
                    background: accommodationType === type ? 'var(--rum)' : 'var(--light-grey)',
                    color: accommodationType === type ? 'white' : 'var(--grey)'
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="section-content-card">
              <div className="horizontal-scroll" style={{ padding: '0' }}>
                {filteredAccommodations.map(a => (
                  <Link key={a.id} href={`/accommodation/${a.id}`} style={{ textDecoration: 'none', flexShrink: 0, width: '220px' }}>
                    <div className="card">
                      <div className="card-image" style={{ height: '120px' }}>
                        <img src={a.media?.[0]?.url || ''} alt={a.name} />
                      </div>
                      <div className="card-content">
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--black)' }}>{a.name}</p>
                        <p style={{ fontSize: '11px', color: 'var(--grey)' }}>★ {a.googleStars} • {a.type}</p>
                        <p className="card-price" style={{ marginTop: '4px' }}>{a.priceRange}/night</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* All Vendors */}
        <div>
          <div className="section-header">
            <div className="section-heading">
              <span className="section-eyebrow">Full Listings</span>
              <span className="section-title">All Vendors</span>
            </div>
            <span className="section-link">See all</span>
          </div>
          {filteredVendors.length === 0 ? (
            <div className="empty-state">
              <Icon name="search" size={32} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: '16px', fontWeight: 600 }}>{patois.emptySearch || "Nuttin nuh go suh"}</p>
              <p style={{ fontSize: '13px' }}>Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="section-content-card">
              <div className="grid-2" style={{ gap: '8px' }}>
                {filteredVendors.map(v => (
                  <div key={v.id} style={{ position: 'relative' }}>
                    <Link href={`/vendor/${v.id}`} style={{ textDecoration: 'none' }}>
                      <div className="card">
                        <div className="card-image" style={{ height: '120px' }}>
                          <img src={v.images[0]} alt={v.name} />
                          {v.live && (
                            <div className="card-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span className="live-dot" />
                              {v.whoThere} here
                            </div>
                          )}
                        </div>
                        <div className="card-content">
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--black)' }}>{v.name}</p>
                              <p style={{ fontSize: '11px', color: 'var(--grey)' }}>{v.category} • {v.neighborhood}</p>
                              {v.rating && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--black)' }}>★ {v.rating}</span>
                                  {v.reviewCount && <span style={{ fontSize: '10px', color: 'var(--grey)' }}>({v.reviewCount})</span>}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={(e) => { e.preventDefault(); toggleSaveVendor(v.id) }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: savedVendors.includes(v.id) ? 'var(--rum)' : 'var(--grey)' }}
                            >
                              <Icon name="heart" size={16} className={savedVendors.includes(v.id) ? 'filled' : ''} />
                            </button>
                          </div>
                          <p className="card-price" style={{ marginTop: '8px' }}>{v.priceRange}</p>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter Sheet */}
      <div className={`bottom-sheet-overlay ${showFilterSheet ? 'open' : ''}`} onClick={() => setShowFilterSheet(false)} />
      <div className={`bottom-sheet ${showFilterSheet ? 'open' : ''}`}>
        <div style={{ padding: '20px' }}>
          <div style={{ width: '36px', height: '4px', background: 'var(--light-grey)', borderRadius: '2px', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>Filter & Sort</h3>
          
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--grey)', marginBottom: '8px' }}>Location</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {['NEGRIL', 'MONTEGO_BAY'].map(c => (
              <button
                key={c}
                onClick={() => setCity(c as 'NEGRIL' | 'MONTEGO_BAY')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  fontFamily: 'inherit',
                  background: city === c ? 'var(--rum)' : 'var(--light-grey)',
                  color: city === c ? 'white' : 'var(--grey)'
                }}
              >
                {c === 'NEGRIL' ? 'Negril' : 'Montego Bay'}
              </button>
            ))}
          </div>

          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--grey)', marginBottom: '8px' }}>Categories</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                className={`chip ${selectedCategory === cat.name ? 'active' : ''}`}
              >
                <Icon name={cat.icon as any} size={12} />
                {cat.name}
              </button>
            ))}
          </div>

          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--grey)', marginBottom: '8px' }}>Sort By</p>
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

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowFilterSheet(false)}>
            Done
          </button>
        </div>
      </div>

      <Dock />
    </main>
  )
}