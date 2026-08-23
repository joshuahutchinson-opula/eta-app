// app/marketplace/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import FloatingPill from '@/components/FloatingPill'
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

interface FlashDeal {
  id: string
  deal: string
  expires: string
  vendor: { id: string; name: string; images?: string[]; isPremium?: boolean; rating?: number; reviewCount?: number }
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

function formatCategory(category: string): string {
  return category.charAt(0) + category.slice(1).toLowerCase()
}

export default function MarketplacePage() {
  const router = useRouter()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [accommodations, setAccommodations] = useState<Accommodation[]>([])
  const [flashDeals, setFlashDeals] = useState<FlashDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState<'NEGRIL' | 'MONTEGO_BAY'>('NEGRIL')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('Recommended')
  const [savedVendors, setSavedVendors] = useState<string[]>([])
  const [accommodationType, setAccommodationType] = useState('All-Inclusive')
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  const [dishesOfDay, setDishesOfDay] = useState<Array<{ id: string; vendorId: string; vendorName: string; dish: string; price: number; eta: string; imageUrl: string }>>([])
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    fetchData()
    const saved = localStorage.getItem('savedVendors')
    if (saved) setSavedVendors(JSON.parse(saved))
    const savedCity = localStorage.getItem('marketplaceCity')
    if (savedCity) setCity(savedCity as 'NEGRIL' | 'MONTEGO_BAY')
    const savedCategory = localStorage.getItem('marketplaceCategory')
    if (savedCategory) setSelectedCategory(savedCategory)
    const savedSort = localStorage.getItem('marketplaceSort')
    if (savedSort) setSortBy(savedSort)
    const savedTheme = localStorage.getItem('theme')
    setDarkMode(savedTheme === 'dark')
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
      setFlashDeals(Array.isArray(flashDealsData) ? flashDealsData : [])
      
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

  const handleCityChange = (c: 'NEGRIL' | 'MONTEGO_BAY') => {
    setCity(c)
    localStorage.setItem('marketplaceCity', c)
  }

  const handleCategoryChange = (cat: string | null) => {
    setSelectedCategory(cat)
    if (cat) localStorage.setItem('marketplaceCategory', cat)
    else localStorage.removeItem('marketplaceCategory')
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

  const topRatedPremium = [...premiumVendors].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0]

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--off-white)', overflowX: 'hidden' }}>
        <div className="logo-container" onClick={() => router.push('/')}>
          {darkMode ? (
            <img src="/logo-dark.png" alt="ETA" />
          ) : (
            <img src="/logo.png" alt="ETA" />
          )}
        </div>
        <FloatingPill />
        <div style={{ padding: '16px 16px 100px' }}>
          <div className="skeleton-card" style={{ height: '44px', marginBottom: '24px' }}>
            <div className="skeleton-image" style={{ height: '100%' }} />
          </div>
          <div className="skeleton-card" style={{ height: '200px', marginBottom: '32px' }}>
            <div className="skeleton-image" style={{ height: '100%' }} />
          </div>
          <div className="grid-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-image" style={{ height: '140px' }} />
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
      <div className="logo-container" onClick={() => router.push('/')}>
        {darkMode ? (
          <img src="/logo-dark.png" alt="ETA" />
        ) : (
          <img src="/logo.png" alt="ETA" />
        )}
      </div>
      <FloatingPill />

      <div style={{ padding: '16px 16px 16px' }}>
        {/* Search bar */}
        <div className="card" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          padding: '10px 14px',
          marginBottom: '24px',
          position: 'sticky',
          top: '12px',
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
          <span onClick={() => setShowFilterSheet(true)} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
            <Icon name="filter" size={16} style={{ color: 'var(--grey)' }} />
          </span>
        </div>

        {/* Flash Deals */}
        {flashDeals.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">LIMITED TIME</span>
                <span className="section-title">Flash Deals</span>
              </div>
            </div>
            <div className="horizontal-scroll" style={{ padding: '8px 0 16px 0' }}>
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

        {/* Dish Of The Day */}
        {dishesOfDay.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">TODAY&apos;S PICK</span>
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
                    <span className="num-font" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--rum)' }}>
                      ${dishesOfDay[0].price}
                    </span>
                    <span className="num-font" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                      {dishesOfDay[0].eta}
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
                <span className="section-eyebrow">TOP TIER</span>
                <span className="section-title">Premium Members</span>
              </div>
              <Link href="/vendors" className="section-link">See all <Icon name="chevronRight" size={14} /></Link>
            </div>
            <div className="horizontal-scroll" style={{ padding: '8px 0 16px 0' }}>
              {premiumVendors.map((v) => (
                <Link 
                  key={v.id} 
                  href={`/vendor/${v.id}`} 
                  style={{ textDecoration: 'none', flexShrink: 0, width: v.id === topRatedPremium?.id ? '280px' : '180px' }}
                >
                  <div className="card">
                    <div className="card-image" style={{ height: v.id === topRatedPremium?.id ? '180px' : '120px' }}>
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
                      <p style={{ fontSize: '11px', color: 'var(--grey)', marginBottom: '4px' }}>{formatCategory(v.category)} · {v.neighborhood}</p>
                      {v.rating && (
                        <div className="rating-text">
                          ★ <span className="num-font">{v.rating}</span>
                          {v.reviewCount && <span> · <span className="num-font">{v.reviewCount}</span></span>}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Accommodation */}
        {filteredAccommodations.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">STAY AWHILE</span>
                <span className="section-title">Accommodation</span>
              </div>
              <Link href="/vendors" className="section-link">See all <Icon name="chevronRight" size={14} /></Link>
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
            <div className="horizontal-scroll" style={{ padding: '8px 0 16px 0' }}>
              {filteredAccommodations.map(a => (
                <Link key={a.id} href={`/accommodation/${a.id}`} style={{ textDecoration: 'none', flexShrink: 0, width: '220px' }}>
                  <div className="card">
                    <div className="card-image" style={{ height: '120px' }}>
                      <img src={a.media?.[0]?.url || ''} alt={a.name} />
                    </div>
                    <div className="card-content">
                      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--black)', marginBottom: '2px' }}>{a.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--grey)', marginBottom: '4px' }}>
                        ★ <span className="num-font">{a.googleStars}</span> · {a.type}
                      </p>
                      <p className="card-price">{a.priceRange}/night</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All Vendors */}
        <div>
          <div className="section-header">
            <div className="section-heading">
              <span className="section-eyebrow">FULL LISTINGS</span>
              <span className="section-title">All Vendors</span>
            </div>
            <Link href="/vendors" className="section-link">See all <Icon name="chevronRight" size={14} /></Link>
          </div>
          {filteredVendors.length === 0 ? (
            <div className="empty-state">
              <Icon name="search" size={32} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: '16px', fontWeight: 600 }}>{patois.emptySearch || "Nuttin nuh go suh"}</p>
              <p style={{ fontSize: '13px' }}>Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid-2" style={{ gap: '12px' }}>
              {filteredVendors.map(v => (
                <div key={v.id}>
                  <Link href={`/vendor/${v.id}`} style={{ textDecoration: 'none' }}>
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
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--black)', marginBottom: '2px' }}>{v.name}</p>
                            <p style={{ fontSize: '11px', color: 'var(--grey)', marginBottom: '4px' }}>{formatCategory(v.category)} · {v.neighborhood}</p>
                            {v.rating && (
                              <div className="rating-text" style={{ marginBottom: '4px' }}>
                                ★ <span className="num-font">{v.rating}</span>
                                {v.reviewCount && <span> · <span className="num-font">{v.reviewCount}</span></span>}
                              </div>
                            )}
                          </div>
                          <button
                            className="heart-btn"
                            onClick={(e) => { e.preventDefault(); toggleSaveVendor(v.id) }}
                            style={{ color: savedVendors.includes(v.id) ? 'var(--rum)' : 'var(--grey)' }}
                          >
                            <Icon name="heart" size={14} className={savedVendors.includes(v.id) ? 'filled' : ''} />
                          </button>
                        </div>
                        <p className="price-tier">{v.priceRange}</p>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
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
                onClick={() => handleCityChange(c as 'NEGRIL' | 'MONTEGO_BAY')}
                className={`chip ${city === c ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
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
                onClick={() => handleCategoryChange(selectedCategory === cat.name ? null : cat.name)}
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