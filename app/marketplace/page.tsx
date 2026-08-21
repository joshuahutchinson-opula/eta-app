// app/marketplace/page.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
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

// Category quick filters (requirement 16)
const CATEGORIES = [
  { name: 'Food', icon: 'food' },
  { name: 'Drinks', icon: 'drink' },
  { name: 'Activities', icon: 'activity' },
  { name: 'Wellness', icon: 'wellness' },
  { name: 'Beach', icon: 'sun' },
  { name: 'Transport', icon: 'compass' }
]

// Sort options (requirement 24)
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
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [accommodationType, setAccommodationType] = useState('All-Inclusive')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [dishesOfDay, setDishesOfDay] = useState<Array<{ id: string; vendorId: string; vendorName: string; dish: string; price: number; eta: string; imageUrl: string }>>([])

  useEffect(() => {
    fetchData()
    // Load saved vendors from localStorage
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
      
      // Generate mock dishes of the day from food vendors (requirement 17)
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

  const shuffleVendors = () => {
    const shuffled = [...vendors].sort(() => Math.random() - 0.5)
    setVendors(shuffled)
  }

  const premiumVendors = vendors.filter(v => v.isPremium)
  const standardVendors = vendors.filter(v => !v.isPremium)

  // Apply filters (requirement 13, 14, 16, 20, 24)
  const filteredVendors = vendors
    .filter(v => v.city === city || !city)
    .filter(v => !selectedCategory || v.category === selectedCategory.toUpperCase())
    .filter(v => !search || 
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.category.toLowerCase().includes(search.toLowerCase()) ||
      v.neighborhood.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'Price') return (a.priceRange || '').localeCompare(b.priceRange || '')
      if (sortBy === 'Rating') return (b.rating || 0) - (a.rating || 0)
      if (sortBy === 'Distance') return (a.neighborhood || '').localeCompare(b.neighborhood || '')
      return 0 // Recommended
    })

  const filteredAccommodations = accommodations.filter(a => 
    !accommodationType || a.type === accommodationType
  )

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--off-white)' }}>
        <TopBar />
        <div style={{ padding: '16px', paddingBottom: '100px' }}>
          {/* Skeleton loading in 2-column grid (requirement 28) */}
          <div className="skeleton" style={{ height: '44px', borderRadius: '10px', marginBottom: '16px' }} />
          <div className="skeleton" style={{ height: '36px', borderRadius: '10px', marginBottom: '20px' }} />
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto' }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0 }} />
            ))}
          </div>
          <div className="grid-2">
            {[...Array(6)].map((_, i) => (
              <div key={i}>
                <div className="skeleton" style={{ height: '160px', borderRadius: '12px', marginBottom: '8px' }} />
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
    <main style={{ minHeight: '100vh', background: 'var(--off-white)', paddingBottom: '80px' }}>
      <TopBar />

      <div style={{ padding: '16px' }}>
        {/* Search bar - sticky (requirement 13) */}
        <div className="search-bar sticky" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          marginBottom: '12px',
          position: 'sticky',
          top: '60px',
          zIndex: 30
        }}>
          <Icon name="search" size={18} />
          <input
            type="text"
            placeholder="Search vendors, food, drinks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              flex: 1, 
              background: 'none', 
              border: 'none', 
              color: 'var(--black)', 
              fontSize: '15px', 
              outline: 'none', 
              fontFamily: 'inherit' 
            }}
          />
          <Icon name="filter" size={18} style={{ cursor: 'pointer' }} />
        </div>

        {/* City toggle - segmented control (requirement 14) */}
        <div className="segmented-control" style={{ marginBottom: '16px' }}>
          {['NEGRIL', 'MONTEGO_BAY'].map(c => (
            <button
              key={c}
              className={`segmented-item ${city === c ? 'active' : ''}`}
              onClick={() => setCity(c as 'NEGRIL' | 'MONTEGO_BAY')}
            >
              {c === 'NEGRIL' ? 'Negril' : 'Montego Bay'}
            </button>
          ))}
        </div>

        {/* Shuffle button (requirement 15) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button 
            className="chip"
            onClick={shuffleVendors}
            style={{ 
              background: 'var(--card-bg)',
              boxShadow: 'var(--card-shadow)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Icon name="shuffle" size={14} />
            Shuffle
          </button>
        </div>

        {/* Category quick filters - circular icon chips (requirement 16) */}
        <div className="horizontal-scroll" style={{ marginBottom: '20px' }}>
          {CATEGORIES.map(cat => (
            <div 
              key={cat.name}
              className={`category-chip ${selectedCategory === cat.name ? 'active' : ''}`}
              onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
            >
              <div className="category-chip-icon">
                <Icon name={cat.icon as any} size={20} />
              </div>
              <span className="category-chip-label">{cat.name}</span>
            </div>
          ))}
        </div>

        {/* Sort options (requirement 24) */}
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          <button
            className="chip"
            onClick={() => setShowSortMenu(!showSortMenu)}
            style={{ 
              background: 'var(--card-bg)',
              boxShadow: 'var(--card-shadow)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Sort: {sortBy}
            <Icon name="chevronDown" size={14} />
          </button>
          {showSortMenu && (
            <div className="card" style={{ 
              position: 'absolute', 
              top: '40px', 
              left: 0, 
              zIndex: 40,
              minWidth: '150px',
              padding: '8px'
            }}>
              {SORT_OPTIONS.map(option => (
                <button
                  key={option}
                  onClick={() => {
                    setSortBy(option)
                    setShowSortMenu(false)
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: sortBy === option ? 'var(--light-grey)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--black)',
                    fontFamily: 'inherit'
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dish Of The Day (requirement 17) */}
        {dishesOfDay.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div className="section-header">
              <span className="section-title">Dish Of The Day</span>
            </div>
            <Link href={`/vendor/${dishesOfDay[0].vendorId}`} style={{ textDecoration: 'none' }}>
              <div className="featured-card" style={{ 
                position: 'relative',
                height: '200px',
                overflow: 'hidden'
              }}>
                <img 
                  src={dishesOfDay[0].imageUrl} 
                  alt={dishesOfDay[0].dish}
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    position: 'absolute',
                    inset: 0
                  }}
                />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.8))'
                }} />
                <div style={{ 
                  position: 'absolute', 
                  bottom: '0', 
                  left: '0', 
                  right: '0',
                  padding: '16px',
                  color: 'white'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    marginBottom: '8px'
                  }}>
                    <Icon name="flame" size={16} style={{ color: 'var(--rum)' }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Dish of the Day
                    </span>
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '2px' }}>
                    {dishesOfDay[0].vendorName}
                  </h3>
                  <p style={{ fontSize: '14px', marginBottom: '4px' }}>
                    {dishesOfDay[0].dish}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="price-font" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gold)' }}>
                      ${dishesOfDay[0].price}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--sea)' }}>
                      ETA: {dishesOfDay[0].eta}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Premium Members section (requirement 18) */}
        {premiumVendors.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div className="section-header">
              <span className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="crown" size={18} style={{ color: 'var(--gold)' }} />
                Premium Members
              </span>
              <span className="section-link">See all</span>
            </div>
            <div className="horizontal-scroll">
              {premiumVendors.map(v => (
                <Link 
                  key={v.id} 
                  href={`/vendor/${v.id}`} 
                  style={{ textDecoration: 'none', flexShrink: 0, width: '200px' }}
                >
                  <div className="featured-card" style={{ position: 'relative' }}>
                    <div style={{ height: '140px', overflow: 'hidden', position: 'relative' }}>
                      <img 
                        src={v.images[0]} 
                        alt={v.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div className="premium-badge premium-pulse" style={{ 
                        position: 'absolute', 
                        top: '8px', 
                        left: '8px',
                        zIndex: 2
                      }}>
                        <Icon name="crown" size={10} />
                        PREMIUM
                      </div>
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
                    <div style={{ padding: '12px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--black)' }}>{v.name}</h4>
                      <p style={{ fontSize: '11px', color: 'var(--grey)' }}>{v.category} • {v.neighborhood}</p>
                      {/* Avatar stack (requirement 18) */}
                      <div className="avatar-stack" style={{ marginTop: '8px' }}>
                        {[...Array(Math.min(3, v.whoThere))].map((_, i) => (
                          <img 
                            key={i}
                            src={`https://i.pravatar.cc/24?img=${i + 1}`} 
                            alt={`Person ${i + 1}`}
                          />
                        ))}
                        <span style={{ fontSize: '10px', color: 'var(--grey)', marginLeft: '4px' }}>
                          +{v.whoThere} here
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Accommodation section (requirement 21) */}
        {filteredAccommodations.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div className="section-header">
              <span className="section-title">Accommodation</span>
              <span className="section-link">See all</span>
            </div>
            {/* Accommodation type toggle */}
            <div className="segmented-control" style={{ marginBottom: '12px' }}>
              {['All-Inclusive', 'À la carte', 'Villa'].map(type => (
                <button
                  key={type}
                  className={`segmented-item ${accommodationType === type ? 'active' : ''}`}
                  onClick={() => setAccommodationType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="horizontal-scroll">
              {filteredAccommodations.map(a => (
                <Link 
                  key={a.id} 
                  href={`/accommodation/${a.id}`} 
                  style={{ textDecoration: 'none', flexShrink: 0, width: '240px' }}
                >
                  <div className="card">
                    <div className="card-image" style={{ height: '140px' }}>
                      <img src={a.media?.[0]?.url || ''} alt={a.name} />
                      {a.vetted && (
                        <div className="card-badge" style={{ 
                          background: 'var(--sea)', 
                          color: '#0F0E0C',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Icon name="check" size={10} />
                          VETTED
                        </div>
                      )}
                    </div>
                    <div className="card-content">
                      <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--black)' }}>{a.name}</h4>
                      <p style={{ fontSize: '11px', color: 'var(--grey)' }}>
                        ★ {a.googleStars} • {a.type}
                      </p>
                      <p className="card-price" style={{ marginTop: '4px' }}>
                        {a.priceRange}/night
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All Vendors grid (requirement 19, 22, 25, 26) */}
        <div>
          <div className="section-header">
            <span className="section-title">All Vendors</span>
            <span className="section-link">See all</span>
          </div>
          {filteredVendors.length === 0 ? (
            <div className="empty-state">
              <Icon name="search" size={32} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: '16px', fontWeight: 600 }}>
                {patois.emptySearch || "Nuttin nuh go suh"}
              </p>
              <p style={{ fontSize: '13px' }}>
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <div className="grid-2">
              {filteredVendors.map(v => (
                <div key={v.id} style={{ position: 'relative' }}>
                  <Link href={`/vendor/${v.id}`} style={{ textDecoration: 'none' }}>
                    <div className="card">
                      <div className="card-image" style={{ height: '160px' }}>
                        <img src={v.images[0]} alt={v.name} />
                        {v.isPremium && (
                          <div className="premium-badge" style={{ 
                            position: 'absolute', 
                            top: '8px', 
                            left: '8px',
                            zIndex: 2
                          }}>
                            <Icon name="crown" size={10} />
                            PREMIUM
                          </div>
                        )}
                        {v.open ? (
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
                            Open
                          </div>
                        ) : (
                          <div style={{
                            position: 'absolute',
                            bottom: '8px',
                            left: '8px',
                            zIndex: 2,
                            fontSize: '10px',
                            fontWeight: 600,
                            color: 'var(--rum)'
                          }}>
                            Closed
                          </div>
                        )}
                        {v.live && (
                          <div style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '8px',
                            zIndex: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                            color: '#00C853'
                          }}>
                            <span className="live-dot" />
                            {v.whoThere} here
                          </div>
                        )}
                      </div>
                      <div className="card-content">
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--black)' }}>{v.name}</h4>
                            <p style={{ fontSize: '11px', color: 'var(--grey)' }}>
                              {v.category} • {v.neighborhood}
                            </p>
                            {v.rating && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                <Icon name="star" size={12} style={{ color: 'var(--gold)' }} />
                                <span style={{ fontSize: '11px', fontWeight: 600 }}>{v.rating}</span>
                                {v.reviewCount && (
                                  <span style={{ fontSize: '10px', color: 'var(--grey)' }}>
                                    ({v.reviewCount})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              toggleSaveVendor(v.id)
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '4px',
                              color: savedVendors.includes(v.id) ? 'var(--rum)' : 'var(--grey)'
                            }}
                          >
                            <Icon name="heart" size={20} className={savedVendors.includes(v.id) ? 'filled' : ''} />
                          </button>
                        </div>
                        <p className="card-price" style={{ marginTop: '8px' }}>
                          {v.priceRange}
                        </p>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom sheet quick view (requirement 22) */}
      <div className={`bottom-sheet-overlay ${selectedVendor ? 'open' : ''}`} onClick={() => setSelectedVendor(null)} />
      <div className={`bottom-sheet ${selectedVendor ? 'open' : ''}`}>
        {selectedVendor && (
          <div style={{ padding: '20px' }}>
            <div style={{ 
              width: '40px', 
              height: '4px', 
              background: 'var(--light-grey)', 
              borderRadius: '2px',
              margin: '0 auto 16px'
            }} />
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <img 
                src={selectedVendor.images[0]} 
                alt={selectedVendor.name}
                style={{ 
                  width: '80px', 
                  height: '80px', 
                  borderRadius: '12px',
                  objectFit: 'cover'
                }}
              />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>
                  {selectedVendor.name}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--grey)' }}>
                  {selectedVendor.category} • {selectedVendor.neighborhood}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  {selectedVendor.isPremium && (
                    <div className="premium-badge">
                      <Icon name="crown" size={10} />
                      PREMIUM
                    </div>
                  )}
                  {selectedVendor.live && (
                    <div className="live-indicator">
                      <span className="live-dot" />
                      {selectedVendor.whoThere} here now
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--black)', marginBottom: '16px' }}>
              {selectedVendor.description}
            </p>
            <Link 
              href={`/vendor/${selectedVendor.id}`}
              style={{ textDecoration: 'none' }}
            >
              <button className="btn btn-primary" style={{ width: '100%' }}>
                View Full Details
              </button>
            </Link>
          </div>
        )}
      </div>

      <Dock />
    </main>
  )
}