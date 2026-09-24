// components/web/EditorialIndex.tsx
// Index grid for /web/guides and /web/best — each tile's cover and count
// come from running that page's first vendor query.
import Link from 'next/link'
import { queryVendors } from '@/lib/vendor-query'
import type { EditorialPage } from '@/lib/editorial'
import { t, type Lang } from '@/lib/i18n'

export default async function EditorialIndex({ pages, lang, eyebrow, title, dek }: { pages: EditorialPage[]; lang: Lang; eyebrow: string; title: string; dek: string }) {
  const covers = await Promise.all(pages.map(async p => {
    const first = p.sections.find(s => s.type === 'vendors')
    if (!first || first.type !== 'vendors') return { image: null, total: 0 }
    const res = await queryVendors(first.filter, { sort: first.sort ?? 'recommended' })
    return { image: res.items.find(v => v.image)?.image ?? null, total: res.total }
  }))

  return (
    <div className="w-container">
      <header className="w-page-head">
        <p className="w-eyebrow">{eyebrow}</p>
        <h1 className="w-page-title">{title}</h1>
        <p className="w-page-dek">{dek}</p>
      </header>
      <div className="w-grid-3">
        {pages.map((p, i) => (
          <Link key={p.slug} href={`/web/${p.kind === 'guide' ? 'guides' : 'best'}/${p.slug}`} className="w-teaser" style={{ height: 380 }}>
            {covers[i].image ? <img src={covers[i].image!} alt="" loading="lazy" /> : null}
            <div className="w-teaser-body">
              <h3 style={{ fontSize: 28 }}>{p.title}</h3>
              <p style={{ fontSize: 14 }}>{p.dek}</p>
              <p style={{ fontSize: 13, marginTop: 10, fontWeight: 700 }}>{covers[i].total} {t(lang, 'explore.results')} · {t(lang, 'guides.read')} →</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
