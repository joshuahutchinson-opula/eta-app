// app/vendor/[id]/page.tsx — a vendor, slimmed down: photos, the key facts
// and Book / Directions up top, then one tap row per topic (about, menu,
// hours, reviews, location, deals, experiences, stories, good to know) that
// opens its own sheet. Checking in (and paying) is Scan & Pay on the
// vendor's QR card.
'use client'

import { useEffect, useRef, useState } from 'react'
import { useMorphIn } from '@/lib/morph'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Icon from '@/lib/icons'
import { hapticSaved, triggerHaptic } from '@/lib/haptics'
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
import { categoryStyle, priceTier } from '@/lib/vendor-style'
import VendorCard, { type VendorCardVendor } from '@/components/VendorCard'
import Price from '@/components/Price'
import dynamic from 'next/dynamic'
import FairPriceBadge from '@/components/FairPriceBadge'
import ReviewSheet from '@/components/ReviewSheet'
import QRCode from '@/components/QRCode'
import ErrorState from '@/components/ErrorState'
import { DAYS, formatTime, openState, parseHours } from '@/lib/hours'
import { shareOrCopy } from '@/lib/share'
import { authHeaders } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { jamaicaToday } from '@/lib/pricing'
import { formatCity } from '@/lib/format'
import { absoluteUrl } from '@/lib/site-url'
import ReportButton from '@/components/ReportButton'
import { responseError } from '@/lib/errors'
import type { DictKey } from '@/lib/i18n'

const EtaMap = dynamic(() => import('@/components/map/EtaMap'), { ssr: false })

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
  fairPrice?: boolean
  locationStatus?: 'CONFIRMED' | 'UNCONFIRMED'
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

type SheetKey = 'about' | 'menu' | 'hours' | 'reviews' | 'location' | 'info' | 'deals' | 'experiences' | 'stories'

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
      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < items.length - 1 ? '0.5px solid var(--separator)' : 'none' }}>
        <span style={{ fontSize: '15px', color: 'var(--label-primary)' }}>{name}</span>
        {typeof price === 'number' ? (
          <Price usd={price} style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rum-text)' }} />
        ) : price ? (
          <span className="num-font" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rum-text)' }}>{price}</span>
        ) : null}
      </div>
    )
  })
}

/** The older free-form menu (Vendor.menu): a list, or sections of lists. */
function LegacyMenu({ menu }: { menu: any }) {
  if (Array.isArray(menu)) return menu.length ? <div className="card" style={{ padding: '0 16px', cursor: 'default' }}>{renderMenuItems(menu)}</div> : null
  if (menu && typeof menu === 'object') {
    return (
      <>
        {Object.entries(menu).map(([category, value], idx) => (
          <div key={idx} style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '6px' }}>{category}</p>
            <div className="card" style={{ padding: '0 16px', cursor: 'default' }}>
              {Array.isArray(value) ? renderMenuItems(value) : <p style={{ fontSize: '14px', color: 'var(--label-secondary)', padding: '10px 0' }}>{String(value)}</p>}
            </div>
          </div>
        ))}
      </>
    )
  }
  return null
}

function hasLegacyMenu(menu: any): boolean {
  return Array.isArray(menu) ? menu.length > 0 : Boolean(menu && typeof menu === 'object' && Object.keys(menu).length)
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
  // The tapped card's image grows into the hero (lib/morph.ts).
  const heroRef = useRef<HTMLDivElement>(null)
  useMorphIn(heroRef, Boolean(vendor))
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
  const [sheet, setSheet] = useState<SheetKey | null>(null)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setSheet(null)
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

  const openSheet = (key: SheetKey) => { triggerHaptic('light'); setSheet(key) }

  const BackButton = <BackButtonShared floating fallback="/marketplace" />

  if (loading) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)' }}>
        {BackButton}
        <div className="skeleton-card" style={{ height: '40vh' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
        <div style={{ padding: '16px' }}>
          <div className="skeleton-card" style={{ height: '26px', width: '60%', marginBottom: '10px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
          <div className="skeleton-card" style={{ height: '80px', marginBottom: '20px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
          <div className="skeleton-card" style={{ height: '220px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
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
          <button className="btn btn-primary" onClick={() => router.push('/vendors')} style={{ marginTop: '8px' }}>{t('m.vendor.backToVendors')}</button>
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
  const goodToKnow = [
    vendor.fairPrice && { icon: 'check', text: t('m.fair.note') },
    vendor.tipsJar && { icon: 'gift', text: t('m.vendor.tipsJar') },
    vendor.payItForward && { icon: 'heart', text: t('m.vendor.payItForward') },
    vendor.isPremium && { icon: 'crown', text: t('m.bon.member') },
    vendor.live && { icon: 'users', text: t('m.vendor.travelersHere', { n: vendor.whoThere }) }
  ].filter(Boolean) as Array<{ icon: string; text: string }>
  const hasInfo = goodToKnow.length > 0 || Boolean(vendor.accessibility?.length) || Boolean(vendor.instagram) || Boolean(vendor.website)
  const hasMenu = Boolean(vendor.menuItems?.length) || hasLegacyMenu(vendor.menu)

  // Book: a table request if they take them, else their experience(s), else a message or call.
  const book: { label: DictKey; run: () => void } | null = vendor.acceptsReservations
    ? { label: 'm.vendor.book', run: () => { setResvState({ busy: false, error: null, sent: false }); setResvOpen(true) } }
    : vendor.experiences.length === 1
      ? { label: 'm.vendor.book', run: () => router.push(`/experiences/${vendor.experiences[0].id}`) }
      : vendor.experiences.length > 1
        ? { label: 'm.vendor.book', run: () => openSheet('experiences') }
        : waLink
          ? { label: 'm.vendor.message', run: () => window.open(waLink, '_blank') }
          : vendor.phone
            ? { label: 'm.vendor.call', run: () => { window.location.href = `tel:${vendor.phone!.replace(/[^+\d]/g, '')}` } }
            : null

  const rows: Array<{ key: SheetKey; icon: string; label: string; detail?: string | null; show: boolean }> = [
    { key: 'about', icon: 'journal', label: t('m.vendor.about'), detail: vendor.description.slice(0, 60) + (vendor.description.length > 60 ? '…' : ''), show: Boolean(vendor.description) },
    { key: 'deals', icon: 'flame', label: t('m.market.flashDeals'), detail: vendor.flashDeals[0]?.deal, show: vendor.flashDeals.length > 0 },
    { key: 'menu', icon: 'food', label: t('m.vendor.menu'), detail: vendor.menuItems?.length ? t('m.vendor.itemsN', { n: vendor.menuItems.length }) : null, show: hasMenu },
    { key: 'hours', icon: 'clock', label: t('m.vendor.hours'), detail: hoursDetail ?? (isOpen ? t('common.open') : t('common.closed')), show: Boolean(hours) || Boolean(vendor.popularTimes) },
    { key: 'reviews', icon: 'star', label: t('vendor.reviews'), detail: vendor.reviewCount ? `★ ${vendor.rating?.toFixed(1)} · ${vendor.reviewCount}` : t('m.review.write'), show: true },
    { key: 'experiences', icon: 'route', label: t('m.home.experiences'), detail: vendor.experiences.length ? t('m.vendor.itemsN', { n: vendor.experiences.length }) : null, show: vendor.experiences.length > 0 },
    { key: 'stories', icon: 'camera', label: t('m.vendor.recentStories'), detail: t('m.vendor.itemsN', { n: vendor.stories.length }), show: vendor.stories.length > 0 },
    { key: 'location', icon: 'mapPin', label: t('m.vendor.location'), detail: `${vendor.neighborhood}, ${formatCity(vendor.city)}`, show: true },
    { key: 'info', icon: 'shield', label: t('m.vendor.goodToKnow'), detail: null, show: hasInfo }
  ]

  const sheetTitle: Record<SheetKey, string> = {
    about: t('m.vendor.about'), menu: t('m.vendor.menu'), hours: t('m.vendor.hours'), reviews: t('vendor.reviews'), location: t('m.vendor.location'),
    info: t('m.vendor.goodToKnow'), deals: t('m.market.flashDeals'), experiences: t('m.home.experiences'), stories: t('m.vendor.recentStories')
  }

  return (
    <main className="screen-push-in" style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}>
      {BackButton}

      {/* Photos: videos first, then photos; swipe through */}
      <div ref={heroRef} style={{ position: 'relative', height: '40vh', background: 'var(--system-bg-secondary)', overflow: 'hidden', borderBottom: `3px solid ${cat.color}` }}>
        <div onScroll={e => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))} style={{ display: 'flex', height: '100%', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
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
            <Icon name="crown" size={11} /> {t('common.premium')}
          </div>
        )}
        {media.length > 1 && (
          <span style={{ position: 'absolute', bottom: '12px', right: '12px', padding: '4px 10px', borderRadius: '999px', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '12px', fontWeight: 700, pointerEvents: 'none' }}>{slide + 1} / {media.length}</span>
        )}
        {vendor.live && (
          <div style={{ position: 'absolute', bottom: '12px', left: '12px', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '12px', fontWeight: 700, pointerEvents: 'none' }}>
            <span className="live-dot" /><span className="num-font">{vendor.whoThere}</span> {t('m.home.hereNow')}
          </div>
        )}
      </div>

      <div style={{ padding: '16px' }}>
        {/* Name & key facts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '999px', background: `${cat.color}1F`, color: cat.color, fontSize: '12px', fontWeight: 700 }}>
            <Icon name={cat.icon} size={12} /> {labels.category(vendor.category)}
          </span>
          {vendor.fairPrice && <FairPriceBadge size="md" />}
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginBottom: '2px' }}>{vendor.name}</h1>
        <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Icon name="mapPin" size={13} /> {vendor.neighborhood}, {formatCity(vendor.city)}
        </p>

        <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', padding: '12px 4px', marginBottom: '12px', cursor: 'default' }}>
          <button onClick={() => openSheet('reviews')} style={{ textAlign: 'center', padding: '0 6px', background: 'none', border: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
            <p className="num-font" style={{ fontSize: '19px', fontWeight: 700, color: 'var(--label-primary)' }}>
              {vendor.rating ? <><span style={{ color: 'var(--gold)' }}>★</span> {vendor.rating.toFixed(1)}</> : '—'}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '2px' }}>
              {vendor.reviewCount ? `${vendor.reviewCount} ${vendor.reviewCount === 1 ? t('m.common.review1') : t('m.common.reviewsN')}` : t('m.common.newOnEta')}
            </p>
          </button>
          <div style={{ textAlign: 'center', padding: '0 6px', borderLeft: '0.5px solid var(--separator)', borderRight: '0.5px solid var(--separator)' }}>
            <p className="num-font" style={{ fontSize: '19px', fontWeight: 700 }}>
              <span style={{ color: cat.color }}>{'$'.repeat(tier)}</span>
              <span style={{ color: 'var(--label-tertiary)', opacity: 0.5 }}>{'$'.repeat(4 - tier)}</span>
            </p>
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '2px' }}>{labels.priceNoun(vendor.category) || t('m.priceNoun.OTHER')}</p>
          </div>
          <button onClick={() => hours && openSheet('hours')} style={{ textAlign: 'center', padding: '0 6px', background: 'none', border: 'none', fontFamily: 'inherit', cursor: hours ? 'pointer' : 'default' }}>
            <p style={{ fontSize: '16px', fontWeight: 700, color: isOpen ? 'var(--success)' : 'var(--label-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', minHeight: '26px' }}>
              <span className={isOpen ? 'open-dot' : 'closed-dot'} /> {isOpen ? t('common.open') : t('common.closed')}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '2px' }}>{hoursDetail ?? (vendor.live ? `${vendor.whoThere} ${t('m.home.hereNow')}` : t('m.vendor.rightNow'))}</p>
          </button>
        </div>

        {/* Book / Directions */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          {book && (
            <button className="btn btn-primary" onClick={() => { triggerHaptic('light'); book.run() }} style={{ flex: 1 }}>
              <Icon name={book.label === 'm.vendor.book' ? 'calendar' : book.label === 'm.vendor.call' ? 'phone' : 'send'} size={16} /> {t(book.label)}
            </button>
          )}
          <button className={`btn ${book ? 'btn-secondary' : 'btn-primary'}`} onClick={handleDirections} style={{ flex: 1 }}>
            <Icon name="navigate" size={16} /> {t('m.nav.directions')}
          </button>
        </div>

        {/* Quick actions */}
        <div className="horizontal-scroll" style={{ gap: '8px', padding: '0 0 4px', marginBottom: '16px' }}>
          <Link href="/pay" className="chip" style={{ flexShrink: 0, background: 'var(--rum-tint)', color: 'var(--rum-text)', fontWeight: 700, textDecoration: 'none' }}><Icon name="qr" size={14} /> {t('m.scan.payButton')}</Link>
          <button className="chip" onClick={toggleSave} aria-pressed={saved} style={{ flexShrink: 0, color: saved ? 'var(--rum)' : undefined }}><Icon name="heart" size={14} className={saved ? 'filled' : ''} /> {saved ? t('m.saved.unsave') : t('m.saved.save')}</button>
          {fromExperiences && <button className="chip" onClick={() => setShowAddToTrip(true)} style={{ flexShrink: 0 }}><Icon name="plus" size={14} /> {t('m.addTrip.title')}</button>}
          {vendor.phone && book?.label !== 'm.vendor.call' && <a href={`tel:${vendor.phone.replace(/[^+\d]/g, '')}`} className="chip" style={{ flexShrink: 0, textDecoration: 'none' }}><Icon name="phone" size={14} /> {t('m.vendor.call')}</a>}
          {waLink && book?.label !== 'm.vendor.message' && <a href={waLink} target="_blank" rel="noopener noreferrer" className="chip" style={{ flexShrink: 0, textDecoration: 'none' }}><Icon name="send" size={14} /> WhatsApp</a>}
          {showPayButton && <button className="chip" onClick={() => router.push('/pay')} style={{ flexShrink: 0 }}><Icon name="card" size={14} /> {t('m.vendor.payHere')}</button>}
          <button className="chip" onClick={share} style={{ flexShrink: 0 }}><Icon name="share" size={14} /> {shareMsg ?? t('m.events.share')}</button>
        </div>

        {saved && (!alertsOn || alertMsg) && (
          <div className="card" style={{ padding: '12px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'default' }}>
            <Icon name="bell" size={18} style={{ color: 'var(--rum-text)', flexShrink: 0 }} />
            <p style={{ flex: 1, fontSize: '14px', color: 'var(--label-primary)' }}>{alertMsg ?? t('m.vendor.alertPrompt', { name: vendor.name })}</p>
            {!alertsOn && <button className="btn btn-secondary" style={{ minHeight: '36px', padding: '0 12px', fontSize: '14px' }} onClick={turnOnLiveAlerts}>{t('m.vendor.turnOn')}</button>}
          </div>
        )}

        {/* One row per topic; each opens a sheet */}
        <div className="card" style={{ padding: '0 16px', marginBottom: '28px', cursor: 'default' }}>
          {rows.filter(r => r.show).map((r, i, list) => (
            <button key={r.key} onClick={() => openSheet(r.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', background: 'none', border: 'none', borderBottom: i < list.length - 1 ? '0.5px solid var(--separator)' : 'none', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', minHeight: '52px' }}>
              <Icon name={r.icon} size={18} style={{ color: cat.color, flexShrink: 0 }} />
              <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--label-primary)', flexShrink: 0 }}>{r.label}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: '13px', color: 'var(--label-secondary)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.detail}</span>
              <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)', flexShrink: 0 }} />
            </button>
          ))}
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

      {/* Topic sheet */}
      <div className={`bottom-sheet-overlay ${sheet ? 'open' : ''}`} onClick={() => setSheet(null)} />
      <div className={`bottom-sheet ${sheet ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={sheet ? sheetTitle[sheet] : undefined} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="sheet-grabber" />
        {sheet && (
          <div style={{ padding: '0 20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)' }}>{sheetTitle[sheet]}</h3>
              {sheet === 'reviews' && (
                <button className="section-link" onClick={() => { setSheet(null); getCurrentUser() ? setReviewOpen(true) : router.push('/login') }} style={{ background: 'none', border: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
                  <Icon name="star" size={14} /> {t('m.review.write')}
                </button>
              )}
            </div>

            {sheet === 'about' && <p style={{ fontSize: '15px', lineHeight: 1.55, color: 'var(--label-primary)' }}>{vendor.description}</p>}

            {sheet === 'menu' && (vendor.menuItems?.length ? <VendorMenu items={vendor.menuItems} /> : <LegacyMenu menu={vendor.menu} />)}

            {sheet === 'hours' && (
              <>
                {hours && (
                  <div className="card" style={{ padding: '8px 16px', marginBottom: '16px', cursor: 'default' }}>
                    {[1, 2, 3, 4, 5, 6, 0].map(d => {
                      const ranges = hours[DAYS[d]] ?? []
                      return (
                        <div key={d} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px', fontWeight: d === todayIdx ? 700 : 400, color: d === todayIdx ? 'var(--label-primary)' : 'var(--label-secondary)' }}>
                          <span>{t(`m.day.${DAYS[d]}` as 'm.day.mon')}</span>
                          <span className="num-font">{ranges.length ? ranges.map(([a, b]) => `${formatTime(a)} – ${formatTime(b)}`).join(', ') : t('common.closed')}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
                <PopularTimes data={vendor.popularTimes} />
              </>
            )}

            {sheet === 'reviews' && (vendor.reviews.length === 0 ? (
              <div className="empty-state"><Icon name="star" size={28} style={{ color: 'var(--label-tertiary)' }} /><p>{patois.emptyReviews}</p></div>
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
                          {r.user.avatarUrl ? <img src={r.user.avatarUrl} alt={r.user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={16} style={{ color: 'var(--label-tertiary)' }} />}
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
                      {r.comment && <p style={{ fontSize: '14px', color: 'var(--label-secondary)', lineHeight: 1.4 }}>{r.comment}</p>}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-6px', marginBottom: '-10px' }}><ReportButton targetType="REVIEW" targetId={r.id} /></div>
                    </div>
                  ))}
                </div>
              </>
            ))}

            {sheet === 'location' && (
              <div className="card" style={{ overflow: 'hidden', cursor: 'default' }}>
                <div style={{ position: 'relative', height: '240px' }}>
                  <EtaMap center={{ lat: vendor.lat, lng: vendor.lng }} zoom={15} markers={[{ id: vendor.id, lat: vendor.lat, lng: vendor.lng, color: cat.color, size: 22, label: vendor.name, labelAlways: true }]} label={t('m.vendor.mapOf', { name: vendor.name })} />
                </div>
                {vendor.locationStatus === 'UNCONFIRMED' && (
                  <p style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px 0', fontSize: '12px', color: 'var(--label-secondary)' }}>
                    <Icon name="mapPin" size={12} /> {t('m.vendor.pinUnconfirmed')}
                  </p>
                )}
                <button onClick={handleDirections} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  <Icon name="mapPin" size={18} style={{ color: cat.color, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{vendor.neighborhood}</span>
                    <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>{formatCity(vendor.city)} · {t('m.vendor.getDirections')}</span>
                  </span>
                  <Icon name="chevronRight" size={16} style={{ color: 'var(--label-tertiary)' }} />
                </button>
              </div>
            )}

            {sheet === 'info' && (
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
                      {vendor.accessibility.map(k => <span key={k} className="chip" style={{ cursor: 'default', minHeight: '32px', padding: '4px 12px', fontSize: '13px' }}>♿ {labels.access(k)}</span>)}
                    </div>
                  </div>
                )}
                {vendor.instagram && (
                  <a href={vendor.instagram} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: vendor.website ? '0.5px solid var(--separator)' : 'none', color: 'var(--label-primary)', textDecoration: 'none' }}>
                    <Icon name="instagram" size={18} style={{ color: cat.color, flexShrink: 0 }} /><span style={{ flex: 1, fontSize: '15px' }}>Instagram</span><Icon name="chevronRight" size={16} style={{ color: 'var(--label-tertiary)' }} />
                  </a>
                )}
                {vendor.website && (
                  <a href={vendor.website} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', color: 'var(--label-primary)', textDecoration: 'none' }}>
                    <Icon name="globe" size={18} style={{ color: cat.color, flexShrink: 0 }} /><span style={{ flex: 1, fontSize: '15px' }}>{t('m.vendor.website')}</span><Icon name="chevronRight" size={16} style={{ color: 'var(--label-tertiary)' }} />
                  </a>
                )}
              </div>
            )}

            {sheet === 'deals' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {vendor.flashDeals.map(fd => (
                  <div key={fd.id} className="card" style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'default' }}>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)' }}>{fd.deal}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--label-secondary)', marginTop: '2px' }}><Icon name="clock" size={12} /> {formatCountdown(fd.expires, t)}</span>
                    </span>
                    <button className="btn btn-primary" onClick={() => claimDeal(fd.id)} disabled={claiming === fd.id} style={{ minHeight: '36px', padding: '0 14px', fontSize: '14px' }}>{claiming === fd.id ? '…' : t('m.vendor.claim')}</button>
                  </div>
                ))}
              </div>
            )}

            {sheet === 'experiences' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {vendor.experiences.map(exp => (
                  <Link key={exp.id} href={`/experiences/${exp.id}`} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', textDecoration: 'none' }}>
                    <span style={{ width: '64px', height: '64px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, background: 'var(--system-bg-secondary)' }}>
                      {exp.imageUrl && <Img src={exp.imageUrl} alt="" width={128} height={128} sizes="64px" />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>{exp.name}</span>
                      <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.tagline}</span>
                      <Price usd={exp.price} className="card-price" />
                    </span>
                    <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
                  </Link>
                ))}
              </div>
            )}

            {sheet === 'stories' && (
              <div className="horizontal-scroll">
                {vendor.stories.map(story => (
                  <Link key={story.id} href={`/stories?start=${vendor.id}`} aria-label={t('m.stories.open', { name: vendor.name })} style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div className={`story-ring ${vendor.isPremium ? 'premium' : 'standard'}`}>{story.imageUrl && <img src={story.imageUrl} alt="" />}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
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
                <button className="btn btn-primary" onClick={requestReservation} disabled={resvState.busy || !resv.date || !resv.time} style={{ width: '100%' }}>{resvState.busy ? '…' : t('m.vendor.reserveSend')}</button>
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
        <div role="alert" style={{ position: 'fixed', left: '16px', right: '16px', bottom: '24px', zIndex: 30, padding: '12px 14px', borderRadius: '14px', background: 'var(--system-bg-elevated)', boxShadow: 'var(--shadow-elevated)', fontSize: '14px', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
