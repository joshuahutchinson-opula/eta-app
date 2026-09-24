// app/web/vendor/[id]/page.tsx — A4 Vendor detail
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import MediaGallery from '@/components/web/MediaGallery'
import VendorCard from '@/components/web/VendorCard'
import Icon from '@/lib/icons'
import { getVendorDetail, formatCity } from '@/lib/web-data'
import { queryVendors, CATEGORY_LABELS } from '@/lib/vendor-query'
import { areaLabel } from '@/lib/areas'
import { accessibilityLabel } from '@/lib/accessibility'
import { getServerLang } from '@/lib/i18n-server'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const vendor = await getVendorDetail(params.id)
  if (!vendor) return { title: 'Vendor not found' }
  return {
    title: `${vendor.name} — ${areaLabel(vendor.area)}, ${formatCity(vendor.city)}`,
    description: vendor.description.slice(0, 160),
    openGraph: { images: vendor.images[0] ? [vendor.images[0]] : [] }
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function countdown(expires: Date): string {
  const min = Math.max(0, Math.floor((expires.getTime() - Date.now()) / 60000))
  return min < 60 ? `${min}m left` : `${Math.floor(min / 60)}h ${min % 60}m left`
}

export default async function VendorDetailPage({ params }: { params: { id: string } }) {
  const lang = getServerLang()
  const vendor = await getVendorDetail(params.id)
  if (!vendor) notFound()

  // Same category first; top up from the same area so the row is never thin.
  const sameCategory = await queryVendors({ categories: [vendor.category], excludeIds: [vendor.id] }, { sort: 'recommended', take: 3 })
  let related = sameCategory.items
  if (related.length < 3) {
    const sameArea = await queryVendors({ areas: [vendor.area], excludeIds: [vendor.id, ...related.map(r => r.id)] }, { take: 3 - related.length })
    related = [...related, ...sameArea.items]
  }

  const bbox = [vendor.lng - 0.006, vendor.lat - 0.004, vendor.lng + 0.006, vendor.lat + 0.004].join(',')
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${vendor.lat},${vendor.lng}`
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${vendor.lat},${vendor.lng}`

  return (
    <div className="w-container">
      <nav aria-label="Breadcrumb" style={{ paddingTop: 24, fontSize: 14 }} className="w-faint">
        <Link href="/web/explore" className="w-muted">{t(lang, 'nav.explore')}</Link>
        {' / '}
        <Link href={`/web/explore?area=${vendor.area}`} className="w-muted">{areaLabel(vendor.area)}</Link>
        {' / '}
        <span>{vendor.name}</span>
      </nav>

      <div className="w-detail">
        <div>
          <MediaGallery name={vendor.name} videos={vendor.videos} images={vendor.images} />

          <h1 className="w-detail-title">{vendor.name}</h1>
          <div className="w-detail-meta">
            <span>{CATEGORY_LABELS[vendor.category]} · {vendor.neighborhood}, {formatCity(vendor.city)}</span>
            {vendor.rating !== null ? (
              <span className="w-rating" style={{ color: 'var(--w-ink)' }}>
                <span className="star" aria-hidden>★</span>{vendor.rating}
                <span className="w-faint" style={{ fontWeight: 500 }}>· {vendor.reviewCount} {t(lang, vendor.reviewCount === 1 ? 'common.review' : 'common.reviews')}</span>
              </span>
            ) : null}
            {vendor.isPremium ? <span className="w-pill">★ {t(lang, 'common.premium')}</span> : null}
          </div>

          <h2 className="w-h2">{t(lang, 'vendor.about')}</h2>
          <div className="w-prose">
            {vendor.description.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
          </div>

          {vendor.accessibility.length > 0 ? (
            <>
              <h2 className="w-h2">{t(lang, 'vendor.accessibility')}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {vendor.accessibility.map(k => <span key={k} className="w-pill">♿ {accessibilityLabel(k)}</span>)}
              </div>
            </>
          ) : null}

          {vendor.experiences.length > 0 ? (
            <>
              <h2 className="w-h2">{t(lang, 'vendor.experiences')}</h2>
              <div style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
                {vendor.experiences.map(e => (
                  <Link key={e.id} href={`/web/experiences/${e.id}`} className="w-mini-card">
                    <img src={e.imageUrl} alt="" />
                    <div>
                      <p style={{ fontWeight: 700 }}>{e.name}</p>
                      <p className="w-muted" style={{ fontSize: 14 }}>{e.tagline}</p>
                    </div>
                    <span style={{ fontWeight: 700 }}>${Math.round(e.price)}</span>
                  </Link>
                ))}
              </div>
            </>
          ) : null}

          <h2 className="w-h2">{t(lang, 'vendor.reviews')}</h2>
          {vendor.reviews.length === 0 ? (
            <p className="w-muted" style={{ maxWidth: 640 }}>
              {t(lang, 'common.noReviews')} — {vendor.name} is new to ETA, so nobody has reviewed it through the app yet.
            </p>
          ) : (
            <div>
              {vendor.reviews.map(r => (
                <article key={r.id} className="w-review">
                  <div className="w-review-head">
                    <span className="w-avatar">
                      {r.user.avatarUrl ? <img src={r.user.avatarUrl} alt="" /> : r.user.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p style={{ fontWeight: 700 }}>{r.user.name}</p>
                      <p className="w-faint" style={{ fontSize: 13 }}>
                        <span style={{ color: 'var(--w-gold)' }} aria-label={`${r.rating} out of 5`}>{'★'.repeat(Math.max(0, Math.min(5, r.rating)))}</span>
                        <span aria-hidden>{'☆'.repeat(Math.max(0, 5 - r.rating))}</span>
                        {' · '}{formatDate(r.createdAt)}
                      </p>
                    </div>
                  </div>
                  {r.comment ? <p style={{ fontSize: 16, lineHeight: 1.6 }}>{r.comment}</p> : null}
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="w-aside">
          <div className="w-panel" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="w-status" style={{ color: vendor.live ? 'var(--w-live)' : vendor.open ? 'var(--w-open)' : 'var(--w-ink-3)' }}>
              <span className={`w-dot ${vendor.live ? 'w-dot-live' : vendor.open ? 'w-dot-open' : 'w-dot-closed'}`} />
              {vendor.live
                ? `${t(lang, 'vendor.liveNow')} · ${vendor.whoThere} ${t(lang, 'common.hereNow')}`
                : vendor.open ? t(lang, 'common.open') : t(lang, 'common.closed')}
            </div>

            {vendor.flashDeals.map(d => (
              <div key={d.id} className="w-deal">
                <Icon name="flame" size={16} style={{ color: 'var(--w-accent-strong)' }} />
                <span style={{ flex: 1 }}>{t(lang, 'vendor.flashDeal')}: {d.deal}</span>
                <span className="w-faint" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{countdown(d.expires)}</span>
              </div>
            ))}

            {vendor.instagram || vendor.website ? (
              <div className="w-socials">
                {vendor.instagram ? (
                  <a className="w-social" href={vendor.instagram} target="_blank" rel="noopener noreferrer" aria-label={`${vendor.name} on Instagram`}>
                    <Icon name="instagram" size={18} />
                  </a>
                ) : null}
                {vendor.website ? (
                  <a className="w-social" href={vendor.website} target="_blank" rel="noopener noreferrer" aria-label={`${vendor.name} website`}>
                    <Icon name="globe" size={18} />
                  </a>
                ) : null}
              </div>
            ) : null}

            <div>
              <Link href={`/vendor/${vendor.id}`} className="w-btn w-btn-primary w-btn-block">{t(lang, 'vendor.openInApp')}</Link>
              <p className="w-faint" style={{ fontSize: 13, marginTop: 10, textAlign: 'center' }}>{t(lang, 'vendor.openInAppHelp')}</p>
            </div>
          </div>

          <div className="w-map">
            <iframe src={mapSrc} title={`Map showing ${vendor.name}`} loading="lazy" tabIndex={-1} />
            <a className="w-map-link" href={directions} target="_blank" rel="noopener noreferrer" aria-label={`${t(lang, 'vendor.directions')} to ${vendor.name}`} />
          </div>
          <a href={directions} target="_blank" rel="noopener noreferrer" className="w-link-arrow" style={{ alignSelf: 'flex-start' }}>
            {t(lang, 'vendor.directions')} →
          </a>
        </aside>
      </div>

      {related.length > 0 ? (
        <section className="w-section">
          <h2 className="w-section-title" style={{ marginBottom: 20 }}>{t(lang, 'vendor.youMightLike')}</h2>
          <div className="w-grid-3">
            {related.map(v => <VendorCard key={v.id} vendor={v} lang={lang} />)}
          </div>
        </section>
      ) : null}
    </div>
  )
}
