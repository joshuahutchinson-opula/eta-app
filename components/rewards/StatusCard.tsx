// components/rewards/StatusCard.tsx — the top of the Rewards hub: your tier
// (from lifetime points), points to spend, progress to the next tier,
// lifetime points and "Your status never drops"; then the quick buttons
// (Scan To Earn, My Rewards, History).
'use client'

import Link from 'next/link'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { triggerHaptic } from '@/lib/haptics'
import { REWARD_TIERS, tierIndex } from '@/lib/rewardTiers'

export interface HubStatus {
  points: number
  lifetimePoints: number
  tier: string
  percent: number
  pointsToNext: number
  next: string | null
}

export default function StatusCard({ status, activeVouchers }: { status: HubStatus; activeVouchers: number }) {
  const { t, lang } = useLang()
  const labels = useLabels()
  const locale = lang === 'en' ? 'en-US' : lang
  const tier = REWARD_TIERS[tierIndex(status.tier)]
  const n = (x: number) => x.toLocaleString(locale)
  return (
    <>
      <section className="rw-status" aria-label={t('m.rw.status')}>
        <span className={`rw-status-tier ${tier.key === 'YAADIE' ? 'yaadie' : ''}`}>
          <span className="ic" aria-hidden><Icon name={tier.icon} size={15} /></span>
          {labels.tier(tier.key)}
        </span>
        <div className="rw-status-points">
          <b className="num-font">{n(status.points)}</b>
          <span>{t('m.rw.toSpend')}</span>
        </div>
        <div className="rw-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={status.percent} aria-label={status.next ? t('m.rw.toNext', { n: n(status.pointsToNext), tier: labels.tier(status.next) }) : t('m.rw.topTier')}>
          <i style={{ width: `${status.percent}%` }} />
        </div>
        <div className="rw-status-row num-font">
          <span>{status.next ? t('m.rw.toNext', { n: n(status.pointsToNext), tier: labels.tier(status.next) }) : t('m.rw.topTier')}</span>
          <span>{t('m.rw.lifetime', { n: n(status.lifetimePoints) })}</span>
        </div>
        <span className="rw-never"><Icon name="shield" size={14} /> {t('m.rw.neverDrops')}</span>
      </section>

      <nav className="rw-quick" aria-label={t('m.rw.title')}>
        <Link href="/pay" className="press" onClick={() => triggerHaptic('light')}>
          <span className="ic" aria-hidden><Icon name="qr" size={20} /></span>{t('m.rw.scan')}
        </Link>
        <Link href="/rewards/mine" className="press" onClick={() => triggerHaptic('light')}>
          <span className="ic" aria-hidden><Icon name="gift" size={20} /></span>{t('m.rw.mine')}
          {activeVouchers > 0 && <span className="count num-font">{activeVouchers}</span>}
        </Link>
        <Link href="/rewards/history" className="press" onClick={() => triggerHaptic('light')}>
          <span className="ic" aria-hidden><Icon name="receipt" size={20} /></span>{t('m.rw.history')}
        </Link>
      </nav>
    </>
  )
}
