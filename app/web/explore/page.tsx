// app/web/explore/page.tsx — A3 Explore / vendor directory
import type { Metadata } from 'next'
import ExploreClient from '@/components/web/ExploreClient'
import { filterFromParams, queryVendors, vendorFacets } from '@/lib/vendor-query'
import { getServerLang } from '@/lib/i18n-server'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Explore vendors in Negril & Montego Bay',
  description: 'Browse every vetted local vendor on ETA — food, cliff bars, beach bars, watersports and more — filtered by area, price and accessibility.'
}

export default async function ExplorePage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const lang = getServerLang()
  const { filter, sort } = filterFromParams(searchParams)
  const [result, facets] = await Promise.all([
    queryVendors(filter, { sort, take: 12 }),
    vendorFacets(filter)
  ])

  return (
    <div className="w-container">
      <header className="w-page-head">
        <p className="w-eyebrow">Negril · Montego Bay</p>
        <h1 className="w-page-title">{t(lang, 'explore.title')}</h1>
      </header>
      <ExploreClient
        initialFilter={filter}
        initialSort={sort}
        initialItems={result.items}
        initialTotal={result.total}
        initialFacets={facets}
      />
    </div>
  )
}
