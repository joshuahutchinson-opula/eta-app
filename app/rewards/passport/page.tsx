// app/rewards/passport/page.tsx — Your passport (from Rewards → Badges): the
// map of everywhere you've checked in, counts, streaks and places by
// category. Computed from real CheckIn and Discovery rows (lib/passport.ts).
'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import ErrorState from '@/components/ErrorState'
import RewardsTop from '@/components/rewards/RewardsTop'
import { apiJson } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { useLang } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { useRegion } from '@/components/RegionProvider'
import type { PassportPlace } from '@/lib/passport'

const PassportMap = dynamic(() => import('@/components/PassportMap'), { ssr: false })

interface Passport {
  places: PassportPlace[]
  counts: { places: number; checkIns: number; photoSpots: number; gems: number; towns: number; byCategory: Record<string, number> }
  streak: number
  bestStreak: number
}

export default function PassportPage() {
  const { t } = useLang()
  const labels = useLabels()
  const { town } = useRegion()
  const [passport, setPassport] = useState<Passport | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    try { setPassport(await apiJson<Passport>('/api/passport')) } catch { setFailed(true) }
  }, [])
  useEffect(() => { if (getCurrentUser()) load(); else setFailed(true) }, [load])

  const stat = (value: number, label: string) => (
    <div className="card" style={{ padding: '14px 8px', textAlign: 'center', cursor: 'default' }}>
      <p className="num-font" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)' }}>{value}</p>
      <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>{label}</p>
    </div>
  )

  return (
    <main className="rw">
      <RewardsTop title={t('m.rw.passport')} />
      <div className="rw-pad content-fade-in">
        {failed ? <ErrorState onRetry={load} /> : !passport ? (
          <div className="skeleton-card" style={{ height: '240px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
        ) : (
          <>
            <div className="card" style={{ position: 'relative', height: '240px', overflow: 'hidden', marginBottom: '16px', cursor: 'default' }}>
              {passport.places.length ? <PassportMap places={passport.places} center={[town.lat, town.lng]} /> : (
                <div className="empty-state" style={{ height: '100%', justifyContent: 'center' }}>
                  <Icon name="qr" size={28} style={{ color: 'var(--label-tertiary)' }} />
                  <p>{t('m.passport.emptyQr')}</p>
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginBottom: '8px' }}>
              {stat(passport.counts.places, t('m.passport.places'))}
              {stat(passport.counts.checkIns, t('m.passport.checkins'))}
              {stat(passport.streak, t('m.passport.streak'))}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '20px', textAlign: 'right' }}>{t('m.passport.best', { n: passport.bestStreak })}</p>
            <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.passport.byCategory')}</span></div></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
              {Object.entries(passport.counts.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, n]) => (
                <span key={cat} className="chip" style={{ cursor: 'default' }}>{labels.category(cat)} <span className="num-font" style={{ fontWeight: 700 }}>{n}</span></span>
              ))}
              {passport.counts.photoSpots > 0 && <span className="chip" style={{ cursor: 'default' }}><Icon name="camera" size={12} /> {t('m.passport.photoSpots')} <span className="num-font" style={{ fontWeight: 700 }}>{passport.counts.photoSpots}</span></span>}
              {passport.counts.gems > 0 && <span className="chip" style={{ cursor: 'default' }}><Icon name="sparkle" size={12} /> {t('m.passport.gems')} <span className="num-font" style={{ fontWeight: 700 }}>{passport.counts.gems}</span></span>}
              {passport.counts.places === 0 && <p style={{ fontSize: '14px', color: 'var(--label-secondary)' }}>{t('m.passport.emptyQr')}</p>}
            </div>
          </>
        )}
      </div>
      <Dock />
    </main>
  )
}
