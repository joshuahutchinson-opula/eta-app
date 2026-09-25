// app/vendor/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { hapticSaved } from '@/lib/haptics'
import { usePatois } from '@/lib/i18n-client'
import AddToTripSheet from '@/components/AddToTripSheet'
import { alertsEnabled, enableAlerts, syncAlerts } from '@/lib/alerts-client'
import { accessibilityLabel } from '@/lib/accessibility'
import { categoryStyle, priceTier } from '@/lib/vendor-style'
import VendorCard, { type VendorCardVendor } from '@/components/VendorCard'

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
  instagram?: string | null
  website?: string | null
  images: string[]
  videos: string[]
  open: boolean
  live: boolean
  isPremium: boolean
  isTransport: boolean
  whoThere: number
  tipsJar: boolean
  payItForward: boolean
  accessibility?: string[]
  menu: any
  rating?: number
  reviewCount?: number
  stories: StoryItem[]
  reviews: ReviewItem[]
  experiences: ExperienceItem[]
  flashDeals: FlashDealItem[]
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
          <span className="num-font" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rum-text)' }}>${price}</span>
        )}
      </div>
    )
  })
}

function MenuSection({ menu }: { menu: any }) {
  if (Array.isArray(menu)) {
    if (menu.length === 0) return null
    return (
      <div style={{ marginBottom: '32px' }}>
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
      <div style={{ marginBottom: '32px' }}>
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
  const patois = usePatois()
  const params = useParams()
  const router = useRouter()
  const vendorId = params.id as string

  const [vendor, setVendor] = useState<VendorDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showAddToTrip, setShowAddToTrip] = useState(false)
  const [alertsOn, setAlertsOn] = useState(true)
  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const [slide, setSlide] = useState(0)
  const [related, setRelated] = useState<VendorCardVendor[]>([])

  useEffect(() => {
    fetchVendor()
    alertsEnabled().then(setAlertsOn).catch(() => setAlertsOn(false))
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
      fetchRelated(data)
    } catch (error) {
      console.error(error)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  // Same category in the same city first, topped up from the same neighborhood.
  const fetchRelated = async (v: VendorDetail) => {
    try {
      const all: Array<VendorCardVendor & { city: string }> = await (await fetch('/api/vendors')).json()
      if (!Array.isArray(all)) return
      const others = all.filter(o => o.id !== v.id && o.city === v.city)
      const same = others.filter(o => o.category === v.category)
      const near = others.filter(o => o.category !== v.category && o.neighborhood === v.neighborhood)
      setRelated([...same, ...near].slice(0, 4))
    } catch {
      // related row is optional
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
    syncAlerts()
  }

  // Saving a vendor is the natural moment to offer its live alert (B4).
  const turnOnLiveAlerts = async () => {
    setAlertMsg(null)
    try {
      await enableAlerts({ liveAlerts: true, dealAlerts: true })
      setAlertsOn(true)
      setAlertMsg('Alerts on — we’ll ping you when it goes live.')
    } catch (e) {
      setAlertMsg(e instanceof Error ? e.message : 'Sumth nah wuk')
    }
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
        <div className="skeleton-card" style={{ height: '45vh' }}>
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
  const cat = categoryStyle(vendor.category)
  const tier = priceTier(vendor.priceRange)
  const media = [
    ...vendor.videos.map(src => ({ type: 'video' as const, src })),
    ...vendor.images.map(src => ({ type: 'image' as const, src }))
  ]
  const ratingCounts = [5, 4, 3, 2, 1].map(n => ({ n, count: vendor.reviews.filter(r => r.rating === n).length }))
  const bbox = [vendor.lng - 0.006, vendor.lat - 0.004, vendor.lng + 0.006, vendor.lat + 0.004].join(',')
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${vendor.lat},${vendor.lng}`
  const goodToKnow = [
    vendor.tipsJar && { icon: 'gift', text: 'Tips jar — tip the crew straight from the app' },
    vendor.payItForward && { icon: 'heart', text: 'Pay it forward — buy the next person a round' },
    vendor.isPremium && { icon: 'crown', text: 'Premium member — verified and featured on ETA' },
    vendor.live && { icon: 'users', text: `${vendor.whoThere} ETA travelers here right now` }
  ].filter(Boolean) as Array<{ icon: string; text: string }>

  return (
    <main className="screen-push-in" style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '92px' }}>
      {BackButton}

      {/* Hero gallery: videos first, then photos; swipe through */}
      <div style={{ position: 'relative', height: '45vh', background: 'var(--system-bg-secondary)', overflow: 'hidden', borderBottom: `3px solid ${cat.color}` }}>
        <div
          onScroll={e => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          style={{ display: 'flex', height: '100%', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
        >
          {media.map((m, i) => m.type === 'video' ? (
            <video
              key={m.src}
              autoPlay={i === 0}
              muted
              loop
              playsInline
              preload={i === 0 ? 'auto' : 'none'}
              poster={vendor.images[0] || undefined}
              src={m.src}
              style={{ flex: '0 0 100%', width: '100%', height: '100%', objectFit: 'cover', scrollSnapAlign: 'start' }}
            />
          ) : (
            <img
              key={m.src}
              src={m.src}
              alt={`${vendor.name} — photo ${i - vendor.videos.length + 1}`}
              loading={i === 0 ? 'eager' : 'lazy'}
              style={{ flex: '0 0 100%', width: '100%', height: '100%', objectFit: 'cover', scrollSnapAlign: 'start' }}
            />
          ))}
        </div>
        <div className="featured-hero-overlay" style={{ pointerEvents: 'none' }} />

        {vendor.isPremium && (
          <div className="card-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', left: 'auto', right: '12px', top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
            <Icon name="crown" size={11} />
            Premium
          </div>
        )}
        {media.length > 1 && (
          <span style={{ position: 'absolute', bottom: '12px', right: '12px', padding: '4px 10px', borderRadius: '999px', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '12px', fontWeight: 700, pointerEvents: 'none' }}>
            {slide + 1} / {media.length}
          </span>
        )}
        {vendor.live && (
          <div style={{ position: 'absolute', bottom: '12px', left: '12px', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '12px', fontWeight: 700, pointerEvents: 'none' }}>
            <span className="live-dot" />
            <span className="num-font">{vendor.whoThere}</span> here now
          </div>
        )}
      </div>

      <div style={{ padding: '20px 16px' }}>
        {/* Name / category */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '999px', background: `${cat.color}1F`, color: cat.color, fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
          <Icon name={cat.icon} size={12} /> {cat.label}
        </span>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginBottom: '4px' }}>
          {vendor.name}
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Icon name="mapPin" size={14} /> {vendor.neighborhood}, {formatCity(vendor.city)}
        </p>

        {/* Quick facts — the mobile take on the web page's side panel */}
        <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', padding: '14px 4px', marginBottom: '20px', cursor: 'default' }}>
          <div style={{ textAlign: 'center', padding: '0 6px' }}>
            <p className="num-font" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)' }}>
              {vendor.rating ? <><span style={{ color: 'var(--gold)' }}>★</span> {vendor.rating.toFixed(1)}</> : '—'}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '2px' }}>
              {vendor.reviewCount ? `${vendor.reviewCount} ${vendor.reviewCount === 1 ? 'review' : 'reviews'}` : 'New on ETA'}
            </p>
          </div>
          <div style={{ textAlign: 'center', padding: '0 6px', borderLeft: '0.5px solid var(--separator)', borderRight: '0.5px solid var(--separator)' }}>
            <p className="num-font" style={{ fontSize: '20px', fontWeight: 700 }}>
              <span style={{ color: cat.color }}>{'$'.repeat(tier)}</span>
              <span style={{ color: 'var(--label-tertiary)', opacity: 0.5 }}>{'$'.repeat(4 - tier)}</span>
            </p>
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '2px' }}>{cat.priceNoun || 'price'}</p>
          </div>
          <div style={{ textAlign: 'center', padding: '0 6px' }}>
            <p style={{ fontSize: '17px', fontWeight: 700, color: vendor.open ? 'var(--success)' : 'var(--label-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', minHeight: '28px' }}>
              <span className={vendor.open ? 'open-dot' : 'closed-dot'} /> {vendor.open ? 'Open' : 'Closed'}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '2px' }}>{vendor.live ? `${vendor.whoThere} here now` : 'right now'}</p>
          </div>
        </div>

        {saved && (!alertsOn || alertMsg) && (
          <div className="card" style={{ padding: '12px 14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'default' }}>
            <Icon name="bell" size={18} style={{ color: 'var(--rum-text)', flexShrink: 0 }} />
            <p style={{ flex: 1, fontSize: '14px', color: 'var(--label-primary)' }}>
              {alertMsg ?? `Get a heads-up when ${vendor.name} goes live or drops a flash deal.`}
            </p>
            {!alertsOn && (
              <button className="btn btn-secondary" style={{ minHeight: '36px', padding: '0 12px', fontSize: '14px' }} onClick={turnOnLiveAlerts}>Turn on</button>
            )}
          </div>
        )}

        {/* About */}
        <div style={{ marginBottom: '28px' }}>
          <div className="section-header"><div className="section-heading"><span className="section-title">About</span></div></div>
          <p style={{ fontSize: '15px', lineHeight: 1.55, color: 'var(--label-primary)' }}>
            {vendor.description}
          </p>
        </div>

        {/* Good to know */}
        {(goodToKnow.length > 0 || (vendor.accessibility && vendor.accessibility.length > 0) || vendor.instagram || vendor.website) && (
          <div style={{ marginBottom: '28px' }}>
            <div className="section-header"><div className="section-heading"><span className="section-title">Good to know</span></div></div>
            <div className="card" style={{ padding: '4px 16px', cursor: 'default' }}>
              {goodToKnow.map((g, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '0.5px solid var(--separator)' }}>
                  <Icon name={g.icon} size={18} style={{ color: cat.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '15px', color: 'var(--label-primary)' }}>{g.text}</span>
                </div>
              ))}
              {vendor.accessibility && vendor.accessibility.length > 0 && (
                <div style={{ padding: '12px 0', borderBottom: '0.5px solid var(--separator)' }} aria-label="Accessibility">
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>Accessibility (confirmed by the vendor)</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {vendor.accessibility.map(k => (
                      <span key={k} className="chip" style={{ cursor: 'default', minHeight: '32px', padding: '4px 12px', fontSize: '13px' }}>♿ {accessibilityLabel(k)}</span>
                    ))}
                  </div>
                </div>
              )}
              {vendor.instagram && (
                <a href={vendor.instagram} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: vendor.website ? '0.5px solid var(--separator)' : 'none', color: 'var(--label-primary)', textDecoration: 'none' }}>
                  <Icon name="instagram" size={18} style={{ color: cat.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '15px' }}>Instagram</span>
                  <Icon name="chevronRight" size={16} style={{ color: 'var(--label-tertiary)' }} />
                </a>
              )}
              {vendor.website && (
                <a href={vendor.website} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', color: 'var(--label-primary)', textDecoration: 'none' }}>
                  <Icon name="globe" size={18} style={{ color: cat.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '15px' }}>Website</span>
                  <Icon name="chevronRight" size={16} style={{ color: 'var(--label-tertiary)' }} />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Menu (defensive) */}
        <MenuSection menu={vendor.menu} />

        {/* Flash deals */}
        {vendor.flashDeals.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
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
          <div style={{ marginBottom: '32px' }}>
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
          <div style={{ marginBottom: '32px' }}>
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

        {/* Location */}
        <div style={{ marginBottom: '32px' }}>
          <div className="section-header"><div className="section-heading"><span className="section-title">Location</span></div></div>
          <div className="card" style={{ overflow: 'hidden', cursor: 'default' }}>
            <div style={{ position: 'relative', height: '180px' }}>
              <iframe src={mapSrc} title={`Map showing ${vendor.name}`} loading="lazy" tabIndex={-1} style={{ width: '100%', height: '100%', border: 0, pointerEvents: 'none' }} />
            </div>
            <button onClick={handleDirections} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <Icon name="mapPin" size={18} style={{ color: cat.color, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{vendor.neighborhood}</span>
                <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>{formatCity(vendor.city)} · Get directions</span>
              </span>
              <Icon name="chevronRight" size={16} style={{ color: 'var(--label-tertiary)' }} />
            </button>
          </div>
        </div>

        {/* Reviews */}
        <div style={{ marginBottom: '32px' }}>
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
            <>
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', marginBottom: '12px', cursor: 'default' }}>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <p className="num-font" style={{ fontSize: '36px', fontWeight: 700, color: 'var(--label-primary)', lineHeight: 1 }}>{vendor.rating?.toFixed(1)}</p>
                  <p style={{ color: 'var(--gold)', fontSize: '13px', marginTop: '4px' }}>{'★'.repeat(Math.round(vendor.rating ?? 0))}</p>
                  <p style={{ fontSize: '12px', color: 'var(--label-secondary)' }}>{vendor.reviews.length} {vendor.reviews.length === 1 ? 'review' : 'reviews'}</p>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {ratingCounts.map(({ n, count }) => (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--label-secondary)' }}>
                      <span className="num-font" style={{ width: '10px' }}>{n}</span>
                      <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--system-bg-secondary)', overflow: 'hidden' }}>
                        <div style={{ width: `${(count / vendor.reviews.length) * 100}%`, height: '100%', background: 'var(--gold)' }} />
                      </div>
                      <span className="num-font" style={{ width: '16px', textAlign: 'right' }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
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
            </>
          )}
        </div>

        {/* More like this */}
        {related.length > 0 && (
          <div>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">More {cat.label.toLowerCase()} nearby</span>
                <span className="section-title">You might also like</span>
              </div>
            </div>
            <div className="grid-2">
              {related.map(r => <VendorCard key={r.id} vendor={r} variant="tile" />)}
            </div>
          </div>
        )}
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
        <button className="btn btn-secondary" style={{ flex: 1, padding: '0 12px', whiteSpace: 'nowrap', fontSize: '16px' }} onClick={() => setShowAddToTrip(true)}>
          <Icon name="plus" size={16} />
          Add to trip
        </button>
        <button className="btn btn-secondary" style={{ flex: showPayButton ? undefined : 1, padding: showPayButton ? '0 14px' : undefined }} onClick={handleDirections} aria-label="Get directions">
          <Icon name="mapPin" size={16} />
          {showPayButton ? null : 'Directions'}
        </button>
        {showPayButton && (
          <button className="btn btn-primary" style={{ flex: 1, padding: '0 12px', whiteSpace: 'nowrap', fontSize: '16px' }} onClick={() => router.push('/pay')}>
            <Icon name="card" size={16} />
            Pay Here
          </button>
        )}
      </div>

      <AddToTripSheet vendor={showAddToTrip ? { id: vendor.id, name: vendor.name } : null} onClose={() => setShowAddToTrip(false)} />
    </main>
  )
}
