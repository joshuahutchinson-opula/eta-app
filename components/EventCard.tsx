// components/EventCard.tsx — one event card (This Week's Events, All Events, Saved).
'use client'

import Link from 'next/link'
import Icon from '@/lib/icons'
import Price from '@/components/Price'
import Img from '@/components/Img'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'
import { useEventFormat, type EventItem } from '@/lib/events'

export default function EventCard({ ev, width = '240px' }: { ev: EventItem; width?: string }) {
  const { t } = useLang()
  const { when } = useEventFormat()
  return (
    <Link href={`/events/${ev.id}`} onClick={() => triggerHaptic('light')} style={{ textDecoration: 'none', flexShrink: 0, width }}>
      <div className="card" style={{ width: '100%' }}>
        <div className="card-image" style={{ height: '130px', background: 'var(--system-bg-secondary)' }}>
          {ev.imageUrl ? <Img src={ev.imageUrl} alt={ev.title} width={480} height={260} sizes={width === '100%' ? '100vw' : '240px'} /> : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-tertiary)' }}>
              <Icon name="party" size={32} />
            </div>
          )}
          <div className="card-overlay" />
          <div className="card-badge">
            <Icon name="clock" size={11} />
            {when(ev.startAt)}
          </div>
        </div>
        <div className="card-content">
          <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</p>
          <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Icon name="mapPin" size={11} /> {ev.venueName}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            {ev.isFree ? (
              <span className="card-price">{t('m.events.free')}</span>
            ) : ev.price !== null ? (
              <Price usd={ev.price} className="card-price" />
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--label-tertiary)' }}>{t('m.events.priceNotListed')}</span>
            )}
            {ev.interestedCount ? (
              <span style={{ fontSize: '12px', color: 'var(--label-secondary)' }}>
                {ev.interestedCount === 1 ? t('m.events.oneInterested') : t('m.events.interestedCount', { n: ev.interestedCount })}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  )
}
