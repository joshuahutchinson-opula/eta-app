// components/web/ExperienceCard.tsx
import Link from 'next/link'
import { t, type Lang } from '@/lib/i18n'
import { formatCity } from '@/lib/format'
import type { ExperienceCardData } from '@/lib/web-data'

export default function ExperienceCard({ experience: e, lang = 'en' }: { experience: ExperienceCardData; lang?: Lang }) {
  return (
    <Link href={`/web/experiences/${e.id}`} className="w-card">
      <div className="w-card-media">
        <img src={e.imageUrl} alt={e.name} loading="lazy" />
        <span className="w-badge w-badge-right">${Math.round(e.price)}</span>
      </div>
      <div className="w-card-body">
        <h3 className="w-card-title">{e.name}</h3>
        <p className="w-card-meta">{e.tagline}</p>
        <div className="w-card-foot">
          <span className="w-muted">
            {e.vendorName ? `${t(lang, 'exp.hostedBy')} ${e.vendorName}` : formatCity(e.city)}
          </span>
          {e.rating !== null ? (
            <span className="w-rating" style={{ marginLeft: 'auto' }}>
              <span className="star" aria-hidden>★</span>{e.rating}
              <span className="w-faint" style={{ fontWeight: 500 }}>({e.reviewCount})</span>
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
