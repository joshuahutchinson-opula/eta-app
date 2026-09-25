// components/web/VendorCard.tsx
// The one vendor card for the whole desktop web app — Explore, Home rails,
// guides, best-of pages and "You might also like" all render this.

import Link from 'next/link'
import { t, type Lang } from '@/lib/i18n'
import { CATEGORY_LABELS, type VendorCardData } from '@/lib/vendor-types'
import { areaLabel } from '@/lib/areas'
import { ACCESSIBILITY_OPTIONS } from '@/lib/accessibility'
import { categoryStyle, priceTier, vendorPitch } from '@/lib/vendor-style'

export default function VendorCard({ vendor, lang = 'en' }: { vendor: VendorCardData; lang?: Lang }) {
  const accessShort = vendor.accessibility
    .map(k => ACCESSIBILITY_OPTIONS.find(o => o.key === k)?.short)
    .filter(Boolean)
  const cat = categoryStyle(vendor.category)
  const tier = priceTier(vendor.priceRange)
  const pitch = vendorPitch(vendor.description)
  return (
    <Link href={`/web/vendor/${vendor.id}`} className="w-card" style={{ ['--cat' as string]: cat.color }}>
      <div className="w-card-media w-card-media-cat">
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
        <h3 className="w-card-title">
          <span className={`w-dot ${vendor.open ? 'w-dot-open' : 'w-dot-closed'}`} title={vendor.open ? t(lang, 'common.open') : t(lang, 'common.closed')} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          {vendor.name}
        </h3>
        <p className="w-card-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="w-cat-chip">{CATEGORY_LABELS[vendor.category] ?? cat.label}</span>
          <span aria-label={`Price ${tier} of 4`} style={{ fontWeight: 700, letterSpacing: '0.04em' }}>
            <span style={{ color: 'var(--cat)' }}>{'$'.repeat(tier)}</span><span className="w-faint">{'$'.repeat(4 - tier)}</span>
          </span>
          <span>{areaLabel(vendor.area)}</span>
        </p>
        {pitch ? <p className="w-card-pitch">{pitch}</p> : null}
        <div className="w-card-foot">
          {vendor.rating !== null ? (
            <span className="w-rating">
              <span className="star" aria-hidden>★</span>
              {vendor.rating.toFixed(1)}
              <span className="w-faint" style={{ fontWeight: 500 }}>({vendor.reviewCount} {t(lang, vendor.reviewCount === 1 ? 'common.review' : 'common.reviews')})</span>
            </span>
          ) : (
            <span className="w-faint" style={{ fontWeight: 600 }}>New on ETA</span>
          )}
          {accessShort.length > 0 ? (
            <span className="w-pill" title={vendor.accessibility.join(', ')} style={{ marginLeft: 'auto' }}>♿ {accessShort[0]}</span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
