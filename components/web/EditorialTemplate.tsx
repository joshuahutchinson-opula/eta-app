// components/web/EditorialTemplate.tsx
// Renders any EditorialPage from lib/editorial.ts: destination guides (A7)
// and best-of SEO pages (B6). Copy sections render as written; every data
// section runs its query definition against the live database, so the
// lists update as vendors join, go live or get reviewed.

import Link from 'next/link'
import VendorCard from '@/components/web/VendorCard'
import ExperienceCard from '@/components/web/ExperienceCard'
import PhotoSpotTile from '@/components/web/PhotoSpotTile'
import { queryVendors } from '@/lib/vendor-query'
import { getExperiences, getPhotoSpots } from '@/lib/web-data'
import { filterToSearch } from '@/lib/vendor-filter-params'
import type { EditorialPage, EditorialSection } from '@/lib/editorial'
import { t, type Lang } from '@/lib/i18n'

async function resolveSection(section: EditorialSection) {
  switch (section.type) {
    case 'vendors': {
      const res = await queryVendors(section.filter, { sort: section.sort ?? 'recommended', take: section.limit })
      return { section, vendors: res.items, total: res.total }
    }
    case 'photospots': {
      const spots = await getPhotoSpots({ city: section.city, bestTimes: section.bestTimes })
      return { section, spots: section.limit ? spots.slice(0, section.limit) : spots }
    }
    case 'experiences': {
      const exps = await getExperiences({ city: section.city })
      return { section, experiences: section.limit ? exps.slice(0, section.limit) : exps }
    }
    default:
      return { section }
  }
}

export default async function EditorialTemplate({ page, lang, related }: { page: EditorialPage; lang: Lang; related?: EditorialPage[] }) {
  const resolved = await Promise.all(page.sections.map(resolveSection))

  const hero =
    resolved.flatMap(r => ('vendors' in r && r.vendors ? r.vendors.map(v => v.image) : [])).find(Boolean) ??
    resolved.flatMap(r => ('spots' in r && r.spots ? r.spots.map(s => s.officialPhoto) : [])).find(Boolean) ??
    resolved.flatMap(r => ('experiences' in r && r.experiences ? r.experiences.map(e => e.imageUrl) : [])).find(Boolean)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: page.title,
    itemListElement: resolved
      .flatMap(r => ('vendors' in r && r.vendors ? r.vendors : []))
      .map((v, i) => ({ '@type': 'ListItem', position: i + 1, name: v.name, url: `/web/vendor/${v.id}` }))
  }

  return (
    <article className="w-container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" style={{ paddingTop: 24, fontSize: 14 }} className="w-faint">
        <Link href={page.kind === 'guide' ? '/web/guides' : '/web/best'} className="w-muted">
          {page.kind === 'guide' ? t(lang, 'nav.guides') : t(lang, 'footer.bestOf')}
        </Link>{' / '}<span>{page.title}</span>
      </nav>

      <header className="w-editorial-hero">
        {hero ? <img src={hero} alt="" /> : null}
        <div className="w-editorial-hero-body">
          <p className="w-eyebrow">{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p>{page.dek}</p>
        </div>
      </header>

      {resolved.map((r, i) => {
        const s = r.section
        if (s.type === 'copy') {
          return (
            <section key={i} className="w-editorial-copy">
              {s.heading ? <h2>{s.heading}</h2> : null}
              {s.body.map((p, j) => <p key={j}>{p}</p>)}
            </section>
          )
        }
        if (s.type === 'vendors' && 'vendors' in r && r.vendors && r.vendors.length > 0) {
          const moreHref = `/web/explore?${filterToSearch({ categories: s.filter.categories, areas: s.filter.areas, priceTiers: s.filter.priceTiers, city: s.filter.city }, s.sort ?? 'recommended')}`
          return (
            <section key={i} className="w-section">
              <div className="w-section-head">
                <div>
                  <h2 className="w-section-title">{s.heading}</h2>
                  {s.intro ? <p className="w-section-sub">{s.intro}</p> : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span className="w-live-note"><span className="w-dot w-dot-live" /> Live from ETA</span>
                  {r.total > r.vendors.length && !s.filter.keywords?.length ? (
                    <Link href={moreHref} className="w-link-arrow">{t(lang, 'common.seeAll')} {r.total} →</Link>
                  ) : null}
                </div>
              </div>
              <div className="w-grid-3">{r.vendors.map(v => <VendorCard key={v.id} vendor={v} lang={lang} />)}</div>
            </section>
          )
        }
        if (s.type === 'photospots' && 'spots' in r && r.spots && r.spots.length > 0) {
          return (
            <section key={i} className="w-section">
              <div className="w-section-head"><div><h2 className="w-section-title">{s.heading}</h2>{s.intro ? <p className="w-section-sub">{s.intro}</p> : null}</div></div>
              <div className="w-grid-4">{r.spots.map(sp => <PhotoSpotTile key={sp.id} spot={sp} lang={lang} fixedHeight={300} />)}</div>
            </section>
          )
        }
        if (s.type === 'experiences' && 'experiences' in r && r.experiences && r.experiences.length > 0) {
          return (
            <section key={i} className="w-section">
              <div className="w-section-head"><div><h2 className="w-section-title">{s.heading}</h2>{s.intro ? <p className="w-section-sub">{s.intro}</p> : null}</div></div>
              <div className="w-grid-3">{r.experiences.map(e => <ExperienceCard key={e.id} experience={e} lang={lang} />)}</div>
            </section>
          )
        }
        return null
      })}

      {related && related.length > 0 ? (
        <section className="w-section">
          <h2 className="w-section-title" style={{ marginBottom: 16 }}>{page.kind === 'guide' ? t(lang, 'nav.guides') : t(lang, 'footer.bestOf')}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {related.map(p => (
              <Link key={p.slug} href={`/web/${p.kind === 'guide' ? 'guides' : 'best'}/${p.slug}`} className="w-btn w-btn-ghost w-btn-sm">{p.title}</Link>
            ))}
          </div>
        </section>
      ) : null}

      {lang === 'es' ? (
        <p className="w-note" style={{ marginTop: 32 }}>Esta guía todavía está disponible solo en inglés.</p>
      ) : null}
    </article>
  )
}
