// app/vendors/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
}

const CATEGORIES = [
  { name: 'Food', icon: 'food' },
  { name: 'Drinks', icon: 'glass' },
  { name: 'Activities', icon: 'party' },
  { name: 'Wellness', icon: 'spa' },
  { name: 'Beach', icon: 'wave' }
]

const SORT_OPTIONS = ['Recommended', 'Price', 'Rating', 'Distance']

function formatCategory(category: string): string {
  return category.charAt(0) + category.slice(1).toLowerCase()
}

export default function VendorsPage() {
  const router = useRouter()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState<'NEGRIL' | 'MONTEGO_BAY'>('NEGRIL')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('Recommended')
  const [savedVendors, setSavedVendors] = useState<string[]>([])
  const [showFilterSheet, setShowFilterSheet] = useState(false)

  useEffect(() => {
    fetchVendors()
    const saved = localStorage.getItem('savedVendors')
    if (saved) setSavedVendors(JSON.parse(saved))
    const savedCity = localStorage.getItem('marketplaceCity')
    if (savedCity) setCity(savedCity as 'NEGRIL' | 'MONTEGO_BAY')
    const savedCategory = localStorage.getItem('marketplaceCategory')
    if (savedCategory) setSelectedCategory(savedCategory)
    const savedSort = localStorage.getItem('marketplaceSort')
    if (savedSort) setSortBy(savedSort)
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

  if (loading) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)' }}>
        <div style={{ padding: '16px', paddingBottom: '100px' }}>
          <div className="skeleton-card" style={{ height: '44px', marginBottom: '24px' }}>
            <div className="skeleton-image" style={{ height: '100%' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton-card" style={{ height: '100px' }}>
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

        {/* Category vibe pills */}
        <div className="mood-picker" style={{ padding: '4px 0 12px' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.name}
              onClick={() => handleCategoryChange(selectedCategory === cat.name ? null : cat.name)}
              className={`mood-pill ${selectedCategory === cat.name ? 'centre' : ''}`}
            >
              <Icon name={cat.icon as any} size={16} />
              {cat.name}
            </button>
          ))}
        </div>

        {/* Count */}
        <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '12px' }}>
          <span className="num-font">{filteredVendors.length}</span> vendors
          {city && ` in ${city === 'NEGRIL' ? 'Negril' : 'Montego Bay'}`}
        </p>

        {/* Full vendor list - one column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
            </LongPressCard>
          ))}
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