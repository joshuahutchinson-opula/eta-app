// app/web/page.tsx — A2 Home
import Link from 'next/link'
import AutoVideo from '@/components/web/AutoVideo'
import VendorCard from '@/components/web/VendorCard'
import ExperienceCard from '@/components/web/ExperienceCard'
import PhotoSpotTile from '@/components/web/PhotoSpotTile'
import SectionHead from '@/components/web/SectionHead'
import { queryVendors, CATEGORY_LABELS } from '@/lib/vendor-query'
import { getExperiences, getPhotoSpots, rankPhotoSpots } from '@/lib/web-data'
import { GUIDES } from '@/lib/editorial'
import { areaLabel } from '@/lib/areas'
import { getServerLang } from '@/lib/i18n-server'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export default async function WebHome() {
  const lang = getServerLang()
  const [premium, trending, experiences, spots, guideCovers] = await Promise.all([
    queryVendors({ premiumOnly: true }, { sort: 'recommended' }),
    queryVendors({}, { sort: 'trending', take: 8 }),
    getExperiences(),
    getPhotoSpots(),
    Promise.all(GUIDES.map(g => queryVendors({ areas: g.area ? [g.area] : [] }, { sort: 'recommended' })))
  ])

  // Hero: the top premium vendor with video leads; the next three premium
  // vendors fill the side column.
  const withVideo = premium.items.filter(v => v.video)
  const lead = withVideo[0] ?? premium.items[0] ?? trending.items[0]
  const side = premium.items.filter(v => v.id !== lead?.id && v.image).slice(0, 3)

  const topExperiences = [...experiences].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.reviewCount - a.reviewCount).slice(0, 8)
  const bestSpots = rankPhotoSpots(spots).slice(0, 8)

  return (
    <div className="w-container">
      <section className="w-hero">
        <div className="w-hero-head">
          <div>
            <p className="w-eyebrow">{t(lang, 'home.eyebrow')}</p>
            <h1 className="w-hero-title" style={{ marginTop: 10 }}>{t(lang, 'home.title')}</h1>
          </div>
          <p className="w-hero-dek">{t(lang, 'home.dek')}</p>
        </div>

        {lead ? (
          <div className="w-hero-grid">
            <Link href={`/web/vendor/${lead.id}`} className="w-hero-tile w-hero-big">
              {lead.video ? <AutoVideo src={lead.video} poster={lead.image} /> : lead.image ? <img src={lead.image} alt={lead.name} /> : null}
              <div className="w-hero-tile-body">
                {lead.live ? (
                  <span className="w-pill" style={{ background: 'rgba(255,255,255,0.92)', color: '#14120E', marginBottom: 12 }}>
                    <span className="w-dot w-dot-live" /> {lead.whoThere} {t(lang, 'common.hereNow')}
                  </span>
                ) : null}
                <h2 className="w-hero-tile-title">{lead.name}</h2>
                <p className="w-hero-tile-meta">{CATEGORY_LABELS[lead.category]} · {areaLabel(lead.area)}</p>
              </div>
            </Link>
            {side.map(v => (
              <Link key={v.id} href={`/web/vendor/${v.id}`} className="w-hero-tile">
                <img src={v.image!} alt={v.name} />
                <div className="w-hero-tile-body">
                  <h3 className="w-hero-tile-title">{v.name}</h3>
                  <p className="w-hero-tile-meta">{CATEGORY_LABELS[v.category]} · {areaLabel(v.area)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      {trending.items.length > 0 ? (
        <section className="w-section">
          <SectionHead title={t(lang, 'home.trending')} sub={t(lang, 'home.trendingSub')} href="/web/explore?sort=trending" linkLabel={t(lang, 'common.seeAll')} />
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
          {GUIDES.map((g, i) => {
            const cover = guideCovers[i].items.find(v => v.image)?.image
            return (
              <Link key={g.slug} href={`/web/guides/${g.slug}`} className="w-teaser">
                {cover ? <img src={cover} alt="" loading="lazy" /> : null}
                <div className="w-teaser-body">
                  <h3>{g.title}</h3>
                  <p>{guideCovers[i].total} {t(lang, 'explore.results')} · {t(lang, 'guides.read')} →</p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
