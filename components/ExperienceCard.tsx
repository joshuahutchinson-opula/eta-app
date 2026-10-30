// components/ExperienceCard.tsx — a curated experience card (Home row, browse
// list, vendor pages). Opens the experience's own page. Stop count and length
// only show when the route data exists.
'use client'

import Link from 'next/link'
import Price from '@/components/Price'
import { triggerHaptic } from '@/lib/haptics'
import { useLang } from '@/lib/i18n-client'

export interface ExperienceCardData {
  id: string
  name: string
  tagline: string
  price: number
  imageUrl: string
  stops?: Array<unknown>
  totalDuration?: number | null
  rating?: number | null
  reviewCount?: number | null
  bookedToday?: number
}

export default function ExperienceCard({ exp, width = '260px', imageHeight = '140px' }: { exp: ExperienceCardData; width?: string; imageHeight?: string }) {
  const { t } = useLang()
  const details = [
    exp.stops && exp.stops.length > 0 ? t('m.exp.stops', { n: exp.stops.length }) : null,
    exp.totalDuration ? `${exp.totalDuration} hrs` : null
  ].filter(Boolean)
  return (
    <Link href={`/experiences/${exp.id}`} onClick={() => triggerHaptic('light')} style={{ textDecoration: 'none', flexShrink: 0, width }}>
      <div className="card">
        <div className="card-image" style={{ height: imageHeight }}>
          <img src={exp.imageUrl} alt={exp.name} />
          <div className="card-overlay" />
        </div>
        <div className="card-content">
          <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '2px' }}>{exp.name}</h3>
          <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '6px' }}>{exp.tagline}</p>
          {exp.rating ? (
            <div className="rating-text" style={{ marginBottom: '6px' }}>
              <span style={{ color: 'var(--gold)' }} aria-hidden>★</span> <span className="num-font">{exp.rating}</span>
              {exp.reviewCount ? <span> · <span className="num-font">{exp.reviewCount}</span></span> : null}
            </div>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Price usd={exp.price} className="card-price" />
            {details.length > 0 && (
              <span className="num-font" style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{details.join(' · ')}</span>
            )}
          </div>
          {exp.bookedToday ? (
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '4px' }}>{t('m.exp.bookedToday', { n: exp.bookedToday })}</p>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
