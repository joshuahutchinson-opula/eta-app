// app/vendor/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Icon from '@/lib/icons'
import { hapticSaved } from '@/lib/haptics'
import { useErrorText, useLang, usePatois } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import BackButtonShared from '@/components/BackButton'
import VendorMenu, { type MenuItemView } from '@/components/VendorMenu'
import PopularTimes from '@/components/PopularTimes'
import Img from '@/components/Img'
import SmartVideo from '@/components/SmartVideo'
import { readSaved, toggleSaved as toggleSavedId } from '@/lib/saved'
import { directionsUrl } from '@/lib/calendar'
import type { PopularTimes as PopularTimesData } from '@/lib/popular-times'
import AddToTripSheet from '@/components/AddToTripSheet'
import { alertsEnabled, enableAlerts, syncAlerts } from '@/lib/alerts-client'
import { accessibilityLabel } from '@/lib/accessibility'
import { categoryStyle, priceTier } from '@/lib/vendor-style'
import VendorCard, { type VendorCardVendor } from '@/components/VendorCard'
import Price from '@/components/Price'
import CheckInButton from '@/components/CheckInButton'
import ReviewSheet from '@/components/ReviewSheet'
import QRCode from '@/components/QRCode'
import ErrorState from '@/components/ErrorState'
import { DAYS, formatTime, openState, parseHours } from '@/lib/hours'
import { shareOrCopy } from '@/lib/share'
import { authHeaders } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { jamaicaToday } from '@/lib/pricing'

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
  hours?: unknown
  phone?: string | null
  whatsapp?: string | null
  acceptsReservations?: boolean
  menu: any
  menuItems: MenuItemView[]
  popularTimes: PopularTimesData | null
  rating?: number
  reviewCount?: number
  stories: StoryItem[]
  reviews: ReviewItem[]
  experiences: ExperienceItem[]
  flashDeals: FlashDealItem[]
}

import { formatCity } from '@/lib/format'
import { absoluteUrl } from '@/lib/site-url'
import ReportButton from '@/components/ReportButton'
import { responseError } from '@/lib/errors'

type T = ReturnType<typeof useLang>['t']

function formatCountdown(expires: string, t: T): string {
  const diffMs = new Date(expires).getTime() - Date.now()
  if (diffMs <= 0) return t('m.vendor.ended')
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return t('m.vendor.endsInMin', { m: diffMin })
  return t('m.vendor.endsInHours', { h: Math.floor(diffMin / 60), m: diffMin % 60 })
}

function formatDate(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
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
  const { t } = useLang()
  if (Array.isArray(menu)) {
    if (menu.length === 0) return null
    return (
      <div style={{ marginBottom: '32px' }}>
        <div className="section-header">
          <div className="section-heading">
            <span className="section-title">{t('m.vendor.menu')}</span>
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
            <span className="section-title">{t('m.vendor.menu')}</span>
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
  const { t, lang } = useLang()
  const errorText = useErrorText()
  const labels = useLabels()
  const locale = lang === 'en' ? 'en-US' : lang
  const params = useParams()
  const router = useRouter()
  const vendorId = params.id as string
  // Adding to a trip belongs to the Experiences flow; from Market/Home the vendor is just browsed.
  const fromExperiences = useSearchParams().get('from') === 'experiences'

  const [vendor, setVendor] = useState<VendorDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showAddToTrip, setShowAddToTrip] = useState(false)
  const [alertsOn, setAlertsOn] = useState(true)
  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const [slide, setSlide] = useState(0)
  const [related, setRelated] = useState<VendorCardVendor[]>([])
  const [loadFailed, setLoadFailed] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [voucher, setVoucher] = useState<{ code: string; deal: string; expires: string } | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [resvOpen, setResvOpen] = useState(false)
  const [resv, setResv] = useState({ date: jamaicaToday(), time: '19:00', partySize: 2, note: '' })
  const [resvState, setResvState] = useState<{ busy: boolean; error: string | null; sent: boolean }>({ busy: false, error: null, sent: false })

  useEffect(() => {
    fetchVendor()
    alertsEnabled().then(setAlertsOn).catch(() => setAlertsOn(false))
    setSaved(readSaved('vendors').includes(vendorId))
  }, [vendorId])

  const fetchVendor = async () => {
    setLoading(true)
    setNotFound(false)
    setLoadFailed(false)
    try {
      const res = await fetch(`/api/vendors/${vendorId}`)
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      if (!res.ok) throw new Error('vendor')
      const data = await res.json()
      setVendor(data)
      fetchRelated(data)
    } catch (error) {
      console.error(error)
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }

  const share = async () => {
    if (!vendor) return
    const result = await shareOrCopy({ title: vendor.name, text: `${vendor.name} on ETA`, url: absoluteUrl(`/vendor/${vendor.id}`) })
    if (result === 'copied') { setShareMsg(t('m.events.linkCopied')); setTimeout(() => setShareMsg(null), 1800) }
  }

  const claimDeal = async (dealId: string) => {
    if (!getCurrentUser()) { router.push('/login'); return }
    setClaiming(dealId)
    setClaimError(null)
    try {
      const res = await fetch(`/api/flashdeals/${dealId}/claim`, { method: 'POST', headers: authHeaders() })
      if (!res.ok) throw await responseError(res)
      const data = await res.json()
      hapticSaved()
      setVoucher({ code: data.code, deal: data.deal, expires: data.expires })
    } catch (e) {
      setClaimError(errorText(e))
    } finally {
      setClaiming(null)
    }
  }

  const requestReservation = async () => {
    if (!vendor) return
    if (!getCurrentUser()) { router.push('/login'); return }
    setResvState({ busy: true, error: null, sent: false })
    try {
      const res = await fetch('/api/reservations', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ vendorId: vendor.id, ...resv }) })
      if (!res.ok) throw await responseError(res)
      hapticSaved()
      setResvState({ busy: false, error: null, sent: true })
    } catch (e) {
      setResvState({ busy: false, error: errorText(e), sent: false })
    }
  }

  // Same category in the same city first, topped up from the same neighborhood.
  const fetchRelated = async (v: VendorDetail) => {
    try {
      const all: Array<VendorCardVendor & { city: string }> = await (await fetch(`/api/vendors?city=${v.city}&limit=40`)).json()
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
    setSaved(toggleSavedId('vendors', vendor.id))
    syncAlerts()
  }

  // Saving a vendor is the natural moment to offer its live alert (B4).
  const turnOnLiveAlerts = async () => {
    setAlertMsg(null)
    try {
      await enableAlerts({ liveAlerts: true, dealAlerts: true })
      setAlertsOn(true)
      setAlertMsg(t('m.vendor.alertsOn'))
    } catch (e) {
      setAlertMsg(errorText(e))
    }
  }

  const handleDirections = () => {
    if (!vendor) return
    const url = directionsUrl({ lat: vendor.lat, lng: vendor.lng, name: vendor.name })
    if (url) window.open(url, '_blank')
  }

  const BackButton = <BackButtonShared floating fallback="/marketplace" />

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

  if (loadFailed) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        {BackButton}
        <ErrorState onRetry={fetchVendor} />
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
          <p>{t('m.vendor.gone')}</p>
          <button className="btn btn-primary" onClick={() => router.push('/vendors')} style={{ marginTop: '8px' }}>
            {t('m.vendor.backToVendors')}
          </button>
        </div>
      </main>
    )
  }

  const hours = parseHours(vendor.hours)
  const hoursState = hours ? openState(hours) : null
  const isOpen = hoursState ? hoursState.open : vendor.open
  const todayIdx = new Date(Date.now() - 5 * 3600000).getUTCDay()
  const hoursDetail = hoursState?.detail
    ? hoursState.detail.kind === 'closes'
      ? t('m.vendor.closes', { time: formatTime(hoursState.detail.time) })
      : t(hoursState.detail.dayOffset === 0 ? 'm.vendor.opensToday' : hoursState.detail.dayOffset === 1 ? 'm.vendor.opensTomorrow' : 'm.vendor.opensLater', { time: formatTime(hoursState.detail.time), day: t(`m.day.${DAYS[(todayIdx + hoursState.detail.dayOffset) % 7]}` as 'm.day.mon') })
    : null
  const waLink = vendor.whatsapp ? `https://wa.me/${vendor.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${vendor.name}, I found you on ETA.`)}` : null
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
    vendor.tipsJar && { icon: 'gift', text: t('m.vendor.tipsJar') },
    vendor.payItForward && { icon: 'heart', text: t('m.vendor.payItForward') },
    vendor.isPremium && { icon: 'crown', text: t('m.bon.member') },
    vendor.live && { icon: 'users', text: t('m.vendor.travelersHere', { n: vendor.whoThere }) }
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
          {media.map((m, i) => (
            <div key={m.src} style={{ flex: '0 0 100%', width: '100%', height: '100%', scrollSnapAlign: 'start' }}>
              {m.type === 'video'
                ? <SmartVideo src={m.src} poster={vendor.images[0]} alt={vendor.name} active={slide === i} />
                : <Img src={m.src} alt={vendor.name} width={1080} height={900} priority={i === 0} />}
            </div>
          ))}
        </div>
        <div className="featured-hero-overlay" style={{ pointerEvents: 'none' }} />

        {vendor.isPremium && (
          <div className="card-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', left: 'auto', right: '12px', top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
            <Icon name="crown" size={11} />
            {t('common.premium')}
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
            <span className="num-font">{vendor.whoThere}</span> {t('m.home.hereNow')}
          </div>
        )}
      </div>

      <div style={{ padding: '20px 16px' }}>
        {/* Name / category */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '999px', background: `${cat.color}1F`, color: cat.color, fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
          <Icon name={cat.icon} size={12} /> {labels.category(vendor.category)}
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
              {vendor.reviewCount ? `${vendor.reviewCount} ${vendor.reviewCount === 1 ? t('m.common.review1') : t('m.common.reviewsN')}` : t('m.common.newOnEta')}
            </p>
          </div>
          <div style={{ textAlign: 'center', padding: '0 6px', borderLeft: '0.5px solid var(--separator)', borderRight: '0.5px solid var(--separator)' }}>
            <p className="num-font" style={{ fontSize: '20px', fontWeight: 700 }}>
              <span style={{ color: cat.color }}>{'$'.repeat(tier)}</span>
              <span style={{ color: 'var(--label-tertiary)', opacity: 0.5 }}>{'$'.repeat(4 - tier)}</span>
            </p>
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '2px' }}>{labels.priceNoun(vendor.category) || t('m.priceNoun.OTHER')}</p>
          </div>
          <div style={{ textAlign: 'center', padding: '0 6px' }}>
            <p style={{ fontSize: '17px', fontWeight: 700, color: isOpen ? 'var(--success)' : 'var(--label-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', minHeight: '28px' }}>
              <span className={isOpen ? 'open-dot' : 'closed-dot'} /> {isOpen ? t('common.open') : t('common.closed')}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '2px' }}>{hoursDetail ?? (vendor.live ? `${vendor.whoThere} ${t('m.home.hereNow')}` : t('m.vendor.rightNow'))}</p>
          </div>
        </div>

        {/* Contact & actions — each shows only when the vendor has listed it */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {vendor.phone && (
            <a href={`tel:${vendor.phone.replace(/[^+\d]/g, '')}`} className="chip" style={{ textDecoration: 'none', flex: 1, justifyContent: 'center' }}><Icon name="audio" size={14} /> {t('m.vendor.call')}</a>
          )}
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="chip" style={{ textDecoration: 'none', flex: 1, justifyContent: 'center' }}><Icon name="journal" size={14} /> WhatsApp</a>
          )}
          {vendor.acceptsReservations && (
            <button className="chip" onClick={() => { setResvState({ busy: false, error: null, sent: false }); setResvOpen(true) }} style={{ flex: 1, justifyContent: 'center' }}><Icon name="clock" size={14} /> {t('m.vendor.reserve')}</button>
          )}
          <button className="chip" onClick={share} style={{ flex: 1, justifyContent: 'center' }}><Icon name="share" size={14} /> {shareMsg ?? t('m.events.share')}</button>
        </div>

        {hours && (
          <div className="card" style={{ padding: '8px 16px', marginBottom: '20px', cursor: 'default' }} aria-label={t('m.vendor.hours')}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label-secondary)', padding: '6px 0' }}>{t('m.vendor.hours')}</p>
            {[1, 2, 3, 4, 5, 6, 0].map(d => {
              const ranges = hours[DAYS[d]] ?? []
              return (
                <div key={d} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '14px', fontWeight: d === todayIdx ? 700 : 400, color: d === todayIdx ? 'var(--label-primary)' : 'var(--label-secondary)' }}>
                  <span>{t(`m.day.${DAYS[d]}` as 'm.day.mon')}</span>
                  <span className="num-font">{ranges.length ? ranges.map(([a, b]) => `${formatTime(a)} – ${formatTime(b)}`).join(', ') : t('common.closed')}</span>
                </div>
              )
            })}
          </div>
        )}

        <PopularTimes data={vendor.popularTimes} />

        {vendor.lat && vendor.lng ? <CheckInButton target={{ kind: 'vendor', id: vendor.id, lat: vendor.lat, lng: vendor.lng }} /> : null}

        {saved && (!alertsOn || alertMsg) && (
          <div className="card" style={{ padding: '12px 14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'default' }}>
            <Icon name="bell" size={18} style={{ color: 'var(--rum-text)', flexShrink: 0 }} />
            <p style={{ flex: 1, fontSize: '14px', color: 'var(--label-primary)' }}>
              {alertMsg ?? t('m.vendor.alertPrompt', { name: vendor.name })}
            </p>
            {!alertsOn && (
              <button className="btn btn-secondary" style={{ minHeight: '36px', padding: '0 12px', fontSize: '14px' }} onClick={turnOnLiveAlerts}>{t('m.vendor.turnOn')}</button>
            )}
          </div>
        )}

        {/* About */}
        <div style={{ marginBottom: '28px' }}>
          <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.vendor.about')}</span></div></div>
          <p style={{ fontSize: '15px', lineHeight: 1.55, color: 'var(--label-primary)' }}>
            {vendor.description}
          </p>
        </div>

        {/* Good to know */}
        {(goodToKnow.length > 0 || (vendor.accessibility && vendor.accessibility.length > 0) || vendor.instagram || vendor.website) && (
          <div style={{ marginBottom: '28px' }}>
            <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.vendor.goodToKnow')}</span></div></div>
            <div className="card" style={{ padding: '4px 16px', cursor: 'default' }}>
              {goodToKnow.map((g, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '0.5px solid var(--separator)' }}>
                  <Icon name={g.icon} size={18} style={{ color: cat.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '15px', color: 'var(--label-primary)' }}>{g.text}</span>
                </div>
              ))}
              {vendor.accessibility && vendor.accessibility.length > 0 && (
                <div style={{ padding: '12px 0', borderBottom: '0.5px solid var(--separator)' }} aria-label={t('m.exp.accessibility')}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.vendor.accessConfirmed')}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {vendor.accessibility.map(k => (
                      <span key={k} className="chip" style={{ cursor: 'default', minHeight: '32px', padding: '4px 12px', fontSize: '13px' }}>♿ {labels.access(k)}</span>
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
                  <span style={{ flex: 1, fontSize: '15px' }}>{t('m.vendor.website')}</span>
                  <Icon name="chevronRight" size={16} style={{ color: 'var(--label-tertiary)' }} />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Menu: structured items when the vendor has them, else the older free-form menu */}
        {vendor.menuItems?.length ? <VendorMenu items={vendor.menuItems} /> : <MenuSection menu={vendor.menu} />}

        {/* Flash deals */}
        {vendor.flashDeals.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">{t('m.market.limited')}</span>
                <span className="section-title">{t('m.market.flashDeals')}</span>
              </div>
            </div>
            <div className="horizontal-scroll">
              {vendor.flashDeals.map(fd => (
                <div key={fd.id} className="card" style={{ width: '200px', cursor: 'default' }}>
                  <div className="card-image" style={{ height: '110px' }}>
                    {vendor.images[0] && <Img src={vendor.images[0]} alt={vendor.name} width={400} height={220} sizes="200px" />}
                    <div className="card-overlay" />
                  </div>
                  <div className="card-content">
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{fd.deal}</p>
                    <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Icon name="clock" size={12} />
                      {formatCountdown(fd.expires, t)}
                    </p>
                    <button className="btn btn-primary" onClick={() => claimDeal(fd.id)} disabled={claiming === fd.id} style={{ width: '100%', minHeight: '36px', fontSize: '14px', marginTop: '8px' }}>
                      {claiming === fd.id ? '…' : t('m.vendor.claim')}
                    </button>
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
                <span className="section-eyebrow">{t('m.vendor.fromVendor')}</span>
                <span className="section-title">{t('m.home.experiences')}</span>
              </div>
              <Link href="/experiences/browse" className="section-link">{t('m.common.seeAll')}</Link>
            </div>
            <div className="horizontal-scroll">
              {vendor.experiences.map(exp => (
                <Link key={exp.id} href={`/experiences/${exp.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                  <div className="card" style={{ width: '180px' }}>
                    <div className="card-image" style={{ height: '110px' }}>
                      {exp.imageUrl && <Img src={exp.imageUrl} alt={exp.name} width={360} height={220} sizes="180px" />}
                      <div className="card-overlay" />
                    </div>
                    <div className="card-content">
                      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '2px' }}>{exp.name}</p>
                      <Price usd={exp.price} className="card-price" />
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
                <span className="section-title">{t('m.vendor.recentStories')}</span>
              </div>
            </div>
            <div className="horizontal-scroll">
              {vendor.stories.map(story => (
                <Link key={story.id} href={`/stories?start=${vendor.id}`} aria-label={t('m.stories.open', { name: vendor.name })} style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div className={`story-ring ${vendor.isPremium ? 'premium' : 'standard'}`}>
                    {story.imageUrl && <img src={story.imageUrl} alt="" />}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Location */}
        <div style={{ marginBottom: '32px' }}>
          <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.vendor.location')}</span></div></div>
          <div className="card" style={{ overflow: 'hidden', cursor: 'default' }}>
            <div style={{ position: 'relative', height: '180px' }}>
              <iframe src={mapSrc} title={t('m.vendor.mapOf', { name: vendor.name })} loading="lazy" tabIndex={-1} style={{ width: '100%', height: '100%', border: 0, pointerEvents: 'none' }} />
            </div>
            <button onClick={handleDirections} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <Icon name="mapPin" size={18} style={{ color: cat.color, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{vendor.neighborhood}</span>
                <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>{formatCity(vendor.city)} · {t('m.vendor.getDirections')}</span>
              </span>
              <Icon name="chevronRight" size={16} style={{ color: 'var(--label-tertiary)' }} />
            </button>
          </div>
        </div>

        {/* Reviews */}
        <div style={{ marginBottom: '32px' }}>
          <div className="section-header">
            <div className="section-heading">
              <span className="section-title">{t('vendor.reviews')}</span>
            </div>
            <button className="section-link" onClick={() => (getCurrentUser() ? setReviewOpen(true) : router.push('/login'))} style={{ background: 'none', border: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
              <Icon name="star" size={14} /> {t('m.review.write')}
            </button>
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
                  <p style={{ fontSize: '12px', color: 'var(--label-secondary)' }}>{vendor.reviews.length} {vendor.reviews.length === 1 ? t('m.common.review1') : t('m.common.reviewsN')}</p>
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
                      <span style={{ fontSize: '12px', color: 'var(--label-tertiary)', flexShrink: 0 }}>{formatDate(r.createdAt, locale)}</span>
                    </div>
                    {r.comment && (
                      <p style={{ fontSize: '14px', color: 'var(--label-secondary)', lineHeight: 1.4 }}>{r.comment}</p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-6px', marginBottom: '-10px' }}><ReportButton targetType="REVIEW" targetId={r.id} /></div>
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
                <span className="section-eyebrow">{t('m.vendor.moreNearby', { category: labels.category(vendor.category).toLowerCase() })}</span>
                <span className="section-title">{t('m.vendor.alsoLike')}</span>
              </div>
            </div>
            <div className="grid-2">
              {related.map(r => <VendorCard key={r.id} vendor={r} variant="tile" href={fromExperiences ? `/vendor/${r.id}?from=experiences` : undefined} />)}
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
          aria-pressed={saved}
          aria-label={saved ? t('m.saved.unsave') : t('m.saved.save')}
          style={{ color: saved ? 'var(--rum)' : 'var(--label-secondary)' }}
        >
          <Icon name="heart" size={20} className={saved ? 'filled' : ''} />
        </button>
        {fromExperiences && (
          <button className="btn btn-secondary" style={{ flex: 1, padding: '0 12px', whiteSpace: 'nowrap', fontSize: '16px' }} onClick={() => setShowAddToTrip(true)}>
            <Icon name="plus" size={16} />
            {t('m.addTrip.title')}
          </button>
        )}
        <button className="btn btn-secondary" style={{ flex: showPayButton && fromExperiences ? undefined : 1, padding: showPayButton && fromExperiences ? '0 14px' : undefined }} onClick={handleDirections} aria-label={t('m.vendor.getDirections')}>
          <Icon name="navigate" size={16} />
          {showPayButton && fromExperiences ? null : t('m.nav.directions')}
        </button>
        {showPayButton && (
          <button className="btn btn-primary" style={{ flex: 1, padding: '0 12px', whiteSpace: 'nowrap', fontSize: '16px' }} onClick={() => router.push('/pay')}>
            <Icon name="card" size={16} />
            {t('m.vendor.payHere')}
          </button>
        )}
      </div>

      <ReviewSheet
        open={reviewOpen}
        vendorId={vendor.id}
        vendorName={vendor.name}
        onClose={() => setReviewOpen(false)}
        onPosted={r => setVendor(v => {
          if (!v) return v
          const reviews = [r, ...v.reviews]
          return { ...v, reviews, reviewCount: reviews.length, rating: Math.round((reviews.reduce((a, x) => a + x.rating, 0) / reviews.length) * 10) / 10 }
        })}
      />

      {/* Reservation request */}
      <div className={`bottom-sheet-overlay ${resvOpen ? 'open' : ''}`} onClick={() => setResvOpen(false)} />
      <div className={`bottom-sheet ${resvOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.vendor.reserve')}>
        <div className="sheet-grabber" />
        {resvOpen && (
          <div style={{ padding: '0 20px 24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '4px' }}>{t('m.vendor.reserveTitle', { name: vendor.name })}</h3>
            <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '14px' }}>{t('m.vendor.reserveNote')}</p>
            {resvState.sent ? (
              <div style={{ textAlign: 'center' }}>
                <div className="check-pop-in" style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}><Icon name="check" size={22} /></div>
                <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '16px' }}>{t('m.vendor.reserveSent')}</p>
                <button className="btn btn-primary" onClick={() => setResvOpen(false)} style={{ width: '100%' }}>{t('m.profile.done')}</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)' }}>
                    {t('m.book.date')}
                    <input type="date" min={jamaicaToday()} value={resv.date} onChange={e => setResv({ ...resv, date: e.target.value })} style={{ width: '100%', marginTop: '6px', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', color: 'var(--label-primary)', fontSize: '16px', fontFamily: 'inherit' }} />
                  </label>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)' }}>
                    {t('m.book.time')}
                    <input type="time" value={resv.time} onChange={e => setResv({ ...resv, time: e.target.value })} style={{ width: '100%', marginTop: '6px', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', color: 'var(--label-primary)', fontSize: '16px', fontFamily: 'inherit' }} />
                  </label>
                </div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '6px' }}>{t('m.book.party')}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                  <button className="heart-btn" aria-label={t('m.book.fewer')} disabled={resv.partySize <= 1} onClick={() => setResv({ ...resv, partySize: resv.partySize - 1 })} style={{ fontSize: '22px', color: 'var(--label-primary)' }}>−</button>
                  <span className="num-font" aria-live="polite" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)' }}>{resv.partySize}</span>
                  <button className="heart-btn" aria-label={t('m.book.more')} disabled={resv.partySize >= 30} onClick={() => setResv({ ...resv, partySize: resv.partySize + 1 })} style={{ fontSize: '22px', color: 'var(--label-primary)' }}>+</button>
                </div>
                <textarea value={resv.note} onChange={e => setResv({ ...resv, note: e.target.value })} placeholder={t('m.vendor.reserveNotePlaceholder')} aria-label={t('m.vendor.reserveNotePlaceholder')} rows={2} maxLength={280} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', color: 'var(--label-primary)', fontSize: '16px', fontFamily: 'inherit', marginBottom: '12px' }} />
                {resvState.error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{resvState.error}</p>}
                <button className="btn btn-primary" onClick={requestReservation} disabled={resvState.busy || !resv.date || !resv.time} style={{ width: '100%' }}>
                  {resvState.busy ? '…' : t('m.vendor.reserveSend')}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Flash deal voucher */}
      <div className={`bottom-sheet-overlay ${voucher ? 'open' : ''}`} onClick={() => setVoucher(null)} />
      <div className={`bottom-sheet ${voucher ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.vendor.voucher')}>
        <div className="sheet-grabber" />
        {voucher && (
          <div style={{ padding: '0 20px 24px', textAlign: 'center' }}>
            <p className="section-eyebrow">{t('m.vendor.voucher')}</p>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', margin: '2px 0 4px' }}>{voucher.deal}</h3>
            <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '16px' }}>{vendor.name} · {formatCountdown(voucher.expires, t)}</p>
            <QRCode value={voucher.code} size={200} />
            <p className="num-font" style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--label-primary)', marginTop: '12px' }}>{voucher.code}</p>
            <p style={{ fontSize: '13px', color: 'var(--label-secondary)', margin: '4px 0 16px' }}>{t('m.vendor.voucherShow')}</p>
            <button className="btn btn-tertiary" onClick={() => setVoucher(null)} style={{ width: '100%' }}>{t('m.profile.done')}</button>
          </div>
        )}
      </div>

      {claimError && (
        <div role="alert" style={{ position: 'fixed', left: '16px', right: '16px', bottom: '84px', zIndex: 30, padding: '12px 14px', borderRadius: '14px', background: 'var(--system-bg-elevated)', boxShadow: 'var(--shadow-elevated)', fontSize: '14px', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ flex: 1 }}>{claimError}</span>
          <button onClick={() => setClaimError(null)} aria-label={t('m.profile.done')} style={{ background: 'none', border: 'none', color: 'var(--label-secondary)', cursor: 'pointer', minWidth: '32px', minHeight: '32px' }}><Icon name="close" size={14} /></button>
        </div>
      )}

      {fromExperiences && (
        <AddToTripSheet vendor={showAddToTrip ? { id: vendor.id, name: vendor.name } : null} onClose={() => setShowAddToTrip(false)} />
      )}
    </main>
  )
}
