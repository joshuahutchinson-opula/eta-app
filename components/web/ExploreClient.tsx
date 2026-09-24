// components/web/ExploreClient.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import VendorCard from '@/components/web/VendorCard'
import FilterSidebar from '@/components/web/FilterSidebar'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { filterToSearch } from '@/lib/vendor-filter-params'
import type { VendorCardData, VendorFacets, VendorFilter, VendorSort } from '@/lib/vendor-types'

const PAGE = 12

interface Props {
  initialFilter: VendorFilter
  initialSort: VendorSort
  initialItems: VendorCardData[]
  initialTotal: number
  initialFacets: VendorFacets
}

export default function ExploreClient({ initialFilter, initialSort, initialItems, initialTotal, initialFacets }: Props) {
  const router = useRouter()
  const { lang, t } = useLang()
  const [filter, setFilter] = useState<VendorFilter>(initialFilter)
  const [sort, setSort] = useState<VendorSort>(initialSort)
  const [query, setQuery] = useState(initialFilter.q ?? '')
  const [items, setItems] = useState(initialItems)
  const [total, setTotal] = useState(initialTotal)
  const [facets, setFacets] = useState(initialFacets)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const requestId = useRef(0)
  const firstRender = useRef(true)

  // Refetch page one whenever filters/sort change; the URL mirrors state so
  // results are shareable and survive a reload.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    const id = ++requestId.current
    const search = filterToSearch(filter, sort)
    router.replace(`/web/explore${search ? `?${search}` : ''}`, { scroll: false })
    setLoading(true)
    fetch(`/api/web/vendors?${filterToSearch(filter, sort, { skip: 0, take: PAGE })}`)
      .then(r => r.json())
      .then(data => {
        if (id !== requestId.current || data.error) return
        setItems(data.items)
        setTotal(data.total)
        if (data.facets) setFacets(data.facets)
      })
      .catch(() => {})
      .finally(() => { if (id === requestId.current) setLoading(false) })
  }, [filter, sort, router])

  // Debounce typing into the search box.
  useEffect(() => {
    if ((filter.q ?? '') === query) return
    const timer = setTimeout(() => setFilter(f => ({ ...f, q: query })), 250)
    return () => clearTimeout(timer)
  }, [query, filter.q])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/web/vendors?${filterToSearch(filter, sort, { skip: items.length, take: PAGE, facets: 0 })}`)
      const data = await res.json()
      if (!data.error) {
        setItems(prev => [...prev, ...data.items.filter((v: VendorCardData) => !prev.some(p => p.id === v.id))])
        setTotal(data.total)
      }
    } finally {
      setLoadingMore(false)
    }
  }

  const clearAll = () => { setQuery(''); setFilter({ city: filter.city }) }

  return (
    <>
      <div className="w-explore-bar">
        <label className="w-search">
          <Icon name="search" size={18} style={{ color: 'var(--w-ink-3)' }} />
          <span className="w-sr">{t('explore.search')}</span>
          <input type="search" value={query} placeholder={t('explore.search')} onChange={e => setQuery(e.target.value)} />
        </label>
        <label>
          <span className="w-sr">{t('explore.sort')}</span>
          <select className="w-select" value={sort} onChange={e => setSort(e.target.value as VendorSort)}>
            <option value="recommended">{t('explore.sort.recommended')}</option>
            <option value="rating">{t('explore.sort.rating')}</option>
            <option value="price">{t('explore.sort.price')}</option>
            <option value="price-desc">{t('explore.sort.priceDesc')}</option>
          </select>
        </label>
      </div>

      <div className="w-explore">
        <FilterSidebar filter={filter} facets={facets} onChange={next => { if (next.q === undefined) setQuery(''); setFilter(next) }} t={t} />

        <section aria-live="polite" aria-busy={loading}>
          <div className="w-results-head">
            <span><strong style={{ color: 'var(--w-ink)' }}>{total}</strong> {total === 1 ? t('explore.result') : t('explore.results')}</span>
          </div>
          {items.length === 0 && !loading ? (
            <div className="w-empty">
              <h3>{t('explore.emptyTitle')}</h3>
              <p className="w-muted">{t('explore.emptyBody')}</p>
              <button type="button" className="w-btn w-btn-dark" style={{ marginTop: 8 }} onClick={clearAll}>{t('explore.clearAll')}</button>
            </div>
          ) : (
            <div className={`w-grid-3 ${loading ? 'w-loading' : ''}`}>
              {items.map(v => <VendorCard key={v.id} vendor={v} lang={lang} />)}
            </div>
          )}
          {items.length < total ? (
            <div className="w-load-more">
              <button type="button" className="w-btn w-btn-ghost" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? '…' : `${t('explore.loadMore')} (${total - items.length})`}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </>
  )
}
