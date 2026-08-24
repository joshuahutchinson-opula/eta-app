// app/page.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import LongPressCard from '@/components/LongPressCard'
import BrandedRefresh from '@/components/BrandedRefresh'
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
  videos: string[]
  open: boolean
  live: boolean
  isPremium: boolean
  whoThere: number
  rating?: number
  reviewCount?: number
  stories: Array<{ id: string; content: string; type: string; imageUrl: string }>
}

interface Experience {
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
  stopCount?: number
  totalDuration?: number
  travelIncluded?: boolean
  stops?: Array<{ id: string; name: string; type: string }>
  vendor?: { name: string; isPremium?: boolean }
  moods?: Array<{ id: string; name: string; icon: string }>
  rating?: number
  reviewCount?: number
}

interface Mood {
  id: string
  name: string
  icon: string
  description: string
  coverImage: string
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

const STORY_EXAMPLES = [
  { id: 'your-story', name: 'Your Story', type: 'user', image: '' },
  { id: 'story-1', name: 'Rick\'s', type: 'premium', image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=100&h=100&fit=crop' },
  { id: 'story-2', name: 'Pork Pit', type: 'standard', image: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=100&h=100&fit=crop' },
  { id: 'story-3', name: 'Catamaran', type: 'premium', image: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=100&h=100&fit=crop' },
  { id: 'story-4', name: 'Blue Hole', type: 'standard', image: 'https://images.unsplash.com/photo-1519111830404-c95d1a4d7332?w=100&h=100&fit=crop' },
  { id: 'story-5', name: 'Beach', type: 'standard', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=100&h=100&fit=crop' }
]

const EDITORIAL_SUBHEADS: Record<string, string> = {
  'Push Cart': 'Smoke and spice, the real deal',
  'Coral Reef Bar': 'Rum punch and good vibes',
  'MoBay Jerk House': 'The official taste of MoBay',
  'MoBay Watersports': 'Where the reef comes alive'
}

function formatCategory(category: string): string {
  return category.charAt(0) + category.slice(1).toLowerCase()
}

export default function HomePage() {
  const router = useRouter()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [moods, setMoods] = useState<Mood[]>([])
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const featuredScrollRef = useRef<HTMLDivElement>(null)
  const moodPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchAll()
  }, [])

  useEffect(() => {
    const featuredList = vendors.filter(v => v.isPremium && v.videos && v.videos.length > 0).slice(0, 5)
    if (featuredList.length <= 1) return

    const autoScroll = setInterval(() => {
      setFeaturedIndex(prevIndex => {
        const nextIndex = (prevIndex + 1) % featuredList.length
        if (featuredScrollRef.current) {
          featuredScrollRef.current.scrollTo({
            left: nextIndex * featuredScrollRef.current.clientWidth,
            behavior: 'smooth'
          })
        }
        return nextIndex
      })
    }, 5000)

    return () => clearInterval(autoScroll)
  }, [vendors])

  const fetchAll = async () => {
    try {
      const [vendorsRes, experiencesRes, moodsRes] = await Promise.allSettled([
        fetch('/api/vendors'),
        fetch('/api/experiences'),
        fetch('/api/moods')
      ])

      if (vendorsRes.status === 'fulfilled' && vendorsRes.value.ok) {
        const data = await vendorsRes.value.json()
        setVendors(Array.isArray(data) ? data : [])
      }
      if (experiencesRes.status === 'fulfilled' && experiencesRes.value.ok) {
        const data = await experiencesRes.value.json()
        setExperiences(Array.isArray(data) ? data : [])
      }
      if (moodsRes.status === 'fulfilled' && moodsRes.value.ok) {
        const data = await moodsRes.value.json()
        const mappedMoods = data.map((mood: Mood) => {
          let name = mood.name
          if (name === 'Out Til Sunrise') name = 'Party Time'
          if (name === 'Golden Hour') name = 'Sunset Chaser'
          return { ...mood, name, icon: MOOD_ICONS[name] || mood.icon }
        })
        setMoods(mappedMoods)
      }
    } catch (error) {
      console.error('Fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }

  const featuredVendors = vendors.filter(v => v.isPremium && v.videos && v.videos.length > 0).slice(0, 5)

  const trendingVendors = [...vendors]
    .filter(v => v.live)
    .sort((a, b) => (b.whoThere || 0) - (a.whoThere || 0))
    .slice(0, 6)

  const handleFeaturedScroll = () => {
    if (featuredScrollRef.current) {
      const scrollLeft = featuredScrollRef.current.scrollLeft
      const cardWidth = featuredScrollRef.current.clientWidth
      const newIndex = Math.round(scrollLeft / cardWidth)
      setFeaturedIndex(Math.min(newIndex, featuredVendors.length - 1))
    }
  }

  const snapMoodToCentre = (moodId: string) => {
    setSelectedMood(selectedMood === moodId ? null : moodId)
    if (moodPickerRef.current) {
      const pill = moodPickerRef.current.querySelector(`[data-mood="${moodId}"]`)
      if (pill) {
        pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }
    }
  }

  const filteredExperiences = selectedMood 
    ? experiences.filter(e => e.moods?.some(m => m.id === selectedMood || m.name === selectedMood))
    : experiences

  const filteredVendors = selectedMood
    ? vendors.filter(v => v.category === selectedMood || v.neighborhood === selectedMood)
    : vendors

  if (loading) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)' }}>
        <div style={{ padding: '16px', paddingBottom: '100px' }}>
          <div className="skeleton-card" style={{ width: '64px', height: '64px', borderRadius: '50%', marginBottom: '16px' }}>
            <div className="skeleton-image" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
          </div>
          <div className="skeleton-card" style={{ height: '380px', marginBottom: '24px' }}>
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

      <div className="content-fade-in">
        {/* Greeting */}
        <div style={{ padding: '16px 16px 0' }}>
          <h1 className="greeting-text">Wah Gwan, Jordan</h1>
        </div>

        {/* Stories */}
        <div style={{ padding: '8px 16px 0' }}>
          <div className="horizontal-scroll" style={{ padding: '0 0 4px' }}>
            {STORY_EXAMPLES.map(story => (
              story.type === 'user' ? (
                <div key={story.id} style={{ textAlign: 'center', flexShrink: 0, cursor: 'pointer' }}>
                  <div className="story-ring standard">
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px dashed var(--label-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="camera" size={18} />
                    </div>
                  </div>
                  <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--label-secondary)', marginTop: '4px' }}>{story.name}</p>
                </div>
              ) : (
                <Link key={story.id} href="/stories" style={{ textDecoration: 'none', textAlign: 'center', flexShrink: 0 }}>
                  <div className={`story-ring ${story.type === 'premium' ? 'premium' : 'standard'}`}>
                    <img src={story.image} alt={story.name} />
                  </div>
                  <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--label-secondary)', marginTop: '4px' }}>{story.name}</p>
                </Link>
              )
            ))}
          </div>
        </div>

        {/* Divider below stories */}
        <div className="divider-faded" />

        {/* Featured / Destinations */}
        <div style={{ padding: '0 16px 12px' }}>
          <div className="section-heading">
            <span className="section-eyebrow">Featured</span>
            <span className="section-title">Destinations</span>
          </div>
        </div>

        {/* Featured Cards */}
        {featuredVendors.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div
              ref={featuredScrollRef}
              onScroll={handleFeaturedScroll}
              className="horizontal-scroll"
              style={{ padding: '8px 16px 12px', scrollSnapType: 'x mandatory' }}
            >
              {featuredVendors.map((vendor, index) => (
                <Link
                  key={vendor.id}
                  href={`/vendor/${vendor.id}`}
                  style={{ textDecoration: 'none', flexShrink: 0, width: '100%', scrollSnapAlign: 'center' }}
                >
                  <div className="featured-hero" style={{ margin: '0 4px' }}>
                    {vendor.videos && vendor.videos.length > 0 ? (
                      <video
                        ref={(el) => {
                          if (el && index === featuredIndex) {
                            el.muted = true
                            el.playsInline = true
                            el.play().catch(() => {})
                          }
                        }}
                        src={vendor.videos[0]}
                        muted
                        loop
                        playsInline
                        preload="auto"
                        poster={vendor.images[0]}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <img src={vendor.images[0]} alt={vendor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <div className="featured-hero-overlay" />
                    {vendor.live && (
                      <div className="featured-hero-badge">
                        <span className="live-dot" />
                        <span className="num-font">{vendor.whoThere}</span> here now
                      </div>
                    )}
                    <div className="featured-hero-content">
                      <h2 className="featured-hero-title">{vendor.name}</h2>
                      <p className="featured-hero-sub">
                        {EDITORIAL_SUBHEADS[vendor.name] || `${formatCategory(vendor.category)} · ${vendor.neighborhood}`}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {featuredVendors.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                {featuredVendors.map((_, i) => (
                  <div key={i} style={{ width: i === featuredIndex ? '16px' : '6px', height: '6px', borderRadius: '3px', background: i === featuredIndex ? 'var(--rum)' : 'var(--separator)', transition: 'all 0.3s ease' }} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Trending / Promotions */}
        {trendingVendors.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
              <div className="section-heading">
                <span className="section-eyebrow">Promotions</span>
                <span className="section-title">Try Something New!</span>
              </div>
            </div>
            <div className="horizontal-scroll" style={{ padding: '4px 16px 12px' }}>
              {trendingVendors.map(v => (
                <Link key={v.id} href={`/vendor/${v.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                  <div className="card" style={{ width: '180px' }}>
                    <div className="card-image" style={{ height: '110px' }}>
                      <img src={v.images[0]} alt={v.name} />
                      {v.live && (
                        <div className="card-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="live-dot" />
                          <span className="num-font">{v.whoThere}</span> here now
                        </div>
                      )}
                    </div>
                    <div className="card-content">
                      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '2px' }}>{v.name}</p>
                      <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{formatCategory(v.category)} · {v.neighborhood}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Divider above moods with extra spacing */}
        <div className="divider-faded" style={{ marginBottom: '48px' }} />

        {/* Moods */}
        {moods.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ padding: '0 16px 12px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)' }}>
                Choose Your Vibe
              </h2>
            </div>
            <div className="mood-picker" ref={moodPickerRef}>
              {moods.map(mood => (
                <button
                  key={mood.id}
                  data-mood={mood.id}
                  onClick={() => snapMoodToCentre(mood.id)}
                  className={`mood-pill ${selectedMood === mood.id ? 'centre' : ''}`}
                >
                  <Icon name={mood.icon as any} size={16} />
                  {mood.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Experiences */}
        {filteredExperiences.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div className="section-header" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
              <div className="section-heading">
                <span className="section-eyebrow">Curated for You</span>
                <span className="section-title">Experiences</span>
              </div>
              <Link href="/experiences" className="section-link">See All</Link>
            </div>
            <div className="horizontal-scroll" style={{ padding: '4px 16px 12px' }}>
              {filteredExperiences.slice(0, 4).map(e => (
                <Link key={e.id} href="/experiences" style={{ textDecoration: 'none', flexShrink: 0 }}>
                  <div className="card" style={{ width: '260px' }}>
                    <div className="card-image" style={{ height: '140px' }}>
                      <img src={e.imageUrl} alt={e.name} />
                      <div className="card-overlay" />
                    </div>
                    <div className="card-content">
                      <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '2px' }}>{e.name}</h3>
                      <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '6px' }}>{e.tagline}</p>
                      {e.rating && (
                        <div className="rating-text" style={{ marginBottom: '6px' }}>
                          ★ <span className="num-font">{e.rating}</span>
                          {e.reviewCount && <span> · <span className="num-font">{e.reviewCount}</span></span>}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="card-price">${e.price}</span>
                        <span className="num-font" style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>
                          {e.stops ? `${e.stops.length} stops` : '3 stops'} · {e.totalDuration ? `${e.totalDuration} hrs` : '4 hrs'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Vendor list */}
        {filteredVendors.length > 0 && (
          <div style={{ padding: '0 16px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">Close By</span>
                <span className="section-title">Near You Now</span>
              </div>
              <Link href="/vendors" className="section-link">See All</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredVendors.slice(0, 5).map(v => (
                <Link key={v.id} href={`/vendor/${v.id}`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ display: 'flex', gap: '12px', padding: '12px' }}>
                    <div style={{ width: '100px', height: '100px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={v.images[0]} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '2px' }}>{v.name}</p>
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
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dock />
    </main>
  )
}