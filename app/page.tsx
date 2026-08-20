'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import StatusModule from '@/components/StatusModule'
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
  stories: Array<{ id: string; content: string; type: string; imageUrl: string }>
}

interface Experience {
  id: string
  name: string
  tagline: string
  price: number
  imageUrl: string
  travelTime: number
  travelMode: string
}

interface PhotoSpot {
  id: string
  name: string
  description: string
  officialPhoto: string
  bestTime: string
}

interface FlashDeal {
  id: string
  deal: string
  expires: string
  vendor: { id: string; name: string }
}

export default function HomePage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [photoSpots, setPhotoSpots] = useState<PhotoSpot[]>([])
  const [flashDeals, setFlashDeals] = useState<FlashDeal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    try {
      const [vendorsRes, experiencesRes, photoSpotsRes, flashDealsRes] = await Promise.all([
        fetch('/api/vendors'),
        fetch('/api/experiences'),
        fetch('/api/photospots'),
        fetch('/api/flashdeals')
      ])

      const vendorsData = await vendorsRes.json()
      const experiencesData = await experiencesRes.json()
      const photoSpotsData = await photoSpotsRes.json()
      const flashDealsData = await flashDealsRes.json()

      setVendors(vendorsData)
      setExperiences(experiencesData)
      setPhotoSpots(photoSpotsData)
      setFlashDeals(flashDealsData)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const heroVendor = vendors.find(v => v.live) || vendors[0]
  const hour = new Date().getHours()

  const getBounceSuggestion = () => {
    if (hour >= 17 && hour <= 19) {
      return { title: 'Sunset in 42 min', desc: 'You\'re 7 min from the best viewpoint.', icon: 'sun' }
    }
    if (hour >= 20) {
      return { title: 'Night run loading', desc: 'Live music nearby.', icon: 'moon' }
    }
    return { title: 'Explore the area', desc: 'Some spots only appear when close.', icon: 'compass' }
  }

  const bounce = getBounceSuggestion()

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '3px solid var(--glass-border)', borderTopColor: 'var(--rum)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          <p style={{ fontSize: '15px', color: 'var(--sand-dim)', marginTop: '16px' }}>
            {patois.loadingHome}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <TopBar />
      <StatusModule />

      {/* Today Strip */}
      <div className="glass-pill" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', margin: '8px 16px 0', fontSize: '12px', color: 'var(--sand-dim)', position: 'relative', zIndex: 2 }}>
        <Icon name="sun" size={14} />
        28°C, light breeze
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(255,75,43,0.2)', borderRadius: '999px', fontSize: '12px', color: 'var(--rum-bright)', fontWeight: 600 }}>
          <Icon name="flame" size={14} />
          3-day
        </span>
      </div>

      {/* Stories Row */}
      <div style={{ display: 'flex', gap: '12px', padding: '12px 16px 4px', overflowX: 'auto', scrollbarWidth: 'none', position: 'relative', zIndex: 2 }}>
        {vendors.filter(v => v.stories && v.stories.length > 0).map(v => (
          <Link key={v.id} href="/stories" style={{ textDecoration: 'none', flexShrink: 0, textAlign: 'center' }}>
            <div className={`story-ring ${v.isPremium ? '' : 'standard'}`}>
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
      </div>

      <div style={{ padding: '16px', paddingBottom: '120px', position: 'relative', zIndex: 2 }}>
        {/* Hero Card */}
        {heroVendor && (
          <Link href={`/vendor/${heroVendor.id}`} style={{ textDecoration: 'none', color: 'var(--sand)' }}>
            <div className="glass" style={{ position: 'relative', height: '220px', overflow: 'hidden', cursor: 'pointer', marginBottom: '16px' }}>
              <img src={heroVendor.images[0]} alt={heroVendor.name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(15,14,12,0.95))' }} />
              {heroVendor.isPremium && <div className="bond-badge">PREMIUM</div>}
              <div style={{ position: 'absolute', bottom: '14px', left: '14px', right: '14px' }}>
                {heroVendor.live && (
                  <p style={{ fontSize: '10px', color: 'var(--sea)', fontWeight: 600 }}>
                    ● LIVE • {heroVendor.whoThere} here now
                  </p>
                )}
                <h3 style={{ fontSize: '20px', fontWeight: 700 }}>{heroVendor.name}</h3>
                <p style={{ fontSize: '12px', color: 'var(--sand-dim)' }}>
                  {heroVendor.category} • {heroVendor.name} ETA: 5 min
                </p>
              </div>
            </div>
          </Link>
        )}

        {/* Not Feeling It Here? Let's Bounce */}
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <Icon name={bounce.icon} size={18} />
            Not Feeling It Here? Let&apos;s Bounce
          </h2>
          <div className="glass" style={{ padding: '16px', cursor: 'pointer' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{bounce.title}</h3>
            <p style={{ fontSize: '13px', color: 'var(--sand-dim)' }}>{bounce.desc}</p>
          </div>
        </div>

        {/* Flash Deals */}
        {flashDeals.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon name="flame" size={18} />
              Flash Deals
            </h2>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {flashDeals.map(fd => (
                <div key={fd.id} className="glass" style={{ flexShrink: 0, padding: '12px 16px', cursor: 'pointer', minWidth: '200px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--rum-bright)' }}>{fd.vendor.name}</p>
                  <p style={{ fontSize: '13px', fontWeight: 600 }}>{fd.deal}</p>
                  <p style={{ fontSize: '10px', color: 'var(--sand-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Icon name="clock" size={12} />
                    {new Date(fd.expires).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
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
                <Link key={spot.id} href={`/photospot/${spot.id}`} style={{ textDecoration: 'none', color: 'var(--black)', background: '#F5EFE6', padding: '8px 8px 14px', borderRadius: '4px', cursor: 'pointer', flexShrink: 0, width: '160px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  <img src={spot.officialPhoto} alt={spot.name} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '2px' }} />
                  <p style={{ fontSize: '12px', fontWeight: 600, marginTop: '8px', textAlign: 'center', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                    {spot.name}
                  </p>
                  <p style={{ fontSize: '10px', color: '#666', textAlign: 'center' }}>{spot.description}</p>
                  <p style={{ fontSize: '9px', color: 'var(--rum)', textAlign: 'center', marginTop: '4px', fontWeight: 600 }}>
                    Best: {spot.bestTime}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Moods */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>Moods</h2>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {['R&R', 'Just The Two Of Us', 'Out Til Sunrise', 'Golden Hour', 'Water Life', 'Street Food Crawl', 'Hangover Cures', 'Solo Missions', 'Family Day', 'Rum & Bass'].map((mood, i) => (
              <button key={mood} className={`mood-chip ${i === 0 ? 'active' : ''}`}>
                {mood}
              </button>
            ))}
          </div>
        </div>

        {/* Experiences Preview */}
        {experiences.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>Experiences</h2>
            {experiences.slice(0, 2).map(e => (
              <div key={e.id} className="ticket-card" style={{ position: 'relative' }}>
                <div style={{ width: '40%', minWidth: '40%', backgroundImage: `url(${e.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                <div style={{ position: 'absolute', left: '40%', top: 0, bottom: 0, width: '20px', borderLeft: '2px dashed rgba(255,255,255,0.2)' }} />
                <div style={{ flex: 1, padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{e.name}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--sand-dim)' }}>{e.tagline}</p>
                  <p style={{ fontSize: '12px', color: 'var(--sea)' }}>
                    {e.name} ETA: {e.travelTime} min
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Near You Now */}
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>Near You Now</h2>
          <div className="vendor-grid">
            {vendors.slice(0, 4).map(v => (
              <Link key={v.id} href={`/vendor/${v.id}`} className={`window-card ${v.isPremium ? 'bond' : ''}`} style={{ textDecoration: 'none', color: 'var(--sand)' }}>
                <img src={v.images[0]} alt={v.name} style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }} />
                {v.isPremium && <div className="bond-badge">PREMIUM</div>}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px', background: 'linear-gradient(180deg, transparent, rgba(15,14,12,0.95) 50%)' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 700 }}>{v.name}</h4>
                  <p style={{ fontSize: '11px', color: 'var(--sand-dim)' }}>
                    {v.category} • {v.name} ETA: 5 min
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Live Ticker */}
      <div className="live-ticker">
        <span className="ticker-dot" />
        Marcus checked in at Push Cart • 2 new deals • Sunset in 42 min
      </div>

      <Dock />
    </main>
  )
}