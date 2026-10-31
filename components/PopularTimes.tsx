// components/PopularTimes.tsx — today's busyness by hour, from real ETA
// check-ins (lib/popular-times.ts). The API sends nothing when there aren't
// enough check-ins, and this renders nothing then.
'use client'

import { useLang } from '@/lib/i18n-client'
import { formatTime } from '@/lib/hours'
import { DAYS } from '@/lib/hours'
import type { PopularTimes as Data } from '@/lib/popular-times'

const FIRST_HOUR = 6

export default function PopularTimes({ data }: { data: Data | null | undefined }) {
  const { t } = useLang()
  if (!data) return null
  const hours = data.hours.map((v, h) => ({ v, h })).filter(x => x.h >= FIRST_HOUR)
  const day = t(`m.day.${DAYS[data.weekday]}` as 'm.day.mon')
  return (
    <section className="card" style={{ padding: '14px 16px', marginBottom: '20px', cursor: 'default' }} aria-label={t('m.vendor.popular')}>
      <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>{t('m.vendor.popular')}</p>
      <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '10px' }}>{t('m.vendor.popularSub', { day })}</p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '72px' }} role="img" aria-label={t('m.vendor.busiest', { time: formatTime(`${data.peakHour}:00`) })}>
        {hours.map(({ v, h }) => (
          <div key={h} title={formatTime(`${h}:00`)} style={{ flex: 1, height: `${Math.max(4, v * 100)}%`, borderRadius: '3px 3px 0 0', background: h === data.currentHour ? 'var(--rum)' : 'var(--rum-tint)' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--label-tertiary)', marginTop: '4px' }}>
        <span>{formatTime(`${FIRST_HOUR}:00`)}</span><span>{formatTime('12:00')}</span><span>{formatTime('18:00')}</span><span>{formatTime('23:00')}</span>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--label-primary)', marginTop: '8px' }}>{t('m.vendor.busiest', { time: formatTime(`${data.peakHour}:00`) })}</p>
    </section>
  )
}
