// components/RightNowStrip.tsx — Home's "Right now": what's live, what's
// open and which events start in the next 3 hours, in the selected region.
// Hidden entirely when there's nothing to show.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import { useRegion } from '@/components/RegionProvider'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

interface Spot { id: string; name: string; neighborhood: string; image: string | null; live: boolean; whoThere: number }
interface SoonEvent { id: string; title: string; venueName: string; imageUrl: string | null; startAt: string }

export default function RightNowStrip() {
  const { t } = useLang()
  const { city, town, ready } = useRegion()
  const [data, setData] = useState<{ live: Spot[]; open: Spot[]; events: SoonEvent[] } | null>(null)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    fetch(`/api/right-now?city=${city}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [city, ready])

  if (!data || data.live.length + data.open.length + data.events.length === 0) return null

  const startsIn = (iso: string) => {
    const mins = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60000))
    return mins < 5 ? t('m.home.startsSoon') : t('m.home.startsIn', { time: mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60 ? `${mins % 60} min` : ''}`.trim() })
  }

  const tile = (key: string, href: string, image: string | null, title: string, badge: React.ReactNode, sub: string) => (
    <Link key={key} href={href} onClick={() => triggerHaptic('light')} className="card" style={{ width: '150px', flexShrink: 0, textDecoration: 'none' }}>
      <div className="card-image" style={{ height: '90px', background: 'var(--system-bg-secondary)' }}>
        {image ? <Img src={image} alt="" width={300} height={180} sizes="150px" /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-tertiary)' }}><Icon name="party" size={24} /></div>}
        <div className="card-badge">{badge}</div>
      </div>
      <div style={{ padding: '8px 10px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--label-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
        <p style={{ fontSize: '12px', color: 'var(--label-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</p>
      </div>
    </Link>
  )

  return (
    <section style={{ marginBottom: '20px' }} aria-label={t('m.home.rightNow')}>
      <div className="section-header" style={{ padding: '0 16px' }}>
        <div className="section-heading">
          <span className="section-eyebrow">{t('m.home.rightNowSub', { town: town.name })}</span>
          <span className="section-title">{t('m.home.rightNow')}</span>
        </div>
      </div>
      <div className="horizontal-scroll" style={{ padding: '4px 16px 8px' }}>
        {data.live.map(v => tile(`l-${v.id}`, `/vendor/${v.id}`, v.image, v.name, <><span className="live-dot" /> {t('m.home.liveNow')}{v.whoThere > 0 ? ` · ${v.whoThere}` : ''}</>, v.neighborhood))}
        {data.events.map(e => tile(`e-${e.id}`, `/events/${e.id}`, e.imageUrl, e.title, <><Icon name="clock" size={11} /> {startsIn(e.startAt)}</>, e.venueName))}
        {data.open.map(v => tile(`o-${v.id}`, `/vendor/${v.id}`, v.image, v.name, <><Icon name="check" size={11} /> {t('m.home.openNow')}</>, v.neighborhood))}
      </div>
    </section>
  )
}
