// components/market/Sections.tsx — the Market tab's sections, each with its
// own look (docs/mockups/MarketNew.dc.html):
//   BonPanel        black-and-gold panel, two members a row, their perk
//   DishesRow       top-down plates (a thin rim, the dish's video looping in
//                   the middle) with a tilted price sticker
//   DealsRow        tear-off tickets: points cost, or a live 2× countdown;
//                   a tap opens the vendor with that deal highlighted
//   NearYouNow      a mini map (blue "you" dot, numbered pins) + numbered list
//                   with big walk times
//   LocalFavs       quote cards in locals' own words, "Locals' Pick" stamp
//   JerkSpots       a big smoky photo card + heat scale, then smaller cards
//   BarsGrid        photo tiles with a happy-hour bar
//   OpenLate        near-black panel: closing time, time left, shrinking bar
//   CraftsMosaic    maker-first mosaic
//   StaysRow        wide photo cards (tap the sides for more photos), "from $X"
//   Essentials      compact icon list
//   AllVendors      count, filter pills, compact rows
// No green "open" pills anywhere.
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Img from '@/components/Img'
import SmartVideo from '@/components/SmartVideo'
import Price from '@/components/Price'
import { triggerHaptic, hapticSaved } from '@/lib/haptics'
import { useReducedMotion } from '@/lib/motion'
import type { DictKey } from '@/lib/i18n'
import type { LatLng } from '@/lib/routing'
import type { MarketData, MkVendor } from '@/lib/market'
import { Heat, MkIcon, SectionHead, avatarTone, clockAt, clockHHMM, countdown, minutesTo } from './bits'

export interface Ctx {
  t: (key: DictKey, vars?: Record<string, string | number>) => string
  locale: string
  category: (c: string) => string
  stayType: (c: string) => string
  from: LatLng
  hasLocation: boolean
  now: number
  town: string
  vendor: (id: string) => MkVendor | undefined
}

const tap = () => triggerHaptic('light')

function Photo({ src, alt = '', sizes, priority }: { src: string | null; alt?: string; sizes: string; priority?: boolean }) {
  if (!src) return null
  return <span className="mk-img"><Img src={src} alt={alt} width={720} height={540} sizes={sizes} priority={priority} /></span>
}

function walkText(ctx: Ctx, v: { lat: number | null; lng: number | null }): string | null {
  const m = minutesTo(ctx.from, v)
  if (!m) return null
  return `${m.min} ${m.walk ? ctx.t('m.mk.minWalk') : ctx.t('m.mk.minDrive')}`
}

// ---------- B.O.N Members ----------

export function BonPanel({ ctx, items, signedIn }: { ctx: Ctx; items: MarketData['bon']; signedIn: boolean }) {
  const shown = items.map(b => ({ b, v: ctx.vendor(b.vendorId) })).filter(x => x.v).slice(0, 4)
  if (!shown.length) return null
  return (
    <section className="mk-sec" aria-label={ctx.t('m.mk.bon')}>
      <div className="mk-bon">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <h2 className="mk-st">{ctx.t('m.mk.bon')}</h2>
          {signedIn ? <span className="mk-bon-in">{ctx.t('m.mk.youreIn')}</span> : <Link href="/vendors?premium=true" className="mk-all" style={{ color: '#FFD54A' }}>{ctx.t('m.common.seeAll')}</Link>}
        </div>
        <div className="mk-bon-grid list-in">
          {shown.map(({ b, v }) => (
            <Link key={v!.id} href={`/vendor/${v!.id}`} onClick={tap} className="press">
              <div className="mk-bon-img" data-morph><Photo src={v!.image} sizes="45vw" /></div>
              <p className="mk-bon-name mk-line1">{v!.name}</p>
              {b.perk && <p className="mk-bon-perk mk-line1">{b.perk}</p>}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- Dishes of the day ----------

export function DishesRow({ ctx, dishes }: { ctx: Ctx; dishes: MarketData['dishes'] }) {
  const reduce = useReducedMotion()
  if (!dishes.length) return null
  return (
    <section className="mk-sec" aria-label={ctx.t('m.mk.dishes')}>
      <SectionHead title={ctx.t('m.mk.dishes')} />
      <div className="mk-scroll list-in">
        {dishes.map(d => (
          <Link key={d.vendorId} href={`/vendor/${d.vendorId}`} onClick={tap} className="mk-dish press">
            <div className="mk-plate">
              <div className="mk-plate-food" data-morph>
                {/* A short muted loop of the dish, playing only while it's on screen (photo in low data or without one). */}
                {d.video && !reduce ? <SmartVideo src={d.video} poster={d.image} alt={d.name} /> : d.image && <Img src={d.image} alt={d.name} width={260} height={260} sizes="124px" />}
              </div>
              {d.price != null && <span className="mk-sticker num"><Price usd={d.price} /></span>}
            </div>
            <p className="mk-dish-name">{d.name}</p>
            <p className="mk-dish-sub sub mk-line1">{d.vendorName}{d.note ? ` · ${d.note}` : ''}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ---------- Deals right now ----------

export function DealsRow({ ctx, deals }: { ctx: Ctx; deals: MarketData['deals'] }) {
  const live = deals.filter(d => d.kind !== 'boost' || !d.endsAt || Date.parse(d.endsAt) > ctx.now)
  if (!live.length) return null
  const x = (m: number) => (Number.isInteger(m) ? String(m) : m.toFixed(1))
  return (
    <section className="mk-sec" aria-label={ctx.t('m.mk.deals')}>
      <SectionHead title={ctx.t('m.mk.deals')} action={<Link href="/rewards" className="mk-all">{ctx.t('m.common.seeAll')}</Link>} />
      <div className="mk-scroll list-in">
        {live.map(d => d.kind === 'perk' ? (
          <Link key={d.id} href={`/vendor/${d.vendorId}?deal=${d.id}`} onClick={tap} className="mk-ticket press" aria-label={ctx.t('m.mk.redeemFor', { title: d.title, n: d.cost })}>
            <div className="mk-ticket-main">
              <p className="mk-ticket-vendor mk-line1">{d.vendorName}</p>
              <p className="mk-ticket-title">{d.title}</p>
              <p className="mk-ticket-sub sub num">{ctx.t('m.mk.leftToday', { n: d.leftToday })}</p>
            </div>
            <div className="mk-stub pts"><b className="num">{d.cost.toLocaleString(ctx.locale)}</b><small>{ctx.t('m.mk.pts')}</small></div>
          </Link>
        ) : (
          <Link key={d.id} href={`/vendor/${d.vendorId}?deal=${d.id}`} onClick={tap} className="mk-ticket press">
            <div className="mk-ticket-main">
              <p className="mk-ticket-vendor mk-line1">{d.vendorName}</p>
              <p className="mk-ticket-title">{ctx.t('m.mk.xPoints', { x: x(d.multiplier) })}</p>
              {d.endsAt && <p className="mk-ticket-sub num" style={{ color: 'var(--rum-text)' }}>{ctx.t('m.mk.ends', { time: countdown(d.endsAt, ctx.now) })}</p>}
            </div>
            <div className="mk-stub boost"><b className="num">{x(d.multiplier)}×</b><small>{ctx.t('m.mk.live')}</small></div>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ---------- Near you now ----------

const MAPBOX = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
const TILE = 512
const projX = (lng: number) => ((lng + 180) / 360) * TILE
const projY = (lat: number) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE }

function MiniMap({ ctx, places }: { ctx: Ctx; places: MkVendor[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(358)
  const h = 150
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setW(Math.round(el.clientWidth) || 358)
    read()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])
  const dark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'
  const pts = [ctx.from, ...places.map(p => ({ lat: p.lat as number, lng: p.lng as number }))]
  const xs = pts.map(p => projX(p.lng))
  const ys = pts.map(p => projY(p.lat))
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const pad = 0.72
  const zoom = Math.max(11, Math.min(16.5, Math.log2(Math.min((w * pad) / Math.max(maxX - minX, 1e-6), (h * pad) / Math.max(maxY - minY, 1e-6)))))
  const scale = Math.pow(2, zoom)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const at = (p: LatLng) => ({ left: (projX(p.lng) - cx) * scale + w / 2, top: (projY(p.lat) - cy) * scale + h / 2 })
  // The map's centre back in degrees, for the static image.
  const centerLng = (cx / TILE) * 360 - 180
  const centerLat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * cy) / TILE))) * 180) / Math.PI
  const src = MAPBOX ? `https://api.mapbox.com/styles/v1/mapbox/${dark ? 'dark-v11' : 'light-v11'}/static/${centerLng.toFixed(5)},${centerLat.toFixed(5)},${(zoom - 1).toFixed(2)},0/${Math.min(1280, w)}x${h}@2x?access_token=${MAPBOX}&logo=false` : null
  const me = at(ctx.from)
  return (
    <div ref={ref} className="mk-map" aria-hidden>
      {src ? <img src={src} alt="" loading="lazy" /> : (
        <svg viewBox="0 0 358 150" preserveAspectRatio="none">
          <path d="M0 110 C 80 100, 140 60, 220 70 S 330 40, 358 30" fill="none" stroke={dark ? '#2C3439' : '#FFFFFF'} strokeWidth="14" strokeLinecap="round" />
          <path d="M150 150 L 170 0" stroke={dark ? '#2C3439' : '#FFFFFF'} strokeWidth="8" />
          <path d="M0 150 L 0 125 C 60 128, 120 150, 160 150 Z" fill={dark ? '#173A45' : '#9FD3E0'} />
        </svg>
      )}
      {ctx.hasLocation && <span className="mk-me" style={me} />}
      {places.map((p, i) => <span key={p.id} className={`mk-pin num ${i === 0 ? 'first' : ''}`} style={at({ lat: p.lat as number, lng: p.lng as number })}>{i + 1}</span>)}
    </div>
  )
}

export function NearYouNow({ ctx, vendors, onOpenMap }: { ctx: Ctx; vendors: MkVendor[]; onOpenMap: () => void }) {
  const near = useMemo(() => vendors
    .filter(v => v.lat != null && v.lng != null)
    .map(v => ({ v, m: minutesTo(ctx.from, v)! }))
    .sort((a, b) => a.m.min - b.m.min)
    .slice(0, 3), [vendors, ctx.from])
  if (!near.length) return null
  const line = (v: MkVendor) => [ctx.category(v.category), v.note ?? (v.open.state === 'open' && v.open.closes ? ctx.t('m.mk.closesAt', { time: clockHHMM(v.open.closes, ctx.locale) }) : v.neighborhood)].filter(Boolean).join(' · ')
  return (
    <section className="mk-sec" aria-label={ctx.t('m.mk.near')}>
      <SectionHead title={ctx.t('m.mk.near')} action={<button className="mk-all" onClick={() => { tap(); onOpenMap() }}>{ctx.t('m.mk.openMap')}</button>} />
      <div className="mk-card mk-near">
        <MiniMap ctx={ctx} places={near.map(n => n.v)} />
        <div className="mk-near-list list-in">
          {near.map(({ v, m }, i) => (
            <Link key={v.id} href={`/vendor/${v.id}`} onClick={tap} className="mk-near-row">
              <span className={`mk-num num ${i === 0 ? 'first' : ''}`}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="mk-line1" style={{ fontSize: '15px', fontWeight: 700 }}>{v.name}</p>
                <p className="sub mk-line1" style={{ marginTop: '2px', fontSize: '13px' }}>{line(v)}</p>
              </div>
              <div className="mk-walk"><b className="num">{m.min}</b><small>{m.walk ? ctx.t('m.mk.minWalk') : ctx.t('m.mk.minDrive')}</small></div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- Local favourites ----------

export function LocalFavs({ ctx, favs }: { ctx: Ctx; favs: MarketData['localFavs'] }) {
  const shown = favs.map(f => ({ f, v: ctx.vendor(f.vendorId) })).filter(x => x.v)
  if (!shown.length) return null
  return (
    <section className="mk-sec" aria-label={ctx.t('m.mk.localFavs')}>
      <SectionHead title={ctx.t('m.mk.localFavs')} />
      <div className="mk-scroll list-in">
        {shown.map(({ f, v }) => (
          <Link key={f.vendorId} href={`/vendor/${f.vendorId}`} onClick={tap} className="mk-card mk-quote press">
            <span style={{ color: 'var(--rum-text)' }}><MkIcon name="quote" /></span>
            <p className="mk-quote-text">“{f.quote}”</p>
            <div className="mk-quote-by">
              <span className="mk-avatar" style={{ background: avatarTone(f.author) }} aria-hidden>{f.author.charAt(0)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="mk-line1" style={{ fontSize: '13px', fontWeight: 700 }}>{f.local ? ctx.t('m.mk.localOf', { name: f.author, town: f.authorTown ?? ctx.town }) : `${f.author} · ${f.authorTown ?? ''}`}</p>
                <p className="sub mk-line1" style={{ fontSize: '12px' }}>{ctx.t('m.mk.about', { vendor: v!.name })}</p>
              </div>
            </div>
            <span className="mk-stamp">{ctx.t('m.mk.localsPick')}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ---------- Jerk spots ----------

export function JerkSpots({ ctx, ids }: { ctx: Ctx; ids: string[] }) {
  const list = ids.map(ctx.vendor).filter((v): v is MkVendor => Boolean(v))
  if (!list.length) return null
  const [top, ...rest] = list
  const heatLabel = (n: number) => ctx.t('m.mk.heatOf', { n })
  const topMeta = [top.note, walkText(ctx, top)].filter(Boolean).join(' · ') || top.neighborhood
  return (
    <section className="mk-sec" aria-label={ctx.t('m.mk.jerk')}>
      <SectionHead title={ctx.t('m.mk.jerk')} action={list.length > 3 ? <Link href="/search?q=jerk" className="mk-all">{ctx.t('m.common.seeAll')}</Link> : undefined} />
      <Link href={`/vendor/${top.id}`} onClick={tap} className="mk-ph mk-jerk-hero press">
        <span data-morph style={{ position: 'absolute', inset: 0 }}><Photo src={top.image} sizes="100vw" alt={top.name} /></span>
        <span className="mk-smoke" style={{ left: '40px', bottom: '60px' }} aria-hidden />
        <span className="mk-smoke" style={{ left: '90px', bottom: '50px', animationDelay: '1.3s' }} aria-hidden />
        <span className="mk-smoke" style={{ left: '60px', bottom: '70px', animationDelay: '2.6s' }} aria-hidden />
        <span className="mk-shade" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 100%)' }} />
        <span className="mk-tag" style={{ top: '14px', left: '14px', background: '#FFFFFF', color: '#000000' }}>{ctx.t('m.mk.number1', { town: ctx.town })}</span>
        <div className="mk-jerk-foot">
          <div style={{ minWidth: 0 }}>
            <p className="mk-line1" style={{ fontSize: '22px', fontWeight: 800 }}>{top.name}</p>
            <p className="mk-line1" style={{ marginTop: '3px', fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>{topMeta}</p>
          </div>
          {top.heat && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p className="mk-heat-label">{ctx.t('m.mk.heat')}</p>
              <p style={{ marginTop: '3px' }}><Heat level={top.heat} onPhoto label={heatLabel(top.heat)} /></p>
            </div>
          )}
        </div>
      </Link>
      {rest.length > 0 && (
        <div className="mk-jerk-grid list-in">
          {rest.slice(0, 4).map(v => (
            <Link key={v.id} href={`/vendor/${v.id}`} onClick={tap} className="mk-card mk-jerk-card press">
              <p className="mk-line1" style={{ fontSize: '15px', fontWeight: 700 }}>{v.name}</p>
              <p className="sub mk-line1" style={{ margin: '2px 0 6px', fontSize: '12px' }}>{[v.neighborhood, v.note].filter(Boolean).join(' · ')}</p>
              {v.heat && <Heat level={v.heat} label={heatLabel(v.heat)} />}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

// ---------- Rum bars & beach bars ----------

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0) }
function jamaicaMinutes(now: number) { const d = new Date(now - 5 * 3600000); return d.getUTCHours() * 60 + d.getUTCMinutes() }

export function BarsGrid({ ctx, ids }: { ctx: Ctx; ids: string[] }) {
  const list = ids.map(ctx.vendor).filter((v): v is MkVendor => Boolean(v)).slice(0, 4)
  if (!list.length) return null
  const mins = jamaicaMinutes(ctx.now)
  const hh = (v: MkVendor) => {
    if (!v.happyHour) return null
    const s = toMin(v.happyHour.start)
    let e = toMin(v.happyHour.end)
    if (e <= s) e += 1440
    const m = mins < s && e > 1440 && mins + 1440 < e ? mins + 1440 : mins
    const range = `${clockHHMM(v.happyHour.start, ctx.locale)}–${clockHHMM(v.happyHour.end, ctx.locale)}`
    if (m >= s && m < e) return { live: true, pct: Math.round(((m - s) / (e - s)) * 100), text: ctx.t('m.mk.happyNow', { time: clockHHMM(v.happyHour.end, ctx.locale) }) }
    if (m < s) return { live: false, pct: 0, text: ctx.t('m.mk.happyFrom', { time: clockHHMM(v.happyHour.start, ctx.locale) }) }
    return { live: false, pct: 0, text: ctx.t('m.mk.happyHour', { range }) }
  }
  return (
    <section className="mk-sec" aria-label={ctx.t('m.mk.bars')}>
      <SectionHead title={ctx.t('m.mk.bars')} action={ids.length > 4 ? <Link href="/vendors?category=DRINKS" className="mk-all">{ctx.t('m.common.seeAll')}</Link> : undefined} />
      <div className="mk-bars list-in">
        {list.map(v => {
          const h = hh(v)
          const kind = v.tags.includes('beach_bar') ? ctx.t('m.mk.beachBar') : ctx.t('m.mk.rumBar')
          return (
            <Link key={v.id} href={`/vendor/${v.id}`} onClick={tap} className="mk-bar-tile press">
              <div className="mk-ph mk-bar-photo" data-morph>
                <Photo src={v.image} sizes="45vw" alt={v.name} />
                {v.note && <span className="mk-tag" style={{ left: '10px', bottom: '10px', background: 'rgba(0,0,0,0.45)', color: '#FFFFFF' }}>{v.note}</span>}
              </div>
              <div style={{ padding: '10px 12px 12px' }}>
                <p className="mk-line1" style={{ fontSize: '15px', fontWeight: 700 }}>{v.name}</p>
                <p className="sub mk-line1" style={{ margin: '2px 0 8px', fontSize: '12px' }}>{kind} · {v.neighborhood}</p>
                <div className="mk-hh-track"><i style={{ width: `${h?.pct ?? 0}%` }} /></div>
                <p className={`mk-line1 ${h?.live ? 'mk-hh-live' : 'sub'}`} style={{ marginTop: '5px', fontSize: '12px', fontWeight: 600 }}>{h?.text ?? ' '}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

// ---------- Open late ----------

export function OpenLate({ ctx, rows }: { ctx: Ctx; rows: MarketData['openLate'] }) {
  const live = rows.filter(r => Date.parse(r.closesAt) > ctx.now).map(r => ({ r, v: ctx.vendor(r.vendorId) })).filter(x => x.v)
  if (!live.length) return null
  const openCount = live.filter(x => Date.parse(x.r.opensAt) <= ctx.now).length
  return (
    <section className="mk-sec" aria-label={ctx.t('m.mk.openLate')}>
      <div className="mk-late">
        <div className="mk-late-glow" aria-hidden />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px' }}>
          <h2 className="mk-st">{ctx.t('m.mk.openLate')}</h2>
          <span className="mk-late-count">{ctx.t('m.mk.openNowN', { n: openCount }).split(String(openCount)).flatMap((part, i, arr) => i < arr.length - 1 ? [part, <span key={i} className="num" style={{ color: '#FFFFFF' }}>{openCount}</span>] : [part])}</span>
        </div>
        <div className="list-in" style={{ position: 'relative', marginTop: '12px' }}>
          {live.slice(0, 6).map(({ r, v }) => {
            const opens = Date.parse(r.opensAt)
            const closes = Date.parse(r.closesAt)
            const isOpen = opens <= ctx.now
            const leftMin = Math.max(0, Math.round((closes - ctx.now) / 60000))
            const pct = isOpen ? Math.max(2, Math.min(100, Math.round(((closes - ctx.now) / (closes - opens)) * 100))) : 100
            const sub = [ctx.category(v!.category), walkText(ctx, v!)].filter(Boolean).join(' · ')
            return (
              <Link key={v!.id} href={`/vendor/${v!.id}`} onClick={tap} className="mk-late-row">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="mk-late-name mk-line1">{v!.name}</p>
                    <p className="mk-late-sub mk-line1">{sub}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p className="mk-late-close num">{clockAt(closes, ctx.locale)}</p>
                    <p className="mk-late-left">{isOpen ? (leftMin >= 60 ? ctx.t('m.mk.leftHM', { h: Math.floor(leftMin / 60), m: leftMin % 60 }) : ctx.t('m.mk.leftM', { m: leftMin })) : ctx.t('m.mk.opensAt', { time: clockAt(opens, ctx.locale) })}</p>
                  </div>
                </div>
                <div className="mk-late-track"><i style={{ width: `${isOpen ? pct : 0}%` }} /></div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ---------- Crafts & souvenirs ----------

export function CraftsMosaic({ ctx, ids }: { ctx: Ctx; ids: string[] }) {
  const list = ids.map(ctx.vendor).filter((v): v is MkVendor => Boolean(v)).slice(0, 3)
  if (!list.length) return null
  return (
    <section className="mk-sec" aria-label={ctx.t('m.mk.crafts')}>
      <SectionHead title={ctx.t('m.mk.crafts')} action={ids.length > 3 ? <Link href="/search?q=craft" className="mk-all">{ctx.t('m.common.seeAll')}</Link> : undefined} />
      <div className="mk-mosaic list-in">
        {list.map((v, i) => (
          <Link key={v.id} href={`/vendor/${v.id}`} onClick={tap} className="press">
            <span data-morph style={{ position: 'absolute', inset: 0 }}><Photo src={v.image} sizes={i === 0 ? '55vw' : '45vw'} alt={v.name} /></span>
            <span className="mk-shade" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.65) 100%)' }} />
            <div style={{ position: 'absolute', zIndex: 2, left: '12px', right: '12px', bottom: i === 0 ? '12px' : '10px' }}>
              <p className="mk-line1" style={{ fontSize: i === 0 ? '16px' : '14px', fontWeight: 700 }}>{v.name}</p>
              {i === 0 && <p className="mk-line1" style={{ marginTop: '2px', fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>{[v.note, v.neighborhood].filter(Boolean).join(' · ')}</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ---------- Accommodation ----------

const STAY_KEY = 'savedStays'
function readStays(): string[] { try { const v = JSON.parse(localStorage.getItem(STAY_KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } }

function StayCard({ ctx, s, saved, onSave }: { ctx: Ctx; s: MarketData['stays'][number]; saved: boolean; onSave: () => void }) {
  const [i, setI] = useState(0)
  const n = s.images.length
  const step = (d: number) => { triggerHaptic('selection'); setI(x => (x + d + n) % n) }
  const sub = [ctx.stayType(s.type), ...s.amenities.slice(0, 2)].join(' · ')
  return (
    <div className="mk-stay">
      <Link href={`/accommodations/${s.id}`} onClick={tap} style={{ display: 'block' }}>
        <div className="mk-ph mk-stay-photo" data-morph>
          {n > 0 && <span key={i} className="mk-img swap-fade"><Img src={s.images[i]} alt={s.name} width={900} height={560} sizes="80vw" /></span>}
          <span className="mk-tag" style={{ top: '12px', left: '12px', background: 'rgba(255,255,255,0.92)', color: '#000000' }}>{s.partner ? ctx.t('m.mk.partnerGift') : ctx.stayType(s.type)}</span>
          {n > 1 && <div className="mk-dots" aria-label={ctx.t('m.mk.photoN', { n: i + 1, total: n })}>{s.images.map((_, k) => <span key={k} className={k === i ? 'on' : ''} />)}</div>}
        </div>
      </Link>
      {n > 1 && (
        <>
          <button className="mk-stay-zone" style={{ left: 0, height: '180px', bottom: 'auto' }} aria-label={ctx.t('m.ev.prev')} onClick={() => step(-1)} data-no-morph />
          <button className="mk-stay-zone" style={{ right: 0, height: '180px', bottom: 'auto' }} aria-label={ctx.t('m.ev.next')} onClick={() => step(1)} data-no-morph />
        </>
      )}
      <button className="mk-heart" aria-pressed={saved} aria-label={saved ? ctx.t('m.mo.saved') : ctx.t('m.mo.save')} onClick={onSave}><MkIcon name="heart" size={16} /></button>
      <Link href={`/accommodations/${s.id}`} onClick={tap} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '10px' }}>
        <div style={{ minWidth: 0 }}>
          <p className="mk-line1" style={{ fontSize: '16px', fontWeight: 700 }}>{s.name}</p>
          <p className="sub mk-line1" style={{ marginTop: '2px', fontSize: '13px' }}>{sub}</p>
        </div>
        {s.nightlyPrice != null && (
          <p className="sub" style={{ textAlign: 'right', fontSize: '13px', flexShrink: 0 }}>{ctx.t('m.mk.from')}<br /><b className="num" style={{ fontSize: '16px', color: 'var(--label-primary)' }}><Price usd={s.nightlyPrice} /></b></p>
        )}
      </Link>
    </div>
  )
}

export function StaysRow({ ctx, stays }: { ctx: Ctx; stays: MarketData['stays'] }) {
  const [saved, setSaved] = useState<string[]>([])
  useEffect(() => setSaved(readStays()), [])
  if (!stays.length) return null
  const toggle = (id: string) => {
    hapticSaved()
    const next = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id]
    setSaved(next)
    try { localStorage.setItem(STAY_KEY, JSON.stringify(next)) } catch {}
  }
  return (
    <section className="mk-sec" aria-label={ctx.t('m.mk.stays')}>
      <SectionHead title={ctx.t('m.mk.stays')} />
      <div className="mk-scroll list-in" style={{ scrollSnapType: 'x mandatory' }}>
        {stays.map(s => <div key={s.id} style={{ position: 'relative', flex: '0 0 290px', scrollSnapAlign: 'start' }}><StayCard ctx={ctx} s={s} saved={saved.includes(s.id)} onSave={() => toggle(s.id)} /></div>)}
      </div>
    </section>
  )
}

// ---------- Groceries & essentials ----------

export function Essentials({ ctx, ids }: { ctx: Ctx; ids: string[] }) {
  const list = ids.map(ctx.vendor).filter((v): v is MkVendor => Boolean(v))
  if (!list.length) return null
  const dist = (v: MkVendor) => { const m = minutesTo(ctx.from, v); return m ? `${m.min} ${m.walk ? ctx.t('m.mk.minWalk') : ctx.t('m.mk.minDrive')}` : null }
  const topups = list.filter(v => v.tags.includes('phone_topup') && !v.tags.includes('grocery') && !v.tags.includes('pharmacy'))
    .sort((a, b) => (minutesTo(ctx.from, a)?.min ?? 999) - (minutesTo(ctx.from, b)?.min ?? 999))
  const shops = list.filter(v => !topups.includes(v)).slice(0, 4)
  const closes = (v: MkVendor) => v.open.state === 'open' && v.open.closes ? ctx.t('m.mk.closesAt', { time: clockHHMM(v.open.closes, ctx.locale) }) : null
  return (
    <section className="mk-sec" aria-label={ctx.t('m.mk.essentials')}>
      <SectionHead title={ctx.t('m.mk.essentials')} />
      <div className="mk-card mk-ess list-in">
        {shops.map(v => {
          const pharmacy = v.tags.includes('pharmacy') && !v.tags.includes('grocery')
          const sub = pharmacy
            ? [v.note ?? ctx.t('m.mk.pharmacy'), dist(v)]
            : [ctx.t('m.mk.grocery'), closes(v), dist(v)]
          return (
            <Link key={v.id} href={`/vendor/${v.id}`} onClick={tap} className="mk-ess-row">
              <span className="mk-ess-ic"><MkIcon name={pharmacy ? 'cross' : 'cart'} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="mk-line1" style={{ fontSize: '15px', fontWeight: 600 }}>{v.name}</p>
                <p className="sub mk-line1" style={{ fontSize: '12px' }}>{sub.filter(Boolean).join(' · ')}</p>
              </div>
              <ChevronRight />
            </Link>
          )
        })}
        {topups.length > 0 && (
          <Link href={`/vendor/${topups[0].id}`} onClick={tap} className="mk-ess-row">
            <span className="mk-ess-ic"><MkIcon name="phone" /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="mk-line1" style={{ fontSize: '15px', fontWeight: 600 }}>{ctx.t('m.mk.topup')}</p>
              <p className="sub mk-line1" style={{ fontSize: '12px' }}>{ctx.t('m.mk.topupSub', { n: topups.length })}</p>
            </div>
            <ChevronRight />
          </Link>
        )}
      </div>
    </section>
  )
}

function ChevronRight() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--label-tertiary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
}

// ---------- All vendors ----------

const SHOP_TAGS = ['crafts', 'souvenirs', 'grocery', 'pharmacy', 'phone_topup']
const FILTERS = ['all', 'food', 'drinks', 'shops', 'services'] as const
type Filter = (typeof FILTERS)[number]
function inFilter(v: MkVendor, f: Filter) {
  if (f === 'all') return true
  if (f === 'food') return v.category === 'FOOD'
  if (f === 'drinks') return v.category === 'DRINKS'
  if (f === 'shops') return v.category === 'OTHER' || v.tags.some(t => SHOP_TAGS.includes(t))
  return ['WELLNESS', 'ACTIVITY', 'BEACH', 'TRANSPORT'].includes(v.category) && !v.tags.some(t => SHOP_TAGS.includes(t))
}

export function AllVendors({ ctx, vendors }: { ctx: Ctx; vendors: MkVendor[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const shown = vendors.filter(v => inFilter(v, filter))
  const km = (v: MkVendor) => { const m = minutesTo(ctx.from, v); return m ? `${m.min} ${m.walk ? ctx.t('m.mk.minWalk') : ctx.t('m.mk.minDrive')}` : null }
  return (
    <section className="mk-sec" aria-label={ctx.t('m.mk.all')}>
      <SectionHead title={ctx.t('m.mk.all')} action={<span className="sub num" style={{ fontSize: '13px', minHeight: '44px', display: 'flex', alignItems: 'center' }}>{vendors.length}</span>} />
      <div className="mk-scroll" role="tablist" aria-label={ctx.t('m.mk.all')} style={{ marginBottom: '8px' }}>
        {FILTERS.map(f => (
          <button key={f} role="tab" aria-selected={filter === f} className="mk-chip" onClick={() => { triggerHaptic('selection'); setFilter(f) }}>{ctx.t(`m.mk.f.${f}` as DictKey)}</button>
        ))}
      </div>
      <div key={filter} className="mk-vlist list-in">
        {shown.slice(0, 8).map(v => (
          <Link key={v.id} href={`/vendor/${v.id}`} onClick={tap} className="mk-card mk-vrow press">
            <div className="mk-vthumb" data-morph>{v.image && <Img src={v.image} alt="" width={128} height={128} sizes="64px" />}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="mk-line1" style={{ fontSize: '15px', fontWeight: 700 }}>{v.name}</p>
              <p className="sub mk-line1" style={{ marginTop: '2px', fontSize: '13px' }}>{[ctx.category(v.category), v.neighborhood, km(v)].filter(Boolean).join(' · ')}</p>
            </div>
          </Link>
        ))}
      </div>
      {shown.length > 8 && <Link href="/vendors" className="mk-all" style={{ justifyContent: 'center' }}>{ctx.t('m.common.seeAll')}</Link>}
    </section>
  )
}
