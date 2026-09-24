// components/web/FilterSidebar.tsx
'use client'

import { ACCESSIBILITY_OPTIONS } from '@/lib/accessibility'
import type { VendorFacets, VendorFilter } from '@/lib/vendor-types'
import type { DictKey } from '@/lib/i18n'
import { activeFilterCount } from '@/lib/vendor-filter-params'

interface Props {
  filter: VendorFilter
  facets: VendorFacets
  onChange: (next: VendorFilter) => void
  t: (key: DictKey) => string
}

function toggle(list: string[] | undefined, value: string): string[] {
  const cur = list ?? []
  return cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value]
}

export default function FilterSidebar({ filter, facets, onChange, t }: Props) {
  const hasFilters = activeFilterCount(filter) > 0
  return (
    <aside className="w-sidebar" aria-label="Filters">
      {hasFilters ? (
        <button type="button" className="w-clear" onClick={() => onChange({ city: filter.city })}>
          {t('explore.clearAll')}
        </button>
      ) : null}

      <fieldset className="w-filter-group" style={{ border: 'none' }}>
        <legend><h3>{t('explore.category')}</h3></legend>
        {facets.categories.map(c => {
          const checked = filter.categories?.includes(c.value) ?? false
          const disabled = c.count === 0 && !checked
          return (
            <label key={c.value} className={`w-check ${disabled ? 'disabled' : ''}`}>
              <input type="checkbox" checked={checked} disabled={disabled} onChange={() => onChange({ ...filter, categories: toggle(filter.categories, c.value) })} />
              {c.label}
              <span className="count">{c.count}</span>
            </label>
          )
        })}
      </fieldset>

      <fieldset className="w-filter-group" style={{ border: 'none' }}>
        <legend><h3>{t('explore.neighborhood')}</h3></legend>
        {facets.areas.map(a => {
          const checked = filter.areas?.includes(a.value) ?? false
          const disabled = a.count === 0 && !checked
          return (
            <label key={a.value} className={`w-check ${disabled ? 'disabled' : ''}`}>
              <input type="checkbox" checked={checked} disabled={disabled} onChange={() => onChange({ ...filter, areas: toggle(filter.areas, a.value) })} />
              {a.label}
              <span className="count">{a.count}</span>
            </label>
          )
        })}
      </fieldset>

      <div className="w-filter-group">
        <h3 id="price-label">{t('explore.price')}</h3>
        <div className="w-tier-row" role="group" aria-labelledby="price-label">
          {facets.priceTiers.map(p => (
            <button
              key={p.value}
              type="button"
              className="w-tier"
              aria-pressed={filter.priceTiers?.includes(p.value) ?? false}
              title={`${p.count} vendors`}
              onClick={() => onChange({ ...filter, priceTiers: toggle(filter.priceTiers, p.value) })}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <fieldset className="w-filter-group" style={{ border: 'none' }}>
        <legend><h3>{t('explore.accessibility')}</h3></legend>
        {ACCESSIBILITY_OPTIONS.map(o => {
          const checked = filter.accessibility?.includes(o.key) ?? false
          const count = facets.accessibility[o.key] ?? 0
          return (
            <label key={o.key} className="w-check">
              <input type="checkbox" checked={checked} onChange={() => onChange({ ...filter, accessibility: toggle(filter.accessibility, o.key) })} />
              {o.label}
              <span className="count">{count}</span>
            </label>
          )
        })}
        <p className="w-note">{t('explore.accessibilityNote')}</p>
      </fieldset>
    </aside>
  )
}
