// components/web/VendorCard.tsx
// The one vendor card for the whole desktop web app — Explore, Home rails,
// guides, best-of pages and "You might also like" all render this.

import Link from 'next/link'
import { t, type Lang } from '@/lib/i18n'
import { CATEGORY_LABELS, type VendorCardData } from '@/lib/vendor-types'
import { areaLabel } from '@/lib/areas'
import { ACCESSIBILITY_OPTIONS } from '@/lib/accessibility'

export default function VendorCard({ vendor, lang = 'en' }: { vendor: VendorCardData; lang?: Lang }) {
  const accessShort = vendor.accessibility
    .map(k => ACCESSIBILITY_OPTIONS.find(o => o.key === k)?.short)
    .filter(Boolean)
  return (
    <Link href={`/web/vendor/${vendor.id}`} className="w-card">
      <div className="w-card-media">
        {vendor.image ? (
          <img src={vendor.image} alt={vendor.name} loading="lazy" />
        ) : null}
        {vendor.live ? (
          <span className="w-badge w-badge-left">
            <span className="w-dot w-dot-live" />
            {vendor.whoThere} {t(lang, 'common.hereNow')}
          </span>
        ) : vendor.isPremium ? (
          <span className="w-badge w-badge-left">★ {t(lang, 'common.premium')}</span>
        ) : null}
      </div>
      <div className="w-card-body">
        <h3 className="w-card-title">{vendor.name}</h3>
        <p className="w-card-meta">{CATEGORY_LABELS[vendor.category] ?? vendor.category} · {areaLabel(vendor.area)}</p>
        <div className="w-card-foot">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: vendor.open ? 'var(--w-open)' : 'var(--w-ink-3)', fontWeight: 600 }}>
            <span className={`w-dot ${vendor.open ? 'w-dot-open' : 'w-dot-closed'}`} />
            {vendor.open ? t(lang, 'common.open') : t(lang, 'common.closed')}
          </span>
          {vendor.rating !== null ? (
            <span className="w-rating">
              <span className="star" aria-hidden>★</span>
              {vendor.rating}
              <span className="w-faint" style={{ fontWeight: 500 }}>({vendor.reviewCount})</span>
            </span>
          ) : null}
          {accessShort.length > 0 ? (
            <span className="w-pill" title={vendor.accessibility.join(', ')} style={{ marginLeft: 'auto' }}>♿ {accessShort[0]}</span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
