// app/passport/page.tsx — "My Discoveries": a map of everywhere you've
// checked in or discovered, counts by category, check-in streaks and badges.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import Dock from '@/components/Dock'
import BackButton from '@/components/BackButton'
import ErrorState from '@/components/ErrorState'
import Icon from '@/lib/icons'
import { apiJson } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { useLang } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { useRegion } from '@/components/RegionProvider'
import type { Badge, PassportPlace } from '@/lib/passport'

const PassportMap = dynamic(() => import('@/components/PassportMap'), { ssr: false })

interface Passport {
  places: PassportPlace[]
  counts: { places: number; checkIns: number; photoSpots: number; gems: number; towns: number; byCategory: Record<string, number> }
  streak: number
  bestStreak: number
  badges: Badge[]
}

const BADGE_ICON: Record<string, string> = { firstCheckin: 'check', beaches5: 'wave', food10: 'food', firstGem: 'sparkle', photo5: 'camera', streak7: 'flame', places25: 'mapPin', towns3: 'route' }

export default function PassportPage() {
  const { t } = useLang()
  const labels = useLabels()
  const { town } = useRegion()
  const [data, setData] = useState<Passport | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'login'>('loading')

  const load = useCallback(async () => {
    if (!getCurrentUser()) { setState('login'); return }
    setState('loading')
    try {
      setData(await apiJson<Passport>('/api/passport'))
      setState('ready')
    } catch {
      setState('error')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const stat = (value: number, label: string) => (
    <div className="card" style={{ padding: '14px 8px', textAlign: 'center', cursor: 'default' }}>
      <p className="num-font" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)' }}>{value}</p>
      <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>{label}</p>
    </div>
  )

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <BackButton fallback="/profile" />
        <div className="section-heading">
          <span className="section-eyebrow">{t('m.passport.eyebrow')}</span>
          <h1 className="section-title">{t('m.passport.title')}</h1>
        </div>
      </div>
      <div style={{ padding: '0 16px' }}>
        {state === 'login' ? (
          <div className="empty-state">
            <Icon name="mapPin" size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.passport.login')}</p>
            <Link href="/login?next=/passport" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('m.profile.login')}</Link>
          </div>
        ) : state === 'error' ? <ErrorState onRetry={load} /> : !data ? (
          <div className="skeleton-card" style={{ height: '240px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
        ) : (
          <>
            <div className="card" style={{ position: 'relative', height: '240px', overflow: 'hidden', marginBottom: '16px', cursor: 'default' }}>
              {data.places.length ? <PassportMap places={data.places} center={[town.lat, town.lng]} /> : (
                <div className="empty-state" style={{ height: '100%', justifyContent: 'center' }}>
                  <Icon name="compass" size={28} style={{ color: 'var(--label-tertiary)' }} />
                  <p>{t('m.passport.empty')}</p>
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginBottom: '8px' }}>
              {stat(data.counts.places, t('m.passport.places'))}
              {stat(data.counts.checkIns, t('m.passport.checkins'))}
              {stat(data.streak, t('m.passport.streak'))}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '20px', textAlign: 'right' }}>{t('m.passport.best', { n: data.bestStreak })}</p>

            <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.passport.byCategory')}</span></div></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
              {Object.entries(data.counts.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, n]) => (
                <span key={cat} className="chip" style={{ cursor: 'default' }}>{labels.category(cat)} <span className="num-font" style={{ fontWeight: 700 }}>{n}</span></span>
              ))}
              {data.counts.photoSpots > 0 && <span className="chip" style={{ cursor: 'default' }}><Icon name="camera" size={12} /> {t('m.passport.photoSpots')} <span className="num-font" style={{ fontWeight: 700 }}>{data.counts.photoSpots}</span></span>}
              {data.counts.gems > 0 && <span className="chip" style={{ cursor: 'default' }}><Icon name="sparkle" size={12} /> {t('m.passport.gems')} <span className="num-font" style={{ fontWeight: 700 }}>{data.counts.gems}</span></span>}
              {data.counts.places === 0 && <p style={{ fontSize: '14px', color: 'var(--label-secondary)' }}>{t('m.passport.empty')}</p>}
            </div>

            <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.passport.badges')}</span></div></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
              {data.badges.map(b => (
                <div key={b.key} className="card" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'default', opacity: b.earned ? 1 : 0.55 }}>
                  <span style={{ width: '40px', height: '40px', borderRadius: '50%', background: b.earned ? 'var(--gold)' : 'var(--system-bg-secondary)', color: b.earned ? '#0F0E0C' : 'var(--label-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={b.earned ? BADGE_ICON[b.key] ?? 'star' : 'lock'} size={18} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--label-primary)' }}>{t(`m.badge.${b.key}` as 'm.badge.firstGem')}</span>
                    {!b.earned && <span className="num-font" style={{ display: 'block', fontSize: '12px', color: 'var(--label-secondary)' }}>{t('m.badge.locked', { n: b.target - b.progress })}</span>}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <Dock />
    </main>
  )
}
