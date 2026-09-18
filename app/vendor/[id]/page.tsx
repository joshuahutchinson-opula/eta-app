// app/vendor/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { hapticSaved } from '@/lib/haptics'
import { patois } from '@/lib/patois'

interface ReviewItem {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  user: { name: string; avatarUrl: string | null }
}

interface StoryItem {
  id: string
  content: string
  type: string
  imageUrl: string
  createdAt: string
  expiresAt: string
}

interface ExperienceItem {
  id: string
  name: string
  tagline: string
  price: number
  imageUrl: string
  videoUrl?: string | null
  city: string
  startLocation: string
  travelTime: number
  travelMode: string
}

interface FlashDealItem {
  id: string
  deal: string
  expires: string
}

interface VendorDetail {
  id: string
  name: string
  category: string
  neighborhood: string
  city: string
  lat: number
  lng: number
  priceRange: string
  description: string
  images: string[]
  videos: string[]
  open: boolean
  live: boolean
  isPremium: boolean
  isTransport: boolean
  whoThere: number
  tipsJar: boolean
  payItForward: boolean
  menu: any
  rating?: number
  reviewCount?: number
  stories: StoryItem[]
  reviews: ReviewItem[]
  experiences: ExperienceItem[]
  flashDeals: FlashDealItem[]
}

const CATEGORY_ICONS: Record<string, string> = {
  FOOD: 'food',
  DRINKS: 'glass',
  ACTIVITY: 'party',
  TRANSPORT: 'route',
  WELLNESS: 'spa',
  BEACH: 'wave',
  ACCOMMODATION: 'home',
  OTHER: 'sparkle'
}

function formatCategory(category: string): string {
  if (!category) return ''
  return category.charAt(0) + category.slice(1).toLowerCase()
}

function formatCity(city: string): string {
  return city === 'NEGRIL' ? 'Negril' : city === 'MONTEGO_BAY' ? 'Montego Bay' : city
}

function formatCountdown(expires: string): string {
  const diffMs = new Date(expires).getTime() - Date.now()
  if (diffMs <= 0) return 'Ended'
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `Ends in ${diffMin}m`
  return `Ends in ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function renderMenuItems(items: any[]) {
  return items.map((item, i) => {
    let name: string | undefined
    let price: number | string | undefined
    if (item && typeof item === 'object') {
      name = item.name || item.item || item.title
      price = item.price
    } else if (typeof item === 'string') {
      name = item
    }
    if (!name) return null
    return (
      <div
        key={i}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 0',
          borderBottom: i < items.length - 1 ? '0.5px solid var(--separator)' : 'none'
        }}
      >
        <span style={{ fontSize: '15px', color: 'var(--label-primary)' }}>{name}</span>
        {price !== undefined && price !== null && (
          <span className="num-font" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rum)' }}>${price}</span>
        )}
      </div>
    )
  })
}

function MenuSection({ menu }: { menu: any }) {
  if (Array.isArray(menu)) {
    if (menu.length === 0) return null
    return (
      <div style={{ marginBottom: '24px' }}>
        <div className="section-header">
          <div className="section-heading">
            <span className="section-title">Menu</span>
          </div>
        </div>
        <div className="card" style={{ padding: '0 16px' }}>
          {renderMenuItems(menu)}
        </div>
      </div>
    )
  }

  if (menu && typeof menu === 'object') {
    const entries = Object.entries(menu)
    if (entries.length === 0) return null
    return (
      <div style={{ marginBottom: '24px' }}>
        <div className="section-header">
          <div className="section-heading">
            <span className="section-title">Menu</span>
          </div>
        </div>
        {entries.map(([category, value], idx) => (
          <div key={idx} style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '6px' }}>{category}</p>
            <div className="card" style={{ padding: '0 16px' }}>
              {Array.isArray(value) ? renderMenuItems(value) : (
                <p style={{ fontSize: '14px', color: 'var(--label-secondary)', padding: '10px 0' }}>{String(value)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return null
}

export default function VendorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const vendorId = params.id as string

  const [vendor, setVendor] = useState<VendorDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchVendor()
    try {
      const savedIds = JSON.parse(localStorage.getItem('savedVendors') || '[]')
      if (Array.isArray(savedIds)) setSaved(savedIds.includes(vendorId))
    } catch {
      // ignore malformed localStorage
    }
  }, [vendorId])

  const fetchVendor = async () => {
    setLoading(true)
    setNotFound(false)
    try {
      const res = await fetch(`/api/vendors/${vendorId}`)
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      if (!res.ok) {
        setNotFound(true)
        return
      }
      const data = await res.json()
      setVendor(data)
    } catch (error) {
      console.error(error)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  const toggleSave = () => {
    if (!vendor) return
    hapticSaved()
    let savedIds: string[] = []
    try {
      savedIds = JSON.parse(localStorage.getItem('savedVendors') || '[]')
      if (!Array.isArray(savedIds)) savedIds = []
    } catch {
      savedIds = []
    }
    const newSaved = savedIds.includes(vendor.id)
      ? savedIds.filter(id => id !== vendor.id)
      : [...savedIds, vendor.id]
    localStorage.setItem('savedVendors', JSON.stringify(newSaved))
    setSaved(newSaved.includes(vendor.id))
  }

  const handleDirections = () => {
    if (!vendor) return
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${vendor.lat},${vendor.lng}`, '_blank')
  }

  const BackButton = (
    <button
      onClick={() => router.back()}
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        left: '16px',
        zIndex: 20,
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#0F0E0C',
        boxShadow: 'var(--shadow-card)'
      }}
    >
      <Icon name="back" size={16} />
    </button>
  )

  if (loading) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)' }}>
        {BackButton}
        <div className="skeleton-card" style={{ height: '320px' }}>
          <div className="skeleton-image" style={{ height: '100%' }} />
        </div>
        <div style={{ padding: '16px' }}>
          <div className="skeleton-card" style={{ height: '26px', width: '60%', marginBottom: '10px' }}>
            <div className="skeleton-image" style={{ height: '100%' }} />
          </div>
          <div className="skeleton-card" style={{ height: '16px', width: '40%', marginBottom: '20px' }}>
            <div className="skeleton-image" style={{ height: '100%' }} />
          </div>
          <div className="skeleton-card" style={{ height: '80px', marginBottom: '20px' }}>
            <div className="skeleton-image" style={{ height: '100%' }} />
          </div>
          <div className="skeleton-card" style={{ height: '140px' }}>
            <div className="skeleton-image" style={{ height: '100%' }} />
          </div>
        </div>
      </main>
    )
  }

  if (notFound || !vendor) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        {BackButton}
        <div className="empty-state">
          <Icon name="mapPin" size={32} style={{ color: 'var(--label-tertiary)' }} />
          <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{patois.emptySearch}</p>
          <p>Dis vendor nuh deh yah anymore.</p>
          <button className="btn btn-primary" onClick={() => router.push('/vendors')} style={{ marginTop: '8px' }}>
            Back to Vendors
          </button>
        </div>
      </main>
    )
  }

  const showPayButton = vendor.tipsJar || vendor.payItForward

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '92px' }}>
      {BackButton}

      {/* Hero */}
      <div style={{ position: 'relative', height: '320px', background: 'var(--system-bg-secondary)', overflow: 'hidden' }}>
        {vendor.videos && vendor.videos.length > 0 ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={vendor.images[0] || undefined}
            src={vendor.videos[0]}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          vendor.images[0] && (
            <img src={vendor.images[0]} alt={vendor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )
        )}
        <div className="featured-hero-overlay" />

        {vendor.isPremium && (
          <div className="card-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Icon name="crown" size={11} />
            Premium
          </div>
        )}
        {vendor.live && (
          <div className="card-badge" style={{ left: 'auto', right: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="live-dot" />
            <span className="num-font">{vendor.whoThere}</span> here now
          </div>
        )}
      </div>

      <div style={{ padding: '16px' }}>
        {/* Name / meta */}
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginBottom: '4px' }}>
          {vendor.name}
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <Icon name={CATEGORY_ICONS[vendor.category] || 'sparkle'} size={14} />
          {formatCategory(vendor.category)} · {vendor.neighborhood}, {formatCity(vendor.city)}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {vendor.open ? (
            <span style={{ fontSize: '13px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="open-dot" /> Open
            </span>
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--label-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="closed-dot" /> Closed
            </span>
          )}
          <span className="price-tier">{vendor.priceRange}</span>
          {vendor.rating && (
            <div className="rating-text">
              ★ <span className="num-font">{vendor.rating}</span>
              {vendor.reviewCount && <span>· <span className="num-font">{vendor.reviewCount}</span> reviews</span>}
            </div>
          )}
        </div>

        {/* Description */}
        <p style={{ fontSize: '15px', lineHeight: 1.5, color: 'var(--label-primary)', marginBottom: '8px' }}>
          {vendor.description}
        </p>

        {/* Menu (defensive) */}
        <MenuSection menu={vendor.menu} />

        {/* Flash deals */}
        {vendor.flashDeals.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">Limited Time</span>
                <span className="section-title">Flash Deals</span>
              </div>
            </div>
            <div className="horizontal-scroll">
              {vendor.flashDeals.map(fd => (
                <div key={fd.id} className="card" style={{ width: '200px' }}>
                  <div className="card-image" style={{ height: '110px' }}>
                    {vendor.images[0] && <img src={vendor.images[0]} alt={vendor.name} />}
                    <div className="card-overlay" />
                  </div>
                  <div className="card-content">
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{fd.deal}</p>
                    <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Icon name="clock" size={12} />
                      {formatCountdown(fd.expires)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Experiences */}
        {vendor.experiences.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">From This Vendor</span>
                <span className="section-title">Experiences</span>
              </div>
              <Link href="/experiences" className="section-link">See All</Link>
            </div>
            <div className="horizontal-scroll">
              {vendor.experiences.map(exp => (
                <Link key={exp.id} href="/experiences" style={{ textDecoration: 'none', flexShrink: 0 }}>
                  <div className="card" style={{ width: '180px' }}>
                    <div className="card-image" style={{ height: '110px' }}>
                      {exp.imageUrl && <img src={exp.imageUrl} alt={exp.name} />}
                      <div className="card-overlay" />
                    </div>
                    <div className="card-content">
                      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '2px' }}>{exp.name}</p>
                      <span className="card-price">${exp.price}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent stories */}
        {vendor.stories.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-title">Recent Stories</span>
              </div>
            </div>
            <div className="horizontal-scroll">
              {vendor.stories.map(story => (
                <div key={story.id} style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div className={`story-ring ${vendor.isPremium ? 'premium' : 'standard'}`}>
                    {story.imageUrl && <img src={story.imageUrl} alt="Story" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div>
          <div className="section-header">
            <div className="section-heading">
              <span className="section-title">Reviews</span>
            </div>
          </div>
          {vendor.reviews.length === 0 ? (
            <div className="empty-state">
              <Icon name="star" size={28} style={{ color: 'var(--label-tertiary)' }} />
              <p>{patois.emptyReviews}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {vendor.reviews.map(r => (
                <div key={r.id} className="card" style={{ padding: '12px', cursor: 'default' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--system-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {r.user.avatarUrl ? (
                        <img src={r.user.avatarUrl} alt={r.user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Icon name="user" size={16} style={{ color: 'var(--label-tertiary)' }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{r.user.name}</p>
                      <div className="rating-text" style={{ gap: 0 }}>
                        <span style={{ color: 'var(--gold)' }}>{'★'.repeat(Math.max(0, Math.min(5, r.rating)))}</span>
                        <span style={{ color: 'var(--label-tertiary)' }}>{'★'.repeat(Math.max(0, 5 - r.rating))}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--label-tertiary)', flexShrink: 0 }}>{formatDate(r.createdAt)}</span>
                  </div>
                  {r.comment && (
                    <p style={{ fontSize: '14px', color: 'var(--label-secondary)', lineHeight: 1.4 }}>{r.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--system-bg-elevated)',
          borderTop: '0.5px solid var(--separator)',
          padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 20
        }}
      >
        <button
          className="heart-btn"
          onClick={toggleSave}
          style={{ color: saved ? 'var(--rum)' : 'var(--label-secondary)' }}
        >
          <Icon name="heart" size={20} className={saved ? 'filled' : ''} />
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleDirections}>
          <Icon name="mapPin" size={16} />
          Get Directions
        </button>
        {showPayButton && (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => router.push('/pay')}>
            <Icon name="card" size={16} />
            Pay Here
          </button>
        )}
      </div>
    </main>
  )
}
