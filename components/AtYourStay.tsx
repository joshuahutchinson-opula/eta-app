// components/AtYourStay.tsx — "At your stay", first on Home and Experiences
// for guests of a partner property: Host's picks, today's specials and deals
// at the property's own vendors, its events, and those vendors.
'use client'

import Link from 'next/link'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import Price from '@/components/Price'
import VendorCard from '@/components/VendorCard'
import { useLang } from '@/lib/i18n-client'
import { useEventFormat } from '@/lib/events'
import { triggerHaptic } from '@/lib/haptics'
import type { AtStay } from '@/lib/at-stay'

export default function AtYourStay({ stay }: { stay: AtStay | null }) {
  const { t } = useLang()
  const { when } = useEventFormat()
  if (!stay) return null
  const { property, picks, specials, events, vendors } = stay
  if (!picks.length && !specials.length && !events.length && !vendors.length) return null

  const tile = (key: string, href: string, image: string | null, title: string, sub: string | null, badge?: React.ReactNode) => (
    <Link key={key} href={href} onClick={() => triggerHaptic('light')} style={{ flexShrink: 0, width: '170px', textDecoration: 'none' }}>
      <div className="card" style={{ height: '100%' }}>
        <div className="card-image" style={{ height: '110px', background: 'var(--system-bg-secondary)' }}>
          {image && <Img src={image} alt="" width={340} height={220} sizes="170px" />}
          {badge && <div className="card-badge">{badge}</div>}
        </div>
        <div className="card-content">
          <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--label-primary)', lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</p>
          {sub && <p style={{ fontSize: '12px', color: 'var(--label-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</p>}
        </div>
      </div>
    </Link>
  )
  const row = (label: string, children: React.ReactNode) => (
    <>
      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label-secondary)', padding: '0 16px', margin: '12px 0 6px' }}>{label}</p>
      <div className="horizontal-scroll" style={{ padding: '0 16px 4px' }}>{children}</div>
    </>
  )

  return (
    <section style={{ marginTop: '16px', marginBottom: '8px' }} aria-label={t('m.stay.atYourStay')}>
      <div className="section-header" style={{ padding: '0 16px' }}>
        <div className="section-heading">
          <span className="section-eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Icon name="star" size={11} /> {property.name}</span>
          <span className="section-title">{t('m.stay.atYourStay')}</span>
        </div>
        {property.accommodationId && <Link href={`/accommodations/${property.accommodationId}`} className="section-link">{t('m.stay.yourStay')}</Link>}
      </div>

      {picks.length > 0 && row(t('m.stay.hostPicks'), picks.map(p => tile(
        p.id,
        p.kind === 'vendor' ? `/vendor/${p.target.id}` : p.kind === 'experience' ? `/experiences/${p.target.id}` : `/events/${p.target.id}`,
        p.target.image,
        p.target.name,
        p.note ?? p.target.sub,
        <><Icon name="heart" size={10} /> {t('m.stay.hostPick')}</>
      )))}

      {specials.length > 0 && row(t('m.stay.specials'), specials.map((s, i) => tile(
        `${s.vendorId}-${i}`,
        `/vendor/${s.vendorId}`,
        s.image,
        s.title,
        s.vendorName,
        s.kind === 'deal' ? <><Icon name="flame" size={10} /> {t('m.market.flashDeals')}</> : s.price != null ? <Price usd={s.price} style={{ color: 'white' }} /> : null
      )))}

      {events.length > 0 && row(t('m.stay.events'), events.map(e => tile(
        e.id,
        `/events/${e.id}`,
        e.imageUrl,
        e.title,
        e.venueName,
        <><Icon name="clock" size={10} /> {when(e.startAt)}</>
      )))}

      {vendors.length > 0 && row(t('m.stay.onSite'), vendors.map(v => (
        <div key={v.id} style={{ flexShrink: 0, width: '170px' }}><VendorCard vendor={v} variant="tile" /></div>
      )))}
    </section>
  )
}
