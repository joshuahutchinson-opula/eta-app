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
  priceRange: string
  description: string
  images: string[]
  open: boolean
  live: boolean
  isPremium: boolean
  whoThere: number
}

interface Accommodation {
  id: string
  name: string
  type: string
  googleStars: number
  description: string
  priceRange: string
  media: Array<{ type: string; url: string }>
}

export default function MarketplacePage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [accommodations, setAccommodations] = useState<Accommodation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [vendorsRes, accomRes] = await Promise.all([
        fetch('/api/vendors'),
        fetch('/api/accommodations')
      ])

      const vendorsData = await vendorsRes.json()
      const accomData = await accomRes.json()

      setVendors(vendorsData)
      setAccommodations(accomData)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const premiumVendors = vendors.filter(v => v.isPremium)
  const standardVendors = vendors.filter(v => !v.isPremium)

  const filteredVendors = search
    ? vendors.filter(v =>
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.category.toLowerCase().includes(search.toLowerCase()) ||
        v.neighborhood.toLowerCase().includes(search.toLowerCase())
      )
    : standardVendors

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '3px solid var(--glass-border)', borderTopColor: 'var(--rum)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          <p style={{ fontSize: '15px', color: 'var(--sand-dim)', marginTop: '16px' }}>
            {patois.loadingMarketplace}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1, paddingBottom: '120px' }}>
      <TopBar />

      <div style={{ padding: '16px' }}>
        {/* Search */}
        <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px', marginBottom: '20px' }}>
          <Icon name="search" size={18} />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--sand)', fontSize: '16px', outline: 'none', fontFamily: 'inherit' }}
          />
          <Icon name="shuffle" size={18} />
        </div>

        {/* Moods */}
        <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>Moods</h2>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '20px', scrollbarWidth: 'none' }}>
          {['R&R', 'Just The Two Of Us', 'Out Til Sunrise', 'Golden Hour', 'Water Life', 'Street Food Crawl', 'Hangover Cures', 'Solo Missions', 'Family Day', 'Rum & Bass'].map((mood, i) => (
            <button key={mood} className={`mood-chip ${i === 0 ? 'active' : ''}`}>
              {mood}
            </button>
          ))}
        </div>

        {/* Premium Members */}
        {premiumVendors.length > 0 && (
          <>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon name="star" size={18} />
              Premium Members
            </h2>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '20px', scrollbarWidth: 'none' }}>
              {premiumVendors.map(v => (
                <Link key={v.id} href={`/vendor/${v.id}`} className="window-card bond" style={{ minWidth: '200px', flexShrink: 0, textDecoration: 'none', color: 'var(--sand)' }}>
                  <img src={v.images[0]} alt={v.name} style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                  <div className="bond-badge">PREMIUM</div>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px', background: 'linear-gradient(180deg, transparent, rgba(15,14,12,0.95) 50%)' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 700 }}>{v.name}</h4>
                    <p style={{ fontSize: '11px', color: 'var(--sand-dim)' }}>{v.category}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Accommodation */}
        {accommodations.length > 0 && (
          <>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>Accommodation</h2>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '20px', scrollbarWidth: 'none' }}>
              {accommodations.map(a => (
                <Link key={a.id} href={`/accommodation/${a.id}`} className="window-card" style={{ minWidth: '220px', flexShrink: 0, textDecoration: 'none', color: 'var(--sand)' }}>
                  <img src={a.media?.[0]?.url || ''} alt={a.name} style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px', background: 'linear-gradient(180deg, transparent, rgba(15,14,12,0.95) 50%)' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 700 }}>{a.name}</h4>
                    <p style={{ fontSize: '11px', color: 'var(--sand-dim)' }}>
                      ★ {a.googleStars} • {a.priceRange}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* All Vendors */}
        <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>All Vendors</h2>
        {filteredVendors.length === 0 ? (
          <p style={{ color: 'var(--sand-dim)', textAlign: 'center', padding: '40px 0' }}>
            {patois.emptySearch}
          </p>
        ) : (
          <div className="vendor-grid">
            {filteredVendors.map(v => (
              <Link key={v.id} href={`/vendor/${v.id}`} className="window-card" style={{ textDecoration: 'none', color: 'var(--sand)' }}>
                <img src={v.images[0]} alt={v.name} style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px', background: 'linear-gradient(180deg, transparent, rgba(15,14,12,0.95) 50%)' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 700 }}>{v.name}</h4>
                  <p style={{ fontSize: '11px', color: 'var(--sand-dim)' }}>
                    {v.category} • {v.neighborhood}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Dock />
    </main>
  )
}