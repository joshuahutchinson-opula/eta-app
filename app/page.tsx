// app/page.tsx — Home: "today in <town>". A living postcard of the selected
// town right now (components/home/LivingHero: the real sun, sky and sea)
// with a content sheet over it. One job: what's good here, today, for me.
// Sheet order is fixed: Stories → Your day → Today story → Featured →
// Parties & Happenings → Choose The Vibe. The daypart (lib/daypart.ts) from
// the town's real sun times drives the sky, the tagline and what leads
// Featured and the moods; all of it comes from /api/home (lib/home.ts).
// Experiences live in their tab and "Near You" in Market.
// On scroll the hero drifts and fades and a slim bar keeps the region pill
// and bell. Pull to refresh washes a wave across the hero and re-reads the
// sky. First open at an airport or hotel goes to the arrival flow
// (app/arrival); otherwise to onboarding.
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import FloatingPill from '@/components/FloatingPill'
import EventsSection from '@/components/EventsSection'
import RegionMismatchPrompt from '@/components/RegionMismatchPrompt'
import StoriesRow from '@/components/StoriesRow'
import NotificationBell from '@/components/NotificationBell'
import AtYourStay from '@/components/AtYourStay'
import PlanBCard from '@/components/PlanBCard'
import VerifyEmailBanner from '@/components/VerifyEmailBanner'
import ErrorState from '@/components/ErrorState'
import { TripDayChip, TripEndCards } from '@/components/TripStatus'
import LivingHero from '@/components/home/LivingHero'
import RegionPill from '@/components/home/RegionPill'
import YourDay from '@/components/home/YourDay'
import TodayStory from '@/components/home/TodayStory'
import FeaturedCarousel from '@/components/home/FeaturedCarousel'
import { Reveal, SectionHead } from '@/components/home/bits'
import { useRegion } from '@/components/RegionProvider'
import { useAtStay } from '@/lib/at-stay-client'
import { leanVendors } from '@/lib/host-lean'
import { checkArrivalOnce } from '@/lib/arrival-client'
import { needsOnboarding } from '@/lib/onboarding'
import { getCurrentUser, AUTH_EVENT } from '@/lib/auth-client'
import { useLang } from '@/lib/i18n-client'
import { useUserLocation } from '@/lib/geo'
import { triggerHaptic } from '@/lib/haptics'
import { useReducedMotion } from '@/lib/motion'
import { DAYPART_LEAN, sunInfo, type Daypart } from '@/lib/daypart'
import { vibeMoodNames } from '@/lib/vibes'
import type { FeaturedItem, TodayStoryView } from '@/lib/home'
import type { DictKey } from '@/lib/i18n'

interface Mood { id: string; name: string; icon: string; description: string; coverImage: string }
interface HomeData {
  town: { city: string; name: string }
  sun: { daypart: Daypart }
  featured: FeaturedItem[]
  story: TodayStoryView | null
  moods: Mood[]
  feed: { enabled: boolean; count: number }
}

const MOOD_ICONS: Record<string, string> = {
  'R&R': 'spa', 'Just The Two Of Us': 'heart', 'Party Time': 'party', 'Sunset Chaser': 'sun', 'Water Life': 'wave',
  'Street Food Crawl': 'food', 'Hangover Cures': 'recharge', 'Solo Missions': 'user', 'Family Day': 'users', 'Rum & Bass': 'glass'
}
const MOOD_NAMES: Record<string, string> = { 'Out Til Sunrise': 'Party Time', 'Golden Hour': 'Sunset Chaser' }

const PULL_TRIGGER = 64
const PULL_MAX = 96

export default function HomePage() {
  const router = useRouter()
  const { t } = useLang()
  const { city, town, ready } = useRegion()
  const reduce = useReducedMotion()
  const location = useUserLocation()
  const { stay: atStay, host } = useAtStay()
  const [data, setData] = useState<HomeData | null>(null)
  const [failed, setFailed] = useState(false)
  const [user, setUser] = useState<{ firstName: string | null; points: number } | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [refreshKey, setRefreshKey] = useState(0)
  const [washKey, setWashKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [pull, setPull] = useState(0)
  const [barOn, setBarOn] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const pullStart = useRef<number | null>(null)

  // First open: at an airport or hotel, the arrival flow; otherwise the
  // three-tap onboarding (dates, stay, vibe).
  useEffect(() => {
    let cancelled = false
    checkArrivalOnce().then(r => {
      if (cancelled) return
      if (r === 'arrival') router.replace('/arrival')
      else if (needsOnboarding()) router.replace('/onboarding')
    })
    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    const read = () => {
      const u = getCurrentUser()
      setUser(u ? { firstName: u.name?.split(' ')[0] ?? null, points: u.points ?? 0 } : null)
    }
    read()
    window.addEventListener(AUTH_EVENT, read)
    return () => window.removeEventListener(AUTH_EVENT, read)
  }, [])

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const res = await fetch(`/api/home?city=${city}`)
      if (!res.ok) throw new Error('home')
      setData(await res.json())
    } catch {
      setFailed(true)
    }
  }, [city])

  useEffect(() => { if (ready) { setData(null); load() } }, [ready, load])

  // The daypart moves on by itself (sky, tagline); reload when it changes.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])
  const daypart = useMemo(() => sunInfo(town.lat, town.lng, now).daypart, [town.lat, town.lng, now])
  const lastPart = useRef(daypart)
  useEffect(() => {
    if (lastPart.current !== daypart) { lastPart.current = daypart; load() }
  }, [daypart, load])

  // Hero parallax + fade, and the slim bar once the hero has gone.
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const y = window.scrollY
      const h = heroRef.current?.offsetHeight ?? 400
      setBarOn(y > h - 110)
      if (reduce || !layerRef.current) return
      const k = Math.max(0, Math.min(1, y / (h * 0.75)))
      layerRef.current.style.transform = `translate3d(0, ${y * 0.35}px, 0)`
      layerRef.current.style.opacity = String(1 - k)
      const canvas = heroRef.current?.querySelector('canvas')
      if (canvas) canvas.style.transform = `translate3d(0, ${y * 0.5}px, 0) scale(${1 + Math.max(0, -y) / 600})`
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [reduce])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    triggerHaptic('medium')
    setWashKey(k => k + 1)
    setNow(new Date())
    await load()
    setRefreshKey(k => k + 1)
    setRefreshing(false)
  }, [load])

  // Pull to refresh from the top of the page.
  const onTouchStart = (e: React.TouchEvent) => { pullStart.current = window.scrollY <= 0 && !refreshing ? e.touches[0].clientY : null }
  const onTouchMove = (e: React.TouchEvent) => {
    if (pullStart.current === null) return
    const d = e.touches[0].clientY - pullStart.current
    if (d <= 0 || window.scrollY > 0) { if (pull) setPull(0); return }
    const next = Math.min(PULL_MAX, d * 0.45)
    if (pull < PULL_TRIGGER && next >= PULL_TRIGGER) triggerHaptic('selection')
    setPull(next)
  }
  const onTouchEnd = () => {
    if (pull >= PULL_TRIGGER) refresh()
    setPull(0)
    pullStart.current = null
  }

  const featured = useMemo(() => leanVendors(data?.featured ?? [], host), [data, host])
  const moods = useMemo(() => {
    // The server puts the daypart's moods first; the onboarding vibe's come next.
    const leadNames = data ? DAYPART_LEAN[data.sun.daypart].moods : []
    const vibe = vibeMoodNames()
    const all = data?.moods ?? []
    const leads = all.filter(m => leadNames.includes(m.name))
    const rest = all.filter(m => !leadNames.includes(m.name))
    return [...leads, ...rest.filter(m => vibe.includes(MOOD_NAMES[m.name] ?? m.name)), ...rest.filter(m => !vibe.includes(MOOD_NAMES[m.name] ?? m.name))]
      .map(m => ({ ...m, name: MOOD_NAMES[m.name] ?? m.name }))
  }, [data])
  const loading = !data && !failed
  const feedOn = Boolean(data?.feed.enabled)

  return (
    <main className="home" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <FloatingPill />

      {/* Slim bar once the hero is gone */}
      <div className={`home-bar ${barOn ? 'on' : ''}`} aria-hidden={!barOn}>
        <RegionPill />
        <NotificationBell />
      </div>

      <div ref={heroRef} style={{ transform: pull ? `translateY(${pull * 0.5}px)` : undefined, transition: pull ? 'none' : 'transform 0.5s var(--spring-standard)' }}>
        <LivingHero lat={town.lat} lng={town.lng} sceneKey={city} washKey={washKey}>
          <div ref={layerRef} className="home-hero-layer">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <RegionPill />
              <NotificationBell glass />
            </div>
            {(refreshing || pull > 0) && (
              <p role="status" className="glass-pill" style={{ alignSelf: 'center', marginTop: '10px', minHeight: '30px', fontSize: '13px', opacity: refreshing ? 1 : Math.min(1, pull / PULL_TRIGGER) }}>
                <Icon name="wave" size={14} /> {refreshing ? t('m.home.refreshing') : pull >= PULL_TRIGGER ? t('m.refresh.release') : t('m.refresh.pull')}
              </p>
            )}
            <div style={{ marginTop: 'auto' }}>
              <h1 className="home-greeting">{t('m.home.greeting', { name: user?.firstName ? `, ${user.firstName}` : '' })}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '10px 0 12px' }}>
                <TripDayChip glass />
                {user && (
                  <Link href="/rewards" className="glass-pill press" style={{ minHeight: '32px', padding: '0 12px', fontSize: '13px', fontWeight: 700 }}>
                    <Icon name="star" size={12} style={{ color: 'var(--gold)' }} />
                    <span className="num-font">{t('m.home.pointsPill', { n: user.points.toLocaleString() })}</span>
                  </Link>
                )}
              </div>
              <p className="home-tagline">{t(`m.home.tag.${daypart}` as DictKey, { town: town.name })}</p>
              {feedOn && (
                <Link href="/vibe" onClick={() => triggerHaptic('medium')} className="home-watch press" style={{ marginTop: '14px' }}>
                  {t('m.home.watch', { town: town.name })} <Icon name="play" size={13} />
                </Link>
              )}
            </div>
          </div>
        </LivingHero>
      </div>

      <div className="home-sheet">
        <RegionMismatchPrompt />
        <VerifyEmailBanner />

        {/* 1. Stories */}
        <StoriesRow key={`stories-${refreshKey}`} />

        {/* 2. Your day */}
        <section className="home-section" aria-label={t('m.home.yourDay')}>
          <SectionHead eyebrow={t('m.home.today')} title={t('m.home.yourDay')} />
          <YourDay refreshKey={refreshKey} />
          <PlanBCard />
          <AtYourStay stay={atStay} />
          <TripEndCards location={location} />
        </section>

        {failed && <div className="home-section"><ErrorState onRetry={refresh} /></div>}

        {/* 3. Today story */}
        {(loading || data?.story) && (
          <Reveal className="home-section" style={{ padding: '0 20px' }}>
            {data?.story ? <TodayStory story={data.story} /> : <div className="home-skel" style={{ height: '440px' }} aria-hidden />}
          </Reveal>
        )}

        {/* 4. Featured */}
        {(loading || featured.length > 0) && (
          <Reveal className="home-section">
            <SectionHead eyebrow={t('m.home.featured')} title={t('m.home.featuredTitle')} />
            {loading ? <div className="home-skel" style={{ height: '420px', margin: '4px 20px 30px' }} aria-hidden /> : <FeaturedCarousel items={featured} />}
          </Reveal>
        )}

        {data && !data.story && featured.length === 0 && (
          <div className="empty-state home-section" style={{ padding: '0 20px' }}>
            <Icon name="mapPin" size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.region.emptyTitle', { town: town.name })}</p>
            <p>{t('m.region.emptyBody')}</p>
          </div>
        )}

        {/* 5. Parties & Happenings */}
        <Reveal className="home-section home-events">
          <EventsSection key={`events-${refreshKey}`} />
        </Reveal>

        {/* 6. Choose The Vibe */}
        {(loading || moods.length > 0) && (
          <Reveal className="home-section">
            <SectionHead eyebrow={t('m.home.vibeEyebrow')} title={t('m.home.chooseVibe')} />
            <div className="vibe-grid">
              {loading
                ? [0, 1, 2, 3, 4].map(i => <div key={i} className="home-skel" style={{ height: i === 0 ? '150px' : '120px', gridColumn: i === 0 ? 'span 2' : undefined }} aria-hidden />)
                : moods.map((m, i) => (
                  <Link key={m.id} href={`/mood/${m.id}`} onClick={() => triggerHaptic('light')} className={`vibe-tile press ${i === 0 ? 'lead' : ''}`}>
                    {m.coverImage && <Img src={m.coverImage} alt="" width={i === 0 ? 900 : 480} height={i === 0 ? 300 : 240} sizes={i === 0 ? '100vw' : '50vw'} />}
                    <span><Icon name={MOOD_ICONS[m.name] ?? m.icon} size={18} /> {m.name}</span>
                  </Link>
                ))}
            </div>
          </Reveal>
        )}
      </div>

      <Dock />
    </main>
  )
}
