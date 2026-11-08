// components/tabs/MarketTab.tsx — the Market tab (route /marketplace, kept
// alive by components/TabKeeper), after docs/mockups/MarketNew.dc.html.
// Top bar (title, location, map, search), a jump bar to the five chapters
// (it stays on screen once you scroll past it), then:
//   Today's Picks  B.O.N Members · Dishes Of The Day · Deals Right Now
//   Around You     Near You Now · Local Favourites
//   Food & Drink   Jerk Spots · Rum Bars & Beach Bars · Open Late
//   Shop & Stay    Crafts & Souvenirs · Accommodation · Groceries & Essentials
//   Everything     All Vendors
// Each chapter has a minimal separator; sections show only a title. Empty
// sections (and chapters) are hidden. From 9pm, Open Late moves to the very
// top. Data: /api/market (lib/market.ts).
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import BrandedRefresh from '@/components/BrandedRefresh'
import ErrorState from '@/components/ErrorState'
import RegionPill from '@/components/home/RegionPill'
import { useRegion } from '@/components/RegionProvider'
import { useTabShow } from '@/components/TabKeeper'
import { useLang } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { useUserLocation } from '@/lib/geo'
import { triggerHaptic } from '@/lib/haptics'
import { useReducedMotion } from '@/lib/motion'
import { getCurrentUser, AUTH_EVENT } from '@/lib/auth-client'
import { categoryStyle } from '@/lib/vendor-style'
import type { DictKey } from '@/lib/i18n'
import type { MarketData } from '@/lib/market'
import { Chapter, MkIcon, useNow } from '@/components/market/bits'
import { AllVendors, BarsGrid, BonPanel, CraftsMosaic, DealsRow, DishesRow, Essentials, JerkSpots, LocalFavs, NearYouNow, OpenLate, StaysRow, type Ctx } from '@/components/market/Sections'

const EtaMap = dynamic(() => import('@/components/map/EtaMap'), { ssr: false })

type ChapterId = 'picks' | 'around' | 'food' | 'shop' | 'all'
const CHAPTER_KEYS: Record<ChapterId, DictKey> = { picks: 'm.mk.ch.picks', around: 'm.mk.ch.around', food: 'm.mk.ch.food', shop: 'm.mk.ch.shop', all: 'm.mk.ch.all' }

function jamaicaHour(now: number) { return new Date(now - 5 * 3600000).getUTCHours() }

export default function MarketTab() {
  const router = useRouter()
  const { t, lang } = useLang()
  const labels = useLabels()
  const locale = lang === 'en' ? 'en-US' : lang
  const reduce = useReducedMotion()
  const { city, town, ready } = useRegion()
  const realLocation = useUserLocation()
  const [data, setData] = useState<MarketData | null>(null)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [jumpFixed, setJumpFixed] = useState(false)
  const [active, setActive] = useState<ChapterId>('picks')
  const jumpRef = useRef<HTMLDivElement>(null)
  const ticking = Boolean(data?.deals.some(d => d.kind === 'boost' && d.endsAt))
  const now = useNow(ticking ? 1000 : 30000)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const res = await fetch(`/api/market?city=${city}`)
      if (!res.ok) throw new Error('market')
      setData(await res.json())
    } catch {
      setFailed(true)
    }
  }, [city])

  useEffect(() => { if (ready) { setData(null); load() } }, [ready, load])
  useTabShow('/marketplace', () => { if (ready) load() })
  useEffect(() => {
    const read = () => setSignedIn(Boolean(getCurrentUser()))
    read()
    window.addEventListener(AUTH_EVENT, read)
    return () => window.removeEventListener(AUTH_EVENT, read)
  }, [])

  const refresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const from = realLocation ?? (data ? { lat: data.town.lat, lng: data.town.lng } : { lat: town.lat, lng: town.lng })
  const byId = useMemo(() => new Map((data?.vendors ?? []).map(v => [v.id, v])), [data])
  const ctx: Ctx = {
    t, locale, category: labels.category, stayType: labels.stayType, from, hasLocation: Boolean(realLocation), now, town: town.name,
    vendor: (id: string) => byId.get(id)
  }

  // What each chapter has.
  const has = data ? {
    bon: data.bon.length > 0, dishes: data.dishes.length > 0, deals: data.deals.length > 0,
    near: data.vendors.some(v => v.lat != null), favs: data.localFavs.length > 0,
    jerk: data.jerk.length > 0, bars: data.bars.length > 0, late: data.openLate.some(r => Date.parse(r.closesAt) > now),
    crafts: data.crafts.length > 0, stays: data.stays.length > 0, essentials: data.essentials.length > 0, all: data.vendors.length > 0
  } : null
  const lateFirst = jamaicaHour(now) >= 21 || jamaicaHour(now) < 4
  const chapters: ChapterId[] = has ? ([
    (has.bon || has.dishes || has.deals) && 'picks',
    (has.near || has.favs) && 'around',
    (has.jerk || has.bars || (has.late && !lateFirst)) && 'food',
    (has.crafts || has.stays || has.essentials) && 'shop',
    has.all && 'all'
  ].filter(Boolean) as ChapterId[]) : []

  // The fixed jump bar shows once the one under the title has scrolled away.
  useEffect(() => {
    const el = jumpRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setJumpFixed(!e.isIntersecting && e.boundingClientRect.top < 0))
    io.observe(el)
    return () => io.disconnect()
  }, [data])

  // Which chapter you're reading.
  useEffect(() => {
    if (!chapters.length || typeof IntersectionObserver === 'undefined') return
    const els = chapters.map(id => document.getElementById(`mk-${id}`)).filter((e): e is HTMLElement => Boolean(e))
    const io = new IntersectionObserver(entries => {
      const top = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (top) setActive(top.target.id.replace('mk-', '') as ChapterId)
    }, { rootMargin: '-80px 0px -60% 0px' })
    els.forEach(e => io.observe(e))
    return () => io.disconnect()
  }, [chapters.join(','), data]) // eslint-disable-line react-hooks/exhaustive-deps

  const jump = (id: ChapterId) => {
    triggerHaptic('selection')
    setActive(id)
    document.getElementById(`mk-${id}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  const jumpBar = (fixed: boolean) => (
    <div ref={fixed ? undefined : jumpRef} className={`mk-jump ${fixed ? `fixed ${jumpFixed ? 'on' : ''}` : ''}`} aria-hidden={fixed && !jumpFixed}>
      <div className="mk-scroll" role="tablist" aria-label={t('m.mk.jumpTo')}>
        {chapters.map(id => (
          <button key={id} role="tab" aria-selected={active === id} className="mk-chip" tabIndex={fixed && !jumpFixed ? -1 : 0} onClick={() => jump(id)}>{t(CHAPTER_KEYS[id])}</button>
        ))}
      </div>
    </div>
  )

  const top = (
    <header className="mk-top">
      <h1>{t('m.mk.title')}</h1>
      <div className="mk-top-actions">
        <RegionPill />
        <button className="mk-icon-btn press" aria-label={t('m.mk.map')} onClick={() => { triggerHaptic('light'); setMapOpen(true) }}><MkIcon name="map" /></button>
        <Link href="/search" className="mk-icon-btn press" aria-label={t('m.mo.search')} onClick={() => triggerHaptic('light')}><Icon name="search" size={18} /></Link>
      </div>
    </header>
  )

  return (
    <main className="mk">
      <BrandedRefresh refreshing={refreshing} onRefresh={refresh} />
      {top}

      {!data ? (
        failed ? <div className="mk-body" style={{ paddingTop: '24px' }}><ErrorState onRetry={load} /></div> : (
          <div className="mk-body" aria-hidden style={{ paddingTop: '10px' }}>
            <div className="skeleton-card" style={{ height: '38px', borderRadius: '999px', marginBottom: '22px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
            <div className="skeleton-card" style={{ height: '220px', borderRadius: '22px', marginBottom: '18px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
            <div className="skeleton-card" style={{ height: '170px', borderRadius: '18px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
          </div>
        )
      ) : !has?.all && !has?.stays ? (
        <div className="empty-state content-fade-in" style={{ minHeight: '50vh' }}>
          <Icon name="mapPin" size={32} style={{ color: 'var(--label-tertiary)' }} />
          <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.region.emptyTitle', { town: town.name })}</p>
          <p>{t('m.region.emptyBody')}</p>
        </div>
      ) : (
        <div key={city} className="content-fade-in">
          {jumpBar(false)}
          {jumpBar(true)}
          <div className="mk-body">
            {lateFirst && <OpenLate ctx={ctx} rows={data.openLate} />}

            {chapters.includes('picks') && <>
              <Chapter id="mk-picks" title={t('m.mk.ch.picks')} first />
              <BonPanel ctx={ctx} items={data.bon} signedIn={signedIn} />
              <DishesRow ctx={ctx} dishes={data.dishes} />
              <DealsRow ctx={ctx} deals={data.deals} />
            </>}

            {chapters.includes('around') && <>
              <Chapter id="mk-around" title={t('m.mk.ch.around')} first={chapters[0] === 'around'} />
              <NearYouNow ctx={ctx} vendors={data.vendors} onOpenMap={() => setMapOpen(true)} />
              <LocalFavs ctx={ctx} favs={data.localFavs} />
            </>}

            {chapters.includes('food') && <>
              <Chapter id="mk-food" title={t('m.mk.ch.food')} first={chapters[0] === 'food'} />
              <JerkSpots ctx={ctx} ids={data.jerk} />
              <BarsGrid ctx={ctx} ids={data.bars} />
              {!lateFirst && <OpenLate ctx={ctx} rows={data.openLate} />}
            </>}

            {chapters.includes('shop') && <>
              <Chapter id="mk-shop" title={t('m.mk.ch.shop')} first={chapters[0] === 'shop'} />
              <CraftsMosaic ctx={ctx} ids={data.crafts} />
              <StaysRow ctx={ctx} stays={data.stays} />
              <Essentials ctx={ctx} ids={data.essentials} />
            </>}

            {chapters.includes('all') && <>
              <Chapter id="mk-all" title={t('m.mk.ch.all')} first={chapters[0] === 'all'} />
              <AllVendors ctx={ctx} vendors={data.vendors} />
            </>}
          </div>
        </div>
      )}

      {/* The whole town on a map */}
      {mapOpen && data && (
        <div className="mk-mapsheet page-enter" role="dialog" aria-modal="true" aria-label={t('m.mk.map')}>
          <button className="mk-icon-btn mk-mapsheet-close" aria-label={t('m.mk.close')} onClick={() => setMapOpen(false)}><Icon name="close" size={18} /></button>
          <EtaMap
            center={from}
            zoom={14}
            user={realLocation}
            markers={data.vendors.filter(v => v.lat != null && v.lng != null).map(v => ({
              id: v.id, lat: v.lat!, lng: v.lng!, color: categoryStyle(v.category).color, ring: v.isPremium ? '#FFB800' : '#FFFFFF',
              size: v.isPremium ? 20 : 16, label: v.name, onClick: () => { setMapOpen(false); router.push(`/vendor/${v.id}`) }
            }))}
            label={t('m.mk.all')}
          />
        </div>
      )}

      <Dock />
    </main>
  )
}
