// components/home/HomeEvents.tsx — Home's "Parties & Happenings · This
// Week": promoter events for the selected region over the next 7 days,
// with an empty message when nothing is on, as cards with
// a calendar date tile (red weekday strip, big day number) and a red
// "Tonight" tag on tonight's. Long-press opens the quick preview.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import Price from '@/components/Price'
import ErrorState from '@/components/ErrorState'
import { SectionHead } from '@/components/home/bits'
import { useLongPress } from '@/components/home/QuickPreview'
import { useRegion } from '@/components/RegionProvider'
import { useLang } from '@/lib/i18n-client'
import { useEventFormat, type EventItem } from '@/lib/events'
import { triggerHaptic } from '@/lib/haptics'

const TZ = 'America/Jamaica'
const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ })

/** The calendar tile: weekday on a red strip, the day number big. */
export function DateTile({ iso, small = false }: { iso: string; small?: boolean }) {
  const { lang } = useLang()
  const d = new Date(iso)
  const locale = lang === 'en' ? 'en-US' : lang
  return (
    <span className={`date-tile ${small ? 'small' : ''}`} aria-hidden>
      <span className="date-tile-day">{d.toLocaleDateString(locale, { weekday: 'short', timeZone: TZ }).replace('.', '')}</span>
      <span className="date-tile-num num-font">{d.toLocaleDateString('en-US', { day: 'numeric', timeZone: TZ })}</span>
    </span>
  )
}

/** "Tonight" from 3 pm on the event's day. */
export const isTonight = (iso: string) => dayKey(new Date(iso)) === dayKey(new Date()) && (new Date(iso).getUTCHours() + 19) % 24 >= 15

function Card({ ev, onPreview }: { ev: EventItem; onPreview: (ev: EventItem) => void }) {
  const { t } = useLang()
  const { when } = useEventFormat()
  const press = useLongPress(() => onPreview(ev))
  const image = ev.imageUrl || ev.vendor?.images?.[0] || null
  return (
    <Link href={`/events/${ev.id}`} onClick={() => triggerHaptic('light')} className="hev-card press" {...press}>
      <div className="hev-media">
        {image ? <Img src={image} alt={ev.title} width={560} height={320} sizes="72vw" /> : <span className="hev-fallback" aria-hidden><Icon name="party" size={32} /></span>}
        <DateTile iso={ev.startAt} />
        {isTonight(ev.startAt) && <span className="tonight-tag">{t('m.events.window.tonight')}</span>}
      </div>
      <div className="hev-body">
        <p className="hev-title">{ev.title}</p>
        <p className="hev-meta num-font"><Icon name="clock" size={11} /> {when(ev.startAt)}</p>
        <p className="hev-meta"><Icon name="mapPin" size={11} /> {ev.venueName}</p>
        <p className="hev-price">
          {ev.isFree ? t('m.events.free') : ev.price !== null ? <Price usd={ev.price} /> : <span style={{ color: 'var(--label-tertiary)', fontWeight: 500 }}>{t('m.events.priceNotListed')}</span>}
          {ev.interestedCount ? <span className="hev-interest">{ev.interestedCount === 1 ? t('m.events.oneInterested') : t('m.events.interestedCount', { n: ev.interestedCount })}</span> : null}
        </p>
      </div>
    </Link>
  )
}

export default function HomeEvents({ onPreview }: { onPreview: (ev: EventItem) => void }) {
  const { city, town, ready } = useRegion()
  const { t } = useLang()
  const [events, setEvents] = useState<EventItem[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const res = await fetch(`/api/events?city=${city}&days=7&limit=10`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEvents(Array.isArray(data) ? data : [])
    } catch {
      setFailed(true)
    }
  }, [city])

  useEffect(() => { if (ready) { setEvents(null); load() } }, [ready, load])

  return (
    <div>
      <SectionHead eyebrow={t('m.ph2.eyebrow')} title={t('m.ph2.title')} href="/events" linkLabel={t('m.events.seeAll')} />
      {failed ? (
        <div style={{ padding: '0 20px' }}><ErrorState compact onRetry={load} /></div>
      ) : events === null ? (
        <div className="horizontal-scroll" style={{ padding: '4px 20px 12px' }}>
          {[0, 1].map(i => <div key={i} className="home-skel" style={{ width: '72%', height: '262px', flexShrink: 0 }} aria-hidden />)}
        </div>
      ) : events.length === 0 ? (
        <p style={{ padding: '4px 20px 0', fontSize: '14px', color: 'var(--label-secondary)' }}>{t('m.events.empty', { town: town.name })}</p>
      ) : (
        <div className="horizontal-scroll hev-row" style={{ padding: '4px 20px 12px' }}>
          {events.map(ev => <Card key={ev.id} ev={ev} onPreview={onPreview} />)}
        </div>
      )}
    </div>
  )
}
