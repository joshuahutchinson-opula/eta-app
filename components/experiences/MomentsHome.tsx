// components/experiences/MomentsHome.tsx — the Experiences tab's first
// screen (docs/mockups/ExpMoments.dc.html). It changes with the time of day
// and the weather (lib/moments.ts):
//   top bar     Experiences, the location pill, search
//   the moment  one big swipeable card (story-style progress bars, live
//               badge, start time, distance, spots left, who's going or
//               booked today). Experiences: "Reserve" with "$X · pay there
//               with ETA Pay for 2× points" (nothing is paid online).
//               Parties: "Buy Ticket" (free ones: "Free Entry"). Save beside it.
//               Paid "Featured" moments are always labelled.
//   Plan My Day straight under it (the quick planner); its answers (vibe,
//               time, group) steer which moments are picked
//   Your trip   only when there is one
//   Up Next     tall video tiles in start-time order
//   Parties & Happenings  a compact strip: Tonight, or Right Now at night
// Tapping a card grows its image into the detail page (lib/morph.ts).
// Reduce Motion: no auto-advance, no Ken Burns, fades only.
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import SmartVideo from '@/components/SmartVideo'
import ErrorState from '@/components/ErrorState'
import RegionPill from '@/components/home/RegionPill'
import ReserveSheet from '@/components/experiences/ReserveSheet'
import { useRegion } from '@/components/RegionProvider'
import { useTabActive, useTabShow } from '@/components/TabKeeper'
import { useLang } from '@/lib/i18n-client'
import { useCurrency } from '@/lib/currency'
import { useUserLocation } from '@/lib/geo'
import { useReducedMotion } from '@/lib/motion'
import { triggerHaptic, hapticSaved } from '@/lib/haptics'
import { readSaved, toggleSaved, SAVED_EVENT } from '@/lib/saved'
import { apiJson } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { minutesTo, clockAt } from '@/components/market/bits'
import type { DictKey } from '@/lib/i18n'
import type { Moment, MomentsData } from '@/lib/moments'

export interface YourTripRow {
  name: string
  image: string | null
  status: string
  onOpen: () => void
}

export const MOMENT_PREFS_KEY = 'eta_moment_prefs'
export const MOMENT_PREFS_EVENT = 'eta-moment-prefs'

/** Plan My Day answers, remembered so the moments lean that way. */
export function rememberMomentPrefs(p: { mood: string | null; time: string; crew: number }) {
  try { localStorage.setItem(MOMENT_PREFS_KEY, JSON.stringify(p)) } catch {}
  window.dispatchEvent(new Event(MOMENT_PREFS_EVENT))
}
function readPrefs(): { mood?: string | null; time?: string; crew?: number } {
  try { return JSON.parse(localStorage.getItem(MOMENT_PREFS_KEY) || '{}') ?? {} } catch { return {} }
}

const SLIDE_MS = 6000
const FACE_TONES = ['#C4654F', '#2E7D8C', '#3B3F6B']

export default function MomentsHome({ onPlan, yourTrip }: { onPlan: () => void; yourTrip: YourTripRow | null }) {
  const router = useRouter()
  const { t, lang } = useLang()
  const locale = lang === 'en' ? 'en-US' : lang
  const { format } = useCurrency()
  const reduce = useReducedMotion()
  const visible = useTabActive('/experiences')
  const { city, town, ready } = useRegion()
  const location = useUserLocation()
  const [data, setData] = useState<MomentsData | null>(null)
  const [failed, setFailed] = useState(false)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [saved, setSaved] = useState<{ experiences: string[]; events: string[] }>({ experiences: [], events: [] })
  const [reserve, setReserve] = useState<Moment | null>(null)
  const [busy, setBusy] = useState(false)
  const drag = useRef<{ x: number; y: number } | null>(null)

  const load = useCallback(async () => {
    setFailed(false)
    const p = readPrefs()
    const q = new URLSearchParams({ city })
    if (p.mood) q.set('mood', p.mood)
    if (p.time) q.set('time', p.time)
    if (p.crew) q.set('crew', String(p.crew))
    try {
      const res = await fetch(`/api/experiences/moments?${q}`)
      if (!res.ok) throw new Error('moments')
      const next: MomentsData = await res.json()
      setData(prev => {
        // Same first moment: keep your place in the card.
        if (!prev || prev.hero[0]?.id !== next.hero[0]?.id) setIndex(0)
        return next
      })
    } catch {
      setFailed(true)
    }
  }, [city])

  useEffect(() => { if (ready) load() }, [ready, load])
  useTabShow('/experiences', () => { if (ready) load() })
  // The tab moves on with the day: refresh every few minutes, and when the planner answers change.
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') load() }, 5 * 60000)
    window.addEventListener(MOMENT_PREFS_EVENT, load)
    return () => { clearInterval(id); window.removeEventListener(MOMENT_PREFS_EVENT, load) }
  }, [load])

  useEffect(() => {
    const read = () => setSaved({ experiences: readSaved('experiences'), events: readSaved('events') })
    read()
    window.addEventListener(SAVED_EVENT, read)
    return () => window.removeEventListener(SAVED_EVENT, read)
  }, [])

  const hero = data?.hero ?? []
  const n = hero.length
  const current = hero[Math.min(index, Math.max(0, n - 1))] ?? null

  // Story-style: move to the next moment every few seconds (not with Reduce Motion).
  useEffect(() => {
    if (reduce || paused || !visible || n < 2 || reserve) return
    const id = setTimeout(() => setIndex(i => (i + 1) % n), SLIDE_MS)
    return () => clearTimeout(id)
  }, [index, n, reduce, paused, visible, reserve])

  const go = (d: number) => {
    if (n < 2) return
    triggerHaptic('selection')
    setIndex(i => (i + d + n) % n)
  }
  const onTouchStart = (e: React.TouchEvent) => { drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; setPaused(true) }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = drag.current
    drag.current = null
    setPaused(false)
    if (!s) return
    const dx = e.changedTouches[0].clientX - s.x
    const dy = e.changedTouches[0].clientY - s.y
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
  }

  const href = (m: { kind: string; id: string }) => m.kind === 'event' ? `/events/${m.id}` : `/experiences/${m.id}`
  const isSaved = (m: Moment) => (m.kind === 'event' ? saved.events : saved.experiences).includes(m.id)
  const save = (m: Moment) => { hapticSaved(); toggleSaved(m.kind === 'event' ? 'events' : 'experiences', m.id) }
  const minsAway = (m: { lat: number | null; lng: number | null }) => {
    if (!location) return null
    const r = minutesTo(location, m)
    return r ? t('m.mo.minAway', { n: r.min }) : null
  }
  const time = (iso: string) => clockAt(iso, locale)
  const price = (usd: number | null) => usd == null ? null : usd === 0 ? t('m.events.free') : format(usd)

  const badge = (m: Moment) => {
    if (m.live) return t('m.mo.liveNow')
    if (m.tomorrow) return t('m.mo.tomorrowAt', { time: time(m.startAt) })
    if (data?.rain && m.indoor) return t('m.mo.indoorsStarts', { time: time(m.startAt) })
    return t('m.mo.startsAt', { time: time(m.startAt) })
  }
  const meta = (m: Moment) => [
    m.place,
    minsAway(m),
    m.kind === 'experience'
      ? (m.spotsLeft != null ? (m.spotsLeft === 1 ? t('m.mo.oneSpot') : t('m.mo.spotsLeft', { n: m.spotsLeft })) : null)
      : (m.endAt ? t('m.mo.till', { time: time(m.endAt) }) : null)
  ].filter(Boolean).join(' · ')
  const social = (m: Moment) => {
    if (data?.rain && m.kind === 'experience' && m.indoor) return t('m.mo.rain2x')
    if (m.kind === 'experience') return m.social.n > 0 ? t('m.mo.bookedToday', { n: m.social.n }) : t('m.mo.beFirst')
    if (m.social.n === 0) return null
    return m.live || data?.daypart === 'night' ? t('m.mo.going', { n: m.social.n }) : t('m.mo.goingTonight', { n: m.social.n })
  }

  // The main button.
  const act = async (m: Moment) => {
    triggerHaptic('medium')
    if (m.kind === 'experience') { setReserve(m); return }
    if (m.isFree) {
      // Free entry: RSVP (interest) right here when signed in.
      if (!getCurrentUser()) { router.push(`/login?next=/events/${m.id}`); return }
      setBusy(true)
      try { await apiJson(`/api/events/${m.id}/interest`, { method: 'POST', body: { interested: true } }) } catch {}
      setBusy(false)
      router.push(`/events/${m.id}`)
      return
    }
    router.push(`/events/${m.id}?buy=1`)
  }
  const cta = (m: Moment) => {
    if (m.kind === 'experience') return { label: t('m.mo.reserve'), line: m.price != null ? t('m.mo.payThere', { price: format(m.price) }) : null }
    if (m.isFree) return { label: t('m.mo.freeEntry'), line: t('m.mo.rsvpLine') }
    return { label: m.price != null ? t('m.mo.buyTicketPrice', { price: format(m.price) }) : t('m.mo.buyTicket'), line: t('m.mo.doorPay') }
  }

  const ebKey: DictKey = data?.mode === 'rain'
    ? (data.daypart === 'morning' ? 'm.mo.eb.rainMorning' : data.daypart === 'night' ? 'm.mo.eb.rainNight' : 'm.mo.eb.rainAfternoon')
    : (`m.mo.eb.${data?.daypart ?? 'afternoon'}` as DictKey)
  // After midnight, what's next is the morning: "Later Today", not "Still On Tonight".
  const smallHours = data?.daypart === 'night' && new Date(Date.now() - 5 * 3600000).getUTCHours() < 5
  const nextKey: DictKey = data?.mode === 'rain' ? 'm.mo.next.rain' : smallHours ? 'm.mo.next.morning' : (`m.mo.next.${data?.daypart ?? 'afternoon'}` as DictKey)
  const upNext = data?.upNext ?? []
  const parties = data?.parties.items ?? []
  const faces = useMemo(() => FACE_TONES, [])

  return (
    <main className="mo">
      <header className="mo-top">
        <h1>{t('m.mo.title')}</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <RegionPill />
          <Link href="/search" aria-label={t('m.mo.search')} className="mk-icon-btn press" onClick={() => triggerHaptic('light')}><Icon name="search" size={18} /></Link>
        </div>
      </header>

      <div className="mo-body">
        {/* THE MOMENT */}
        {!data ? (
          failed ? <ErrorState onRetry={load} /> : (
            <div aria-hidden>
              <div className="skeleton-card" style={{ width: '60%', height: '14px', borderRadius: '6px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
              <div className="skeleton-card" style={{ height: '470px', borderRadius: '24px', marginTop: '8px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
            </div>
          )
        ) : (
          <div key={city} className="content-fade-in">
            <p className="mo-eb">{t(ebKey, { town: town.name })}</p>
            {current ? (
              <section className="mo-card" data-morph-card aria-roledescription="carousel" aria-label={t(ebKey, { town: town.name })} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
                {hero.map((m, i) => {
                  const on = i === index
                  return (
                    <div key={`${m.kind}-${m.id}`} className={`mo-slide ${on ? 'on' : ''}`} aria-hidden={!on}>
                      <span className="mo-media" data-morph={on ? '' : undefined}>
                        {m.video && !reduce
                          ? <SmartVideo src={m.video} poster={m.image} active={on && visible} />
                          : m.image ? <span className="mo-kb"><Img src={m.image} alt="" width={1080} height={1300} sizes="100vw" priority={i === 0} /></span> : null}
                      </span>
                      <span className="mo-scrim" />
                    </div>
                  )
                })}
                {/* Tap the picture to open it */}
                <button className="mo-open" data-morph-open aria-label={current.title} onClick={() => { triggerHaptic('light'); router.push(href(current)) }} />

                {n > 1 && (
                  <div className="mo-bars" aria-hidden>
                    {hero.map((m, i) => (
                      <span key={m.id} className={`mo-bar ${i < index ? 'done' : i === index ? `now ${paused || !visible ? 'paused' : ''}` : ''}`} style={{ '--dur': `${SLIDE_MS}ms` } as React.CSSProperties}>
                        <i />
                      </span>
                    ))}
                  </div>
                )}
                <div className="mo-badges">
                  <span className="mo-badge">{(current.live || !current.tomorrow) && <span className="mo-live" aria-hidden />}{badge(current)}</span>
                  {current.featured
                    ? <span className="mo-badge gold" title={t('m.mo.featuredNote')}>{t('m.mo.featured')}</span>
                    : current.picked ? <span className="mo-badge soft">{t('m.mo.etaPick')}</span>
                    : current.video ? <span className="mo-badge soft">{t('m.mo.video')}</span> : null}
                </div>

                <div key={`${current.kind}-${current.id}`} className="mo-info swap-fade">
                  <p className="mo-title">{current.title}</p>
                  <p className="mo-meta">{current.note ?? meta(current)}</p>
                  {social(current) && (
                    <div className="mo-social">
                      {!(data.rain && current.indoor && current.kind === 'experience') && current.social.n > 0 && <span className="mo-faces" aria-hidden>{faces.map(c => <span key={c} style={{ background: c }} />)}</span>}
                      <span>{social(current)}</span>
                    </div>
                  )}
                  <div className="mo-actions">
                    <button className="mo-cta press" onClick={() => act(current)} disabled={busy}>
                      {current.kind === 'event' && !current.isFree && <Icon name="ticket" size={17} />}
                      {cta(current).label}
                    </button>
                    <button className="mo-save press" aria-pressed={isSaved(current)} aria-label={isSaved(current) ? t('m.mo.saved') : t('m.mo.save')} onClick={() => save(current)}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill={isSaved(current) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 3h12v18l-6-4-6 4z" /></svg>
                    </button>
                  </div>
                  {cta(current).line && <p className="mo-pay">{cta(current).line}</p>}
                </div>
                {n > 1 && <span className="sr-only" aria-live="polite">{t('m.mo.momentN', { n: index + 1, total: n })}</span>}
              </section>
            ) : (
              <div className="mk-card" style={{ marginTop: '8px', padding: '28px 20px', textAlign: 'center' }}>
                <Icon name="sparkle" size={28} style={{ color: 'var(--rum-text)' }} />
                <p style={{ marginTop: '10px', fontSize: '17px', fontWeight: 700 }}>{t('m.mo.emptyTitle', { town: town.name })}</p>
                <p className="sub" style={{ marginTop: '4px', fontSize: '14px' }}>{t('m.mo.emptyBody')}</p>
              </div>
            )}
          </div>
        )}

        {/* PLAN MY DAY */}
        <button className="mo-plan press" onClick={() => { triggerHaptic('light'); onPlan() }}>
          <span className="mo-plan-ic" aria-hidden><Icon name="sparkle" size={18} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '15px', fontWeight: 700 }}>{t('m.mo.plan')}</span>
            <span className="sub" style={{ display: 'block', fontSize: '13px' }}>{t('m.mo.planSub')}</span>
          </span>
          <Icon name="chevronRight" size={14} style={{ color: 'var(--rum-text)' }} />
        </button>

        {yourTrip && (
          <button className="mo-plan press" onClick={() => { triggerHaptic('light'); yourTrip.onOpen() }} style={{ marginTop: '8px' }}>
            <span className="mo-plan-ic" aria-hidden style={{ overflow: 'hidden', position: 'relative' }}>
              {yourTrip.image ? <Img src={yourTrip.image} alt="" width={72} height={72} sizes="36px" /> : <Icon name="route" size={18} />}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{yourTrip.name}</span>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--rum-text)' }}>{yourTrip.status}</span>
            </span>
            <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
          </button>
        )}

        {/* UP NEXT */}
        {upNext.length > 0 && (
          <section style={{ marginTop: '32px' }} aria-label={t('m.mo.upNext')}>
            <p className="mo-eb">{t(nextKey)}</p>
            <h2 className="mo-st" style={{ marginBottom: '12px' }}>{t('m.mo.upNext')}</h2>
            <div className="mo-scroll list-in">
              {upNext.map(m => (
                <Link key={`${m.kind}-${m.id}`} href={href(m)} onClick={() => triggerHaptic('light')} className="mo-tile press">
                  <span className="mo-media" data-morph>
                    {m.video && !reduce ? <SmartVideo src={m.video} poster={m.image} active={visible} /> : m.image ? <Img src={m.image} alt="" width={300} height={500} sizes="150px" /> : null}
                  </span>
                  <span className="mo-tile-shade" />
                  <span className="mo-time num">{m.live ? t('m.mo.liveNow') : time(m.startAt)}</span>
                  <div className="mo-tile-text">
                    <p style={{ fontSize: '15px', fontWeight: 700, lineHeight: 1.2 }}>{m.title}</p>
                    <p style={{ marginTop: '4px', fontSize: '12px', color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[m.tomorrow ? t('m.mo.tomorrow') : m.place, price(m.price)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* PARTIES & HAPPENINGS */}
        {parties.length > 0 && data && (
          <section style={{ marginTop: '32px' }} aria-label={t('m.mo.parties')}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div><p className="mo-eb">{t('m.mo.parties')}</p><h2 className="mo-st">{data.parties.when === 'now' ? t('m.mo.rightNow') : t('m.mo.tonight')}</h2></div>
              <Link href="/events" style={{ minHeight: '44px', display: 'flex', alignItems: 'center', fontSize: '15px', fontWeight: 600, color: 'var(--rum-text)' }}>{t('m.common.seeAll')}</Link>
            </div>
            <div className="list-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              {parties.map(p => (
                <Link key={p.id} href={`/events/${p.id}`} onClick={() => triggerHaptic('light')} className="mo-party press">
                  <span className="mo-thumb" data-morph>{p.image && <Img src={p.image} alt="" width={112} height={112} sizes="56px" />}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '15px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</p>
                    <p className="sub" style={{ marginTop: '2px', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.venue} · {p.live ? t('m.mo.onNow') : time(p.startAt)}</p>
                  </div>
                  {price(p.isFree ? 0 : p.price) && <span className="mo-price num">{price(p.isFree ? 0 : p.price)}</span>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <ReserveSheet moment={reserve} onClose={() => setReserve(null)} onReserved={load} />
    </main>
  )
}
