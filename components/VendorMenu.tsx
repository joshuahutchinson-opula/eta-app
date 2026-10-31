// components/VendorMenu.tsx — a vendor's menu: sections of dishes with
// photos, prices and dietary tags, and filter chips (vegetarian, vegan,
// seafood, halal, gluten-free) that only appear for tags the menu uses.
'use client'

import { useState } from 'react'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import Price from '@/components/Price'
import { useLang } from '@/lib/i18n-client'
import { DIETARY_ICON, DIETARY_TAGS, matchesDiet, type DietaryTag } from '@/lib/dietary'
import { triggerHaptic } from '@/lib/haptics'

export interface MenuItemView {
  id: string
  name: string
  description: string | null
  price: number | null
  imageUrl: string | null
  dietaryTags: string[]
  section: string | null
}

export default function VendorMenu({ items }: { items: MenuItemView[] }) {
  const { t } = useLang()
  const [diet, setDiet] = useState<DietaryTag[]>([])
  if (!items.length) return null

  const used = DIETARY_TAGS.filter(tag => items.some(i => i.dietaryTags.includes(tag)))
  const shown = items.filter(i => matchesDiet(i.dietaryTags, diet))
  const sections = Array.from(new Set(shown.map(i => i.section ?? '')))
  const label = (tag: string) => t(`m.diet.${tag}` as 'm.diet.VEGAN')

  return (
    <section style={{ marginBottom: '32px' }} aria-label={t('m.vendor.menu')}>
      <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.vendor.menu')}</span></div></div>
      {used.length > 0 && (
        <div className="horizontal-scroll" style={{ padding: '0 0 10px', gap: '6px' }}>
          {used.map(tag => {
            const on = diet.includes(tag)
            return (
              <button key={tag} className={`chip ${on ? 'active' : ''}`} aria-pressed={on} onClick={() => { triggerHaptic('selection'); setDiet(d => (on ? d.filter(x => x !== tag) : [...d, tag])) }} style={{ flexShrink: 0, minHeight: '36px' }}>
                <Icon name={DIETARY_ICON[tag]} size={12} /> {label(tag)}
              </button>
            )
          })}
        </div>
      )}
      {shown.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--label-secondary)' }}>{t('m.vendor.menuEmptyFilter')}</p>
      ) : sections.map(section => (
        <div key={section} style={{ marginBottom: '12px' }}>
          {section && <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--label-secondary)', margin: '4px 0 6px' }}>{section}</p>}
          <div className="card" style={{ padding: '0 14px', cursor: 'default' }}>
            {shown.filter(i => (i.section ?? '') === section).map((item, idx, list) => (
              <div key={item.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 0', borderBottom: idx < list.length - 1 ? '0.5px solid var(--separator)' : 'none' }}>
                {item.imageUrl && <span style={{ width: '56px', height: '56px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}><Img src={item.imageUrl} alt="" width={112} height={112} sizes="56px" /></span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{item.name}</p>
                  {item.description && <p style={{ fontSize: '13px', color: 'var(--label-secondary)', lineHeight: 1.35 }}>{item.description}</p>}
                  {item.dietaryTags.length > 0 && (
                    <p style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                      {item.dietaryTags.map(tag => <span key={tag} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)', background: 'var(--system-bg-secondary)', borderRadius: '999px', padding: '2px 8px' }}>{label(tag)}</span>)}
                    </p>
                  )}
                </div>
                {item.price !== null ? <Price usd={item.price} compact style={{ fontSize: '15px', fontWeight: 700, color: 'var(--rum-text)', flexShrink: 0 }} /> : <span style={{ fontSize: '13px', color: 'var(--label-tertiary)', flexShrink: 0 }}>{t('m.vendor.priceAsk')}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
