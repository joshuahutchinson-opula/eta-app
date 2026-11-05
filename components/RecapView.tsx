// components/RecapView.tsx — a trip recap: the map of everywhere they went,
// the numbers, and the places and bookings in order. Used by /recap (yours,
// with Share) and /recap/<token> (the shared, read-only link).
'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { cityName, townFor } from '@/lib/regions'
import type { TripRecapData } from '@/lib/trip-recap'

const PassportMap = dynamic(() => import('@/components/PassportMap'), { ssr: false })

export default function RecapView({ recap, linkPlaces = true }: { recap: TripRecapData; linkPlaces?: boolean }) {
  const { t, lang } = useLang()
  const labels = useLabels()
  const locale = lang === 'en' ? 'en-US' : lang
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'America/Jamaica' })
  const center = townFor(recap.places[0]?.city ?? 'NEGRIL')
  const stat = (value: number, label: string) => (
    <div className="card" style={{ padding: '14px 8px', textAlign: 'center', cursor: 'default' }}>
      <p className="num-font" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)' }}>{value}</p>
      <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>{label}</p>
    </div>
  )

  return (
    <>
      <p className="section-eyebrow">{day(recap.start)} – {day(recap.end)}</p>
      <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginBottom: '4px' }}>{t('m.recap.headline', { name: recap.name })}</h1>
      <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '16px' }}>
        {t('m.recap.sub', { days: recap.days, towns: recap.towns.map(cityName).join(', ') || '—' })}
      </p>

      <div className="card" style={{ position: 'relative', height: '260px', overflow: 'hidden', marginBottom: '12px', cursor: 'default' }}>
        {recap.places.length ? <PassportMap places={recap.places} center={[center.lat, center.lng]} /> : (
          <div className="empty-state" style={{ height: '100%', justifyContent: 'center' }}><Icon name="compass" size={28} style={{ color: 'var(--label-tertiary)' }} /><p>{t('m.recap.empty')}</p></div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginBottom: '24px' }}>
        {stat(recap.counts.places, t('m.passport.places'))}
        {stat(recap.counts.booked, t('m.recap.booked'))}
        {stat(recap.pointsEarned, t('m.rewards.points'))}
      </div>

      {recap.places.length > 0 && (
        <>
          <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.recap.wentTo')}</span></div></div>
          <div className="card" style={{ padding: '4px 16px', marginBottom: '24px', cursor: 'default' }}>
            {recap.places.map((p, i) => {
              const row = (
                <>
                  <Icon name={p.kind === 'photospot' ? 'camera' : 'mapPin'} size={16} style={{ color: 'var(--rum-text)', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{p.name}</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--label-secondary)' }}>{p.category ? `${labels.category(p.category)} · ` : ''}{cityName(p.city)}</span>
                  </span>
                  <span className="num-font" style={{ fontSize: '12px', color: 'var(--label-tertiary)' }}>{day(p.at)}</span>
                </>
              )
              const style: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: i < recap.places.length - 1 ? '0.5px solid var(--separator)' : 'none', textDecoration: 'none' }
              return linkPlaces
                ? <Link key={`${p.kind}${p.id}`} href={p.kind === 'vendor' ? `/vendor/${p.id}` : `/photospot/${p.id}`} style={style}>{row}</Link>
                : <div key={`${p.kind}${p.id}`} style={style}>{row}</div>
            })}
          </div>
        </>
      )}

      {recap.booked.length > 0 && (
        <>
          <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.recap.bookedTitle')}</span></div></div>
          <div className="card" style={{ padding: '4px 16px', marginBottom: '24px', cursor: 'default' }}>
            {recap.booked.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: i < recap.booked.length - 1 ? '0.5px solid var(--separator)' : 'none' }}>
                <Icon name="ticket" size={16} style={{ color: 'var(--rum-text)' }} />
                <span style={{ flex: 1, fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{b.name}</span>
                <span className="num-font" style={{ fontSize: '12px', color: 'var(--label-tertiary)' }}>{day(b.date)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
