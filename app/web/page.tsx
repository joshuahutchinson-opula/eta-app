// app/web/page.tsx — Home
import Link from 'next/link'
import FeaturedCarousel from '@/components/web/FeaturedCarousel'
import VibeSection from '@/components/web/VibeSection'
import Parallax from '@/components/web/Parallax'
import ParallaxScope from '@/components/web/ParallaxScope'
import VendorCard from '@/components/web/VendorCard'
import ExperienceCard from '@/components/web/ExperienceCard'
import PhotoSpotTile from '@/components/web/PhotoSpotTile'
import SectionHead from '@/components/web/SectionHead'
import { queryVendors, CATEGORY_LABELS } from '@/lib/vendor-query'
import { getExperiences, getFeaturedVendors, getGuideCover, getPhotoSpots, getVibeMoods, rankPhotoSpots } from '@/lib/web-data'
import { applyVendorPriority } from '@/lib/vendor-priority'
import { GUIDES } from '@/lib/editorial'
import { areaLabel } from '@/lib/areas'
import { getServerLang } from '@/lib/i18n-server'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export default async function WebHome() {
  const lang = getServerLang()
  const [featured, picks, trending, experiences, moods, spots, guideVendors] = await Promise.all([
    getFeaturedVendors(),
    queryVendors({}, { sort: 'recommended' }),
    queryVendors({}, { sort: 'trending', take: 8 }),
    getExperiences(),
    getVibeMoods(),
    getPhotoSpots(),
    Promise.all(GUIDES.map(g => queryVendors({ areas: g.area ? [g.area] : [] }, { sort: 'recommended' })))
  ])
  const guideCovers = await Promise.all(GUIDES.map((g, i) => getGuideCover(g.coverVendor, guideVendors[i].items)))

  // Side tiles follow the editorial priority (the carousel itself doesn't).
  const side = picks.items.filter(v => v.image).slice(0, 3)

  const byRating = [...experiences].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.reviewCount - a.reviewCount)
  const topExperiences = applyVendorPriority(byRating, e => e.vendorName).slice(0, 8)
  const bestSpots = rankPhotoSpots(spots).slice(0, 8)

  return (
    <div className="w-container">
      <ParallaxScope className="w-hero">
        {/* Background layer: drifts slower than the headline in front of it. */}
        <div className="w-hero-bg" data-parallax="0.35" aria-hidden />
        <Parallax speed={0.18}>
          <div className="w-hero-head">
            <div>
              <p className="w-eyebrow">{t(lang, 'home.eyebrow')}</p>
              <h1 className="w-hero-title" style={{ marginTop: 10 }}>{t(lang, 'home.title')}</h1>
            </div>
            <p className="w-hero-dek">{t(lang, 'home.dek')}</p>
          </div>
        </Parallax>

        <div className="w-hero-grid">
          <div className="w-hero-big">
            <FeaturedCarousel vendors={featured} />
          </div>
          {side.map(v => (
            <Link key={v.id} href={`/web/vendor/${v.id}`} className="w-hero-tile">
              <div className="w-parallax-img" data-parallax="0.1" data-parallax-max="24">
                <img src={v.image!} alt={v.name} />
              </div>
              <div className="w-hero-tile-body">
                <h3 className="w-hero-tile-title">{v.name}</h3>
                <p className="w-hero-tile-meta">{CATEGORY_LABELS[v.category]} · {areaLabel(v.area)}</p>
              </div>
            </Link>
          ))}
        </div>
      </ParallaxScope>

      <VibeSection moods={moods} experiences={byRating} />

      {trending.items.length > 0 ? (
        <section className="w-section">
          <SectionHead title={t(lang, 'home.trending')} sub={t(lang, 'home.trendingSub')} href="/web/explore" linkLabel={t(lang, 'common.seeAll')} />
          <div className="w-rail">
            {trending.items.map(v => <VendorCard key={v.id} vendor={v} lang={lang} />)}
          </div>
        </section>
      ) : null}

      {topExperiences.length > 0 ? (
        <section className="w-section">
          <SectionHead title={t(lang, 'home.topExperiences')} sub={t(lang, 'home.topExperiencesSub')} href="/web/experiences" linkLabel={t(lang, 'common.seeAll')} />
          <div className="w-rail">
            {topExperiences.map(e => <ExperienceCard key={e.id} experience={e} lang={lang} />)}
          </div>
        </section>
      ) : null}

      {bestSpots.length > 0 ? (
        <section className="w-section">
          <SectionHead title={t(lang, 'home.photoSpots')} sub={t(lang, 'home.photoSpotsSub')} href="/web/photo-spots" linkLabel={t(lang, 'common.seeAll')} />
          <div className="w-rail">
            {bestSpots.map(s => <PhotoSpotTile key={s.id} spot={s} lang={lang} fixedHeight={340} />)}
          </div>
        </section>
      ) : null}

      <section className="w-section">
        <SectionHead title={t(lang, 'home.guides')} sub={t(lang, 'home.guidesSub')} href="/web/guides" linkLabel={t(lang, 'common.seeAll')} />
        <div className="w-teasers">
          {GUIDES.map((g, i) => (
            <Link key={g.slug} href={`/web/guides/${g.slug}`} className="w-teaser">
              {guideCovers[i] ? <img src={guideCovers[i]!} alt="" loading="lazy" /> : null}
              <div className="w-teaser-body">
                <h3>{g.title}</h3>
                <p>{guideVendors[i].total} {t(lang, 'explore.results')} · {t(lang, 'guides.read')} →</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
