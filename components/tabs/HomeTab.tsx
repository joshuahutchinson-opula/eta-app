// components/tabs/HomeTab.tsx — Home (route /, kept alive by
// components/TabKeeper): "today in <town>". Top to bottom, always:
//   Hero → Stories → the stage's card ("Planning a trip?") → Your Day →
//   Featured · Destinations → Parties & Happenings · This Week →
//   Moods · Choose The Vibe → Dock
// The hero is a real photo or short muted loop of the selected town for the
// daypart (from the town's real sun times), or tonight's big event on a
// party night; over it the location pill (the one location changer) and
// the points pill, and bottom-left "Wah Gwan, <name>" with "<Daypart> In
// <Town> · Sunset <time>". Data comes from /api/home (lib/home.ts).
//
// One Home, different states (lib/stage.ts): the trip stage changes only
// the top — the hero's words, a card or prompt above the stories, and what
// sits in Your Day's place (the countdown, Your Last Trip, the cruise day's
// rides back). Big switches are always confirmed first.
//
// Feel: pull down to stretch the hero, then a refresh wave and a "What's
// new" toast; past the hero the pills tuck into a slim frosted bar; the
// Home tab turns into an up arrow when scrolled; changing town crossfades
// the hero and staggers the sections back in. Everything respects reduce
// motion. First open at an airport or hotel goes to the arrival flow
// (app/arrival); otherwise onboarding asks the first question.
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import RegionMismatchPrompt from '@/components/RegionMismatchPrompt'
import StoriesRow from '@/components/StoriesRow'
import AtYourStay from '@/components/AtYourStay'
import PlanBCard from '@/components/PlanBCard'
import VerifyEmailBanner from '@/components/VerifyEmailBanner'
import ErrorState from '@/components/ErrorState'
import HomeHero, { HERO_HEIGHT } from '@/components/home/HomeHero'
import RegionPill from '@/components/home/RegionPill'
import PointsPill from '@/components/home/PointsPill'
import YourDay from '@/components/home/YourDay'
import FeaturedCarousel from '@/components/home/FeaturedCarousel'
import HomeEvents from '@/components/home/HomeEvents'
import QuickPreview, { type PreviewTarget } from '@/components/home/QuickPreview'
import { BrowsingCard, CountdownBlock, CruiseBlock, GuestCard, LastTripCard, StagePrompts, useAboard, useHeroLines } from '@/components/home/StageBlocks'
import { Reveal, SectionHead } from '@/components/home/bits'
import { useRegion } from '@/components/RegionProvider'
import { useAtStay } from '@/lib/at-stay-client'
import { leanVendors } from '@/lib/host-lean'
import { checkArrivalOnce } from '@/lib/arrival-client'
import { needsOnboarding } from '@/lib/onboarding'
import { getCurrentUser, AUTH_EVENT } from '@/lib/auth-client'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'
import { useReducedMotion } from '@/lib/motion'
import { DAYPART_LEAN, sunInfo, type Daypart } from '@/lib/daypart'
import { vibeMoodNames } from '@/lib/vibes'
import { useLegFollower, useStage, type TripView } from '@/lib/stage-client'
import { useTabShow } from '@/components/TabKeeper'
import { cruisePortFor } from '@/lib/places-geo'
import type { FeaturedItem, HeroMedia, PartyNight } from '@/lib/home'
import type { EventItem } from '@/lib/events'
import type { DictKey } from '@/lib/i18n'

interface Mood { id: string; name: string; icon: string; description: string; coverImage: string }
interface HomeData {
  town: { city: string; name: string }
  sun: { daypart: Daypart; sunset: string }
  hero: HeroMedia | null
  party: (Omit<PartyNight, 'startAt'> & { startAt: string }) | null
  featured: FeaturedItem[]
  moods: Mood[]
}

const MOOD_ICONS: Record<string, string> = {
  'R&R': 'spa', 'Just The Two Of Us': 'heart', 'Party Time': 'party', 'Sunset Chaser': 'sun', 'Water Life': 'wave',
  'Street Food Crawl': 'food', 'Hangover Cures': 'recharge', 'Solo Missions': 'user', 'Family Day': 'users', 'Rum & Bass': 'glass'
}
/** Each mood's colour: the icon in that colour on a tinted square. */
const MOOD_TONES: Record<string, string> = {
  spa: '#13A89E', heart: '#E0457B', party: '#8E44D9', sun: '#F08A00', wave: '#1C7ED6',
  food: '#B82010', recharge: '#2F9E44', user: '#4C6EF5', users: '#D9480F', glass: '#C79100'
}
const MOOD_NAMES: Record<string, string> = { 'Out Til Sunrise': 'Party Time', 'Golden Hour': 'Sunset Chaser' }

const PULL_TRIGGER = 70
const PULL_MAX = 110
const TZ = 'America/Jamaica'

export default function HomePage() {
  const router = useRouter()
  const { t, lang } = useLang()
  const locale = lang === 'en' ? 'en-US' : lang
  const { city, town, ready } = useRegion()
  const reduce = useReducedMotion()
  const stage = useStage()
  useLegFollower(stage)
  const { result, position } = stage
  const { stay: atStay, host } = useAtStay()
  const [data, setData] = useState<HomeData | null>(null)
  const [failed, setFailed] = useState(false)
  const [firstName, setFirstName] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [refreshKey, setRefreshKey] = useState(0)
  const [washKey, setWashKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [pull, setPull] = useState(0)
  const [barOn, setBarOn] = useState(false)
  const [hasDay, setHasDay] = useState(false)
  const [preview, setPreview] = useState<PreviewTarget | null>(null)
  const [toast, setToast] = useState<{ stories: number; events: number } | null>(null)
  const pullStart = useRef<number | null>(null)
  const loadedAt = useRef<string>(new Date().toISOString())
  const storiesRef = useRef<HTMLDivElement>(null)
  const eventsRef = useRef<HTMLDivElement>(null)

  // First open: at an airport or hotel, the arrival flow; otherwise onboarding.
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
    const read = () => { const u = getCurrentUser(); setFirstName(u?.name?.split(' ')[0] ?? null); setSignedIn(Boolean(u)) }
    read()
    window.addEventListener(AUTH_EVENT, read)
    return () => window.removeEventListener(AUTH_EVENT, read)
  }, [])

  const cruise = result.stage === 'cruise' ? stage.cruise : null
  const cruisePort = cruise?.port ?? null
  const cruiseBack = cruise?.allAboardAt ?? null
  const load = useCallback(async () => {
    setFailed(false)
    try {
      const port = cruisePort ? cruisePortFor(cruisePort) : null
      const res = await fetch(`/api/home?city=${city}${port && cruiseBack ? `&port=${cruisePort}&backBy=${encodeURIComponent(cruiseBack)}` : ''}`)
      if (!res.ok) throw new Error('home')
      setData(await res.json())
      loadedAt.current = new Date().toISOString()
    } catch {
      setFailed(true)
    }
  }, [city, cruisePort, cruiseBack])

  useEffect(() => { if (ready) load() }, [ready, load])
  // Back on Home from another tab: what's shown stays, fresh data comes in quietly.
  useTabShow('/', () => { setNow(Date.now()); load() })

  // The daypart moves on by itself; reload when it changes.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])
  const sun = useMemo(() => sunInfo(town.lat, town.lng, new Date(now)), [town.lat, town.lng, now])
  const daypart = sun.daypart
  const lastPart = useRef(daypart)
  useEffect(() => {
    if (lastPart.current !== daypart) { lastPart.current = daypart; load() }
  }, [daypart, load])

  // The slim frosted bar once the hero has gone.
  useEffect(() => {
    let raf = 0
    const update = () => { raf = 0; setBarOn(window.scrollY > HERO_HEIGHT - 70) }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    triggerHaptic('medium')
    setWashKey(k => k + 1)
    const since = loadedAt.current
    setNow(Date.now())
    await load()
    setRefreshKey(k => k + 1)
    setRefreshing(false)
    const fresh = await fetch(`/api/home/fresh?city=${city}&since=${encodeURIComponent(since)}`).then(r => (r.ok ? r.json() : null)).catch(() => null)
    if (fresh && (fresh.stories > 0 || fresh.events > 0)) setToast(fresh)
  }, [load, city])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(id)
  }, [toast])

  // Pull down at the top: the hero stretches and zooms, then the wave.
  const onTouchStart = (e: React.TouchEvent) => { pullStart.current = window.scrollY <= 0 && !refreshing ? e.touches[0].clientY : null }
  const onTouchMove = (e: React.TouchEvent) => {
    if (pullStart.current === null) return
    const d = e.touches[0].clientY - pullStart.current
    if (d <= 0 || window.scrollY > 0) { if (pull) setPull(0); return }
    const next = Math.min(PULL_MAX, d * 0.5)
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
    const leadNames = data ? DAYPART_LEAN[data.sun.daypart].moods : []
    const vibe = vibeMoodNames()
    const all = data?.moods ?? []
    const leads = all.filter(m => leadNames.includes(m.name))
    const rest = all.filter(m => !leadNames.includes(m.name))
    return [...leads, ...rest.filter(m => vibe.includes(MOOD_NAMES[m.name] ?? m.name)), ...rest.filter(m => !vibe.includes(MOOD_NAMES[m.name] ?? m.name))]
      .map(m => ({ ...m, name: MOOD_NAMES[m.name] ?? m.name }))
      .slice(0, 6)
  }, [data])
  const loading = !data && !failed

  // The hero's words: the stage's, or tonight's big event.
  const sunset = sun.sunset.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: TZ })
  const daypartLine = t('m.h2.line', { daypart: t(`m.h2.dp.${daypart}` as DictKey), town: town.name, time: sunset })
  const lines = useHeroLines(result, firstName, daypartLine, now)
  const aboard = useAboard(cruise?.allAboardAt ?? null)
  const party = result.stage !== 'countdown' && data?.party ? data.party : null
  const heroMedia = party ? (party.video ? { kind: 'video' as const, url: party.video, poster: party.image } : party.image ? { kind: 'photo' as const, url: party.image, poster: null } : data?.hero ?? null) : data?.hero ?? null
  const trip = result.trip as TripView | null

  const yourDayPlace =
    result.stage === 'countdown' && trip ? 'countdown'
      : result.stage === 'between' && trip ? 'between'
      : result.stage === 'cruise' && cruise ? 'cruise'
      : 'day'
  const onDayState = useCallback((has: boolean) => setHasDay(has), [])

  const topBar = (solid: boolean) => (
    <div className="home-pills">
      <RegionPill />
      <PointsPill solid={solid} />
    </div>
  )

  const openEventPreview = useCallback((ev: EventItem) => setPreview({ kind: 'event', id: ev.id, name: ev.title, images: [ev.imageUrl, ...(ev.vendor?.images ?? [])].filter((u): u is string => Boolean(u)), lat: ev.lat, lng: ev.lng, startAt: ev.startAt, endAt: ev.endAt, venue: ev.venueName, bookable: Boolean(ev.inAppTickets || ev.ticketUrl) }), [])
  const openVendorPreview = useCallback((v: FeaturedItem) => setPreview({ kind: 'vendor', id: v.id, name: v.name, images: v.images.length ? v.images : v.image ? [v.image] : [], lat: v.lat, lng: v.lng, subtitle: v.neighborhood }), [])

  const jump = (ref: React.RefObject<HTMLDivElement>) => {
    setToast(null)
    ref.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  let section = 0
  const stagger = (node: React.ReactNode, key: string) => (
    <div key={`${city}-${key}`} className="stagger-in" style={{ '--i': section++ } as React.CSSProperties}>{node}</div>
  )

  return (
    <main className="home" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {/* Slim frosted bar once the hero is gone */}
      <div className={`home-bar ${barOn ? 'on' : ''}`} aria-hidden={!barOn}>{topBar(true)}</div>

      <HomeHero
        media={heroMedia}
        sceneKey={party ? `party-${party.id}` : city}
        pull={pull}
        washKey={washKey}
        credit={!party && data?.hero?.source === 'town' && data.hero.credit ? t(data.hero.kind === 'video' ? 'm.h2.creditVideo' : 'm.h2.creditPhoto', { name: data.hero.credit, source: data.hero.creditSource ?? 'Pexels' }) : null}
        topBar={<>
          {topBar(false)}
          {(refreshing || pull > 0) && (
            <p role="status" className="glass-pill home-refresh-pill" style={{ opacity: refreshing ? 1 : Math.min(1, pull / PULL_TRIGGER) }}>
              <Icon name="wave" size={14} /> {refreshing ? t('m.home.refreshing') : pull >= PULL_TRIGGER ? t('m.refresh.release') : t('m.refresh.pull')}
            </p>
          )}
        </>}
      >
        {party ? (
          <>
            <p className="home-hero-over">{t('m.h2.tonight', { title: party.title, time: new Date(party.startAt).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: TZ }) })}</p>
            <h1 className="home-greeting">{lines.title}</h1>
            <Link href={`/events/${party.id}`} onClick={() => triggerHaptic('medium')} className="home-watch press" style={{ marginTop: '12px' }}>
              <Icon name="ticket" size={15} /> {t('m.events.getTickets')}
            </Link>
          </>
        ) : (
          <>
            {lines.over && <p className="home-hero-over">{lines.over}</p>}
            <h1 className="home-greeting">{lines.title}</h1>
            <p className="home-tagline">
              {result.stage === 'cruise' && aboard ? <><Icon name="ship" size={14} /> <span className="num-font">{aboard}</span></> : lines.line}
            </p>
            {result.stage === 'trip' && result.day && (
              <Link href="/trips" className="glass-pill press home-day-chip num-font"><Icon name="calendar" size={12} /> {t('m.trip.dayOf', { day: result.day.n, total: result.day.total })}</Link>
            )}
          </>
        )}
      </HomeHero>

      <div className="home-sheet">
        <RegionMismatchPrompt />
        <VerifyEmailBanner />

        {/* 1. Stories */}
        <div ref={storiesRef}>{stagger(<StoriesRow key={`stories-${refreshKey}`} />, 'stories')}</div>

        {/* 2. The stage's card ("Planning a trip?") and its confirm-first prompts */}
        {stage.ready && (
          <div className="stage-top">
            <StagePrompts result={result} trips={stage.trips} legCity={result.legCity} />
            {!signedIn && <GuestCard />}
            {result.stage === 'browsing' && <BrowsingCard />}
          </div>
        )}

        {/* 3. Your Day (or what the stage puts in its place) */}
        {yourDayPlace === 'countdown' && trip && stagger(<CountdownBlock trip={trip} />, 'countdown')}
        {yourDayPlace === 'between' && trip && stagger(<LastTripCard trip={trip} />, 'between')}
        {yourDayPlace === 'cruise' && cruise && stagger(<CruiseBlock port={cruise.port} allAboardAt={cruise.allAboardAt} />, 'cruise')}
        {yourDayPlace === 'day' && stagger(
          <>
            <YourDay refreshKey={refreshKey} day={result.day} location={position} onState={onDayState} />
            {hasDay && <PlanBCard />}
            {hasDay && <AtYourStay stay={atStay} />}
          </>, 'day')}


        {failed && <div className="home-section"><ErrorState onRetry={refresh} /></div>}

        {/* 4. Featured · Destinations */}
        {(loading || featured.length > 0) && stagger(
          <Reveal className="home-section">
            <SectionHead eyebrow={t('m.home.featured')} title={t('m.home.destinations')} />
            {loading ? <div className="home-skel" style={{ height: '420px', margin: '4px 20px 30px' }} aria-hidden /> : <FeaturedCarousel items={featured} onPreview={openVendorPreview} />}
          </Reveal>, 'featured')}

        {data && featured.length === 0 && (
          <div className="empty-state home-section" style={{ padding: '0 20px' }}>
            <Icon name="mapPin" size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.region.emptyTitle', { town: town.name })}</p>
            <p>{t('m.region.emptyBody')}</p>
          </div>
        )}

        {/* 5. Parties & Happenings · This Week */}
        <div ref={eventsRef}>{stagger(<Reveal className="home-section"><HomeEvents key={`events-${refreshKey}`} onPreview={openEventPreview} /></Reveal>, 'events')}</div>

        {/* 6. Moods · Choose The Vibe */}
        {(loading || moods.length > 0) && stagger(
          <Reveal className="home-section">
            <SectionHead eyebrow={t('m.home.vibeEyebrow')} title={t('m.home.chooseVibe')} />
            <div className="mood-grid">
              {loading
                ? [0, 1, 2, 3, 4, 5].map(i => <div key={i} className="home-skel" style={{ height: '104px' }} aria-hidden />)
                : moods.map(m => {
                  const icon = MOOD_ICONS[m.name] ?? m.icon
                  const tone = MOOD_TONES[icon] ?? 'var(--rum)'
                  return (
                    <Link key={m.id} href={`/experiences?mood=${m.id}`} onClick={() => triggerHaptic('light')} className="mood-tile press" style={{ '--tone': tone } as React.CSSProperties}>
                      <span className="mood-tile-icon" aria-hidden><Icon name={icon} size={20} /></span>
                      <span className="mood-tile-name">{m.name}</span>
                    </Link>
                  )
                })}
            </div>
          </Reveal>, 'moods')}
      </div>

      {toast && (
        <button className="whats-new press" onClick={() => jump(toast.stories > 0 ? storiesRef : eventsRef)} role="status">
          <Icon name="sparkle" size={14} />
          {[toast.stories > 0 ? (toast.stories === 1 ? t('m.h2.newStory') : t('m.h2.newStories', { n: toast.stories })) : null, toast.events > 0 ? (toast.events === 1 ? t('m.h2.newEvent') : t('m.h2.newEvents', { n: toast.events })) : null].filter(Boolean).join(' · ')}
        </button>
      )}

      <QuickPreview target={preview} location={position} onClose={() => setPreview(null)} />
      <Dock />
    </main>
  )
}
