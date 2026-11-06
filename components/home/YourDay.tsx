// components/home/YourDay.tsx — Home's "Your Day", only when there's
// something on today (/api/home/day, lib/home.ts yourDay):
//   heading     "Your Day" · "<Weekday> · Day <n> Of <total>" · My Bookings
//   next up     a photo card: "NEXT · IN 45 MIN" with a blinking live dot
//               (ticks live), the crew on a group trip, "<time> · Meet at
//               <place> · <n> min walk", Directions (Walk/Drive · n min)
//               and Ticket (full screen QR, components/home/TicketScreen)
//   later today a timeline: icon circles on a dotted line, each "<title>"
//               and "<time> · <detail>" with a status chip; free gaps of 2+
//               hours say "Free 6:30 – 10 PM · Find dinner nearby →"
//   night       after the last plan: "Today: <n> places · +<pts> pts" with
//               a collage of the day's check-ins; one tap posts it as a story
// Nothing on today: renders nothing and tells the page (onState), which
// hides the separator too.
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import TicketScreen from '@/components/home/TicketScreen'
import { apiJson } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { directionsUrl } from '@/lib/calendar'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'
import { estimateMinutes, haversineKm, type LatLng } from '@/lib/routing'
import { useRegion } from '@/components/RegionProvider'

interface DayItem {
  kind: 'booking' | 'ticket' | 'stop' | 'ride'
  id: string
  title: string
  place: string | null
  at: string | null
  endsAt: string | null
  lat: number | null
  lng: number | null
  href: string
  image: string | null
  qr: string | null
  status: 'ticket' | 'booked' | 'planned'
  crew: Array<{ name: string; avatarUrl: string | null }>
}
interface DayData { items: DayItem[]; upcoming: DayItem[]; recap: { places: number; points: number; photos: string[]; vendorIds: string[] } }

const KIND_ICON = { booking: 'calendar', ticket: 'ticket', stop: 'route', ride: 'car' } as const
const KIND_TONE = { booking: 'rum', ticket: 'gold', stop: 'teal', ride: 'blue' } as const
const GAP_MS = 2 * 3600000
const WALK_MAX_MIN = 20

const TZ = 'America/Jamaica'

export default function YourDay({ refreshKey, day, location, onState }: { refreshKey: number; day: { n: number; total: number } | null; location: LatLng | null; onState: (has: boolean) => void }) {
  const { t, lang } = useLang()
  const errorText = useErrorText()
  const { city } = useRegion()
  const locale = lang === 'en' ? 'en-US' : lang
  const [data, setData] = useState<DayData | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [ticket, setTicket] = useState<DayItem | null>(null)
  const [posting, setPosting] = useState<'idle' | 'busy' | 'done'>('idle')
  const [postError, setPostError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!getCurrentUser()) { setData({ items: [], upcoming: [], recap: { places: 0, points: 0, photos: [], vendorIds: [] } }); return }
    apiJson<DayData>('/api/home/day')
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData({ items: [], upcoming: [], recap: { places: 0, points: 0, photos: [], vendorIds: [] } }) })
    return () => { cancelled = true }
  }, [refreshKey])

  // The countdown ticks live.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(id)
  }, [])

  const time = useCallback((iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: TZ }), [locale])

  // What's still to come (an hour's grace for what just started), live.
  const upcoming = useMemo(() => (data?.upcoming ?? []).filter(i => !i.endsAt || Date.parse(i.endsAt) > now || (i.at && Date.parse(i.at) > now - 3600000)), [data, now])
  const finished = Boolean(data && data.items.length > 0 && upcoming.length === 0)
  const showRecap = finished && (data?.recap.places ?? 0) > 0
  const has = Boolean(data && (upcoming.length > 0 || showRecap))
  useEffect(() => { if (data) onState(has) }, [data, has, onState])

  if (!data || !has) return null

  const weekday = new Date(now).toLocaleDateString(locale, { weekday: 'long', timeZone: TZ })
  const Weekday = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  const title = day ? t('m.yd.titleDay', { weekday: Weekday, n: day.n, total: day.total }) : Weekday

  const head = (
    <div className="home-section-head">
      <div>
        <span className="home-eyebrow">{t('m.yd.eyebrow')}</span>
        <h2 className="home-title">{title}</h2>
      </div>
      <Link href="/bookings" className="section-link">{t('m.yd.myBookings')}</Link>
    </div>
  )

  if (showRecap) {
    const r = data.recap
    const post = async () => {
      if (!r.photos[0]) return
      setPosting('busy')
      setPostError(null)
      try {
        await apiJson('/api/stories', { method: 'POST', body: { imageUrl: r.photos[0], caption: t('m.yd.recapCaption', { n: r.places, pts: r.points }), city, ...(r.vendorIds.length === 1 ? { placeVendorId: r.vendorIds[0] } : {}) } })
        triggerHaptic('medium')
        setPosting('done')
      } catch (e) {
        setPostError(errorText(e))
        setPosting('idle')
      }
    }
    return (
      <section className="home-yourday" aria-label={t('m.yd.eyebrow')}>
        {head}
        <div className="home-card yd-recap">
          <div className={`yd-collage n${Math.min(4, Math.max(1, r.photos.length))}`} aria-hidden>
            {r.photos.slice(0, 4).map(p => <span key={p}><Img src={p} alt="" width={400} height={400} sizes="50vw" /></span>)}
          </div>
          <div style={{ padding: '16px 18px 18px' }}>
            <p className="home-eyebrow" style={{ marginBottom: '4px' }}>{t('m.yd.recapEyebrow')}</p>
            <p className="yd-recap-title">{t('m.yd.recapTitle', { n: r.places, pts: r.points.toLocaleString(locale) })}</p>
            {postError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginTop: '6px' }}>{postError}</p>}
            <button className="btn btn-primary press" onClick={post} disabled={posting !== 'idle' || !r.photos[0]} style={{ marginTop: '12px', width: '100%' }}>
              <Icon name={posting === 'done' ? 'check' : 'camera'} size={16} /> {posting === 'done' ? t('m.yd.recapPosted') : posting === 'busy' ? t('m.stories.posting') : t('m.yd.recapPost')}
            </button>
          </div>
        </div>
      </section>
    )
  }

  const next = upcoming[0]
  const later = upcoming.slice(1)
  const startsIn = next.at ? Math.round((Date.parse(next.at) - now) / 60000) : null
  const pill = startsIn === null ? t('m.yd.nextUntimed')
    : startsIn <= 0 ? t('m.yd.nextNow')
    : startsIn < 60 ? t('m.yd.nextIn', { time: t('m.yd.min', { n: startsIn }) })
    : startsIn < 12 * 60 ? t('m.yd.nextIn', { time: t('m.yd.hMin', { h: Math.floor(startsIn / 60), m: startsIn % 60 }) })
    : t('m.yd.nextAt', { time: time(next.at!) })

  const dist = location && next.lat !== null && next.lng !== null ? haversineKm(location, { lat: next.lat, lng: next.lng }) : null
  const walkMin = dist !== null ? estimateMinutes(dist, 'WALKING') : null
  const walk = walkMin !== null && walkMin <= WALK_MAX_MIN
  const travelMin = dist === null ? null : walk ? walkMin : estimateMinutes(dist, 'TAXI')
  const nav = directionsUrl({ lat: next.lat, lng: next.lng, name: next.place ?? next.title }, walk ? 'walking' : 'driving')
  const line = [
    next.at ? time(next.at) : null,
    next.place ? t('m.yd.meetAt', { place: next.place }) : null,
    travelMin !== null ? (walk ? t('m.yd.minWalk', { n: travelMin }) : t('m.yd.minDrive', { n: travelMin })) : null
  ].filter(Boolean).join(' · ')

  // Later today, with the free gaps of two hours or more between plans.
  const rows: Array<{ type: 'item'; item: DayItem } | { type: 'gap'; from: string; to: string }> = []
  let prevEnd = next.endsAt ?? next.at
  for (const item of later) {
    if (prevEnd && item.at && Date.parse(item.at) - Date.parse(prevEnd) >= GAP_MS) rows.push({ type: 'gap', from: prevEnd, to: item.at })
    rows.push({ type: 'item', item })
    prevEnd = item.endsAt ?? item.at ?? prevEnd
  }
  const meal = (iso: string) => {
    const h = (new Date(iso).getUTCHours() + 19) % 24
    return h < 11 ? t('m.yd.findBreakfast') : h < 16 ? t('m.yd.findLunch') : h < 22 ? t('m.yd.findDinner') : t('m.yd.findDrinks')
  }

  return (
    <section className="home-yourday" aria-label={t('m.yd.eyebrow')}>
      {head}
      <div className="yd-next" style={{ margin: '0 20px' }}>
        <Link href={next.href} onClick={() => triggerHaptic('light')} className="yd-next-media" aria-label={next.title}>
          {next.image ? <Img src={next.image} alt="" width={900} height={420} sizes="100vw" /> : <span className="yd-next-fallback" aria-hidden><Icon name={KIND_ICON[next.kind]} size={44} /></span>}
        </Link>
        <div className="yd-next-shade" aria-hidden />
        <div className="yd-next-top">
          <span className="yd-pill num-font"><span className="live-blink" aria-hidden />{pill}</span>
          {next.crew.length > 0 && (
            <span className="yd-crew" aria-label={next.crew.map(c => c.name).join(', ')}>
              {next.crew.slice(0, 4).map((c, i) => (
                <span key={`${c.name}${i}`} className="yd-avatar" style={{ zIndex: 10 - i }}>{c.avatarUrl ? <img src={c.avatarUrl} alt="" /> : c.name.charAt(0)}</span>
              ))}
              {next.crew.length > 4 && <span className="yd-avatar more num-font">+{next.crew.length - 4}</span>}
            </span>
          )}
        </div>
        <div className="yd-next-body">
          <h3 className="yd-next-title">{next.title}</h3>
          {line && <p className="yd-next-line num-font">{line}</p>}
          <div className="yd-next-actions">
            {nav && (
              <a href={nav} target="_blank" rel="noopener noreferrer" onClick={() => triggerHaptic('light')} className="yd-btn white press">
                <Icon name={walk ? 'walk' : 'car'} size={16} />
                {travelMin !== null ? (walk ? t('m.yd.walkMin', { n: travelMin }) : t('m.yd.driveMin', { n: travelMin })) : t('m.nav.directions')}
              </a>
            )}
            {next.qr && (
              <button onClick={() => setTicket(next)} className="yd-btn frost press">
                <Icon name="qr" size={16} /> {t('m.yd.ticket')}
              </button>
            )}
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="home-card yd-later" style={{ margin: '14px 20px 0' }}>
          <p className="yd-later-head">{t('m.yd.laterToday')}</p>
          <ol className="yd-timeline">
            {rows.map((r, i) => r.type === 'gap' ? (
              <li key={`gap${i}`} className="yd-row gap">
                <span className="yd-dot ghost" aria-hidden><Icon name="sun" size={14} /></span>
                <Link href="/marketplace" className="yd-gap num-font" onClick={() => triggerHaptic('light')}>
                  {t('m.yd.free', { from: time(r.from), to: time(r.to) })} · {meal(r.from)} →
                </Link>
              </li>
            ) : (
              <li key={r.item.id} className="yd-row">
                <span className={`yd-dot ${KIND_TONE[r.item.kind]}`} aria-hidden><Icon name={KIND_ICON[r.item.kind]} size={14} /></span>
                <Link href={r.item.href} className="yd-row-text" onClick={() => triggerHaptic('light')}>
                  <span className="yd-row-title">{r.item.title}</span>
                  <span className="yd-row-sub num-font">{[r.item.at ? time(r.item.at) : t('m.yd.anyTime'), r.item.place].filter(Boolean).join(' · ')}</span>
                </Link>
                <span className={`yd-chip ${r.item.status}`}>
                  {r.item.status === 'ticket' ? t('m.yd.ticketOk') : r.item.status === 'booked' ? t('m.yd.booked') : t('m.yd.planned')}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {ticket?.qr && (
        <TicketScreen
          open
          title={ticket.title}
          when={ticket.at ? new Date(ticket.at).toLocaleString(locale, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: TZ }) : t('m.yd.anyTime')}
          place={ticket.place}
          qr={ticket.qr}
          onClose={() => setTicket(null)}
        />
      )}
    </section>
  )
}
