// components/VendorCard.tsx — the mobile vendor card (Home, Market, Vendors grid).
// Leads with what helps someone pick: rating + reviews, price tier, neighborhood,
// a one-line pitch and live crowd, color-coded by category.
'use client'

import Link from 'next/link'
import Icon from '@/lib/icons'
import { categoryStyle, priceTier, vendorPitch } from '@/lib/vendor-style'
import { ACCESSIBILITY_OPTIONS } from '@/lib/accessibility'

export interface VendorCardVendor {
  id: string
  name: string
  category: string
  neighborhood: string
  priceRange: string
  description: string
  images: string[]
  open: boolean
  live: boolean
  isPremium: boolean
  whoThere: number
  rating?: number | null
  reviewCount?: number | null
  accessibility?: string[]
}

interface Props {
  vendor: VendorCardVendor
  /** 'row' = image left, for vertical lists; 'tile' = image on top, for the 2-column grid. */
  variant?: 'row' | 'tile'
  saved?: boolean
  onToggleSave?: () => void
  /** Only passed where adding to a trip makes sense (the Experiences flow). */
  onAddToTrip?: () => void
  href?: string
}

function PriceTier({ priceRange, color }: { priceRange: string; color: string }) {
  const tier = priceTier(priceRange)
  return (
    <span className="num-font" aria-label={`Price ${tier} of 4`} style={{ fontWeight: 700, letterSpacing: '0.5px' }}>
      <span style={{ color }}>{'$'.repeat(tier)}</span>
      <span style={{ color: 'var(--label-tertiary)', opacity: 0.6 }}>{'$'.repeat(4 - tier)}</span>
    </span>
  )
}

function Rating({ rating, reviewCount, compact }: { rating?: number | null; reviewCount?: number | null; compact?: boolean }) {
  if (!rating) {
    return <span style={{ color: 'var(--label-tertiary)', fontWeight: 600 }}>New on ETA</span>
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--label-primary)', fontWeight: 700 }}>
      <span style={{ color: 'var(--gold)' }} aria-hidden>★</span>
      <span className="num-font">{rating.toFixed(1)}</span>
      <span className="num-font" style={{ color: 'var(--label-secondary)', fontWeight: 500 }}>
        ({reviewCount ?? 0}{compact ? '' : reviewCount === 1 ? ' review' : ' reviews'})
      </span>
    </span>
  )
}

export default function VendorCard({ vendor: v, variant = 'row', saved, onToggleSave, onAddToTrip, href }: Props) {
  const style = categoryStyle(v.category)
  const pitch = vendorPitch(v.description)
  const access = (v.accessibility ?? []).map(k => ACCESSIBILITY_OPTIONS.find(o => o.key === k)?.short).filter(Boolean)
  const link = href ?? `/vendor/${v.id}`

  const chip = (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px',
      background: `${style.color}1F`, color: style.color, fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap'
    }}>
      <Icon name={style.icon} size={11} />
      {style.label}
    </span>
  )

  const btnSize = variant === 'tile' ? { width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' } : {}

  const actions = (onToggleSave || onAddToTrip) ? (
    <div style={{ display: 'flex', flexDirection: variant === 'tile' ? 'column' : 'row', gap: variant === 'tile' ? '6px' : '2px', flexShrink: 0 }}>
      {onAddToTrip && (
        <button className="heart-btn" aria-label={`Add ${v.name} to a trip`} onClick={e => { e.preventDefault(); onAddToTrip() }} style={{ color: 'var(--label-secondary)', ...btnSize }}>
          <Icon name="plus" size={variant === 'tile' ? 15 : 18} />
        </button>
      )}
      {onToggleSave && (
        <button
          className="heart-btn"
          aria-label={saved ? `Unsave ${v.name}` : `Save ${v.name}`}
          onClick={e => { e.preventDefault(); onToggleSave() }}
          style={{ color: saved ? 'var(--rum)' : 'var(--label-secondary)', ...btnSize }}
        >
          <Icon name="heart" size={variant === 'tile' ? 15 : 18} className={saved ? 'filled' : ''} />
        </button>
      )}
    </div>
  ) : null

  const liveLine = v.live ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--live)', fontWeight: 600 }}>
      <span className="live-dot" />
      <span className="num-font">{v.whoThere}</span> here now
    </span>
  ) : null

  if (variant === 'tile') {
    return (
      <Link href={link} style={{ textDecoration: 'none' }}>
        <div className="card" style={{ height: '100%' }}>
          <div className="card-image" style={{ height: '120px', borderBottom: `3px solid ${style.color}` }}>
            <img src={v.images[0]} alt={v.name} />
            {v.isPremium && (
              <div className="card-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="crown" size={11} /> Premium
              </div>
            )}
            {actions && <div style={{ position: 'absolute', top: '6px', right: '6px' }}>{actions}</div>}
            {v.live && (
              <div style={{ position: 'absolute', bottom: '6px', left: '6px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px' }}>
                <span className="live-dot" /><span className="num-font">{v.whoThere}</span> here
              </div>
            )}
          </div>
          <div className="card-content" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--label-primary)', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className={v.open ? 'open-dot' : 'closed-dot'} aria-label={v.open ? 'Open now' : 'Closed'} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              {chip}
              <PriceTier priceRange={v.priceRange} color={style.color} />
            </div>
            <p style={{ fontSize: '11px', color: 'var(--label-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <Icon name="mapPin" size={10} /> {v.neighborhood}
            </p>
            <div style={{ fontSize: '12px' }}><Rating rating={v.rating} reviewCount={v.reviewCount} compact /></div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={link} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ display: 'flex', gap: '12px', padding: '12px', borderLeft: `3px solid ${style.color}` }}>
        <div style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
          <img src={v.images[0]} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {v.isPremium && (
            <span style={{ position: 'absolute', top: '6px', left: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: 'var(--gold)' }} aria-label="Premium">
              <Icon name="crown" size={12} />
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <span className={v.open ? 'open-dot' : 'closed-dot'} aria-label={v.open ? 'Open now' : 'Closed'} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
            </p>
            {actions}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', flexWrap: 'wrap' }}>
            {chip}
            <PriceTier priceRange={v.priceRange} color={style.color} />
            <span style={{ color: 'var(--label-secondary)', display: 'inline-flex', alignItems: 'center', gap: '3px', minWidth: 0 }}>
              <Icon name="mapPin" size={11} /> {v.neighborhood}
            </span>
          </div>
          {pitch && (
            <p style={{ fontSize: '13px', color: 'var(--label-secondary)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {pitch}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', flexWrap: 'wrap' }}>
            <Rating rating={v.rating} reviewCount={v.reviewCount} />
            {liveLine}
            {access.length > 0 && <span style={{ color: 'var(--label-secondary)' }}>♿ {access[0]}</span>}
          </div>
        </div>
      </div>
    </Link>
  )
}
