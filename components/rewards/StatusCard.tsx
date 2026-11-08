// components/rewards/StatusCard.tsx — the top of the Rewards hub
// (docs/mockups/RewardsHub.dc.html): the tier chip and "Member Since",
// points to spend, progress to the next tier, lifetime points and "Your
// status never drops" — the whole card opens Tiers & Earning. Then the
// quick buttons: Scan To Earn, My Rewards (with the count), History.
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

/** A sentence with one number in it, the number set in the mono face. */
export function withNum(text: string, num: string): React.ReactNode {
  const i = text.indexOf(num)
  if (i < 0) return text
  return <>{text.slice(0, i)}<span className="num">{num}</span>{text.slice(i + num.length)}</>
}

export default function StatusCard({ status, activeVouchers, memberSince }: { status: HubStatus; activeVouchers: number; memberSince?: string | null }) {
  const { t, lang } = useLang()
  const labels = useLabels()
  const locale = lang === 'en' ? 'en-US' : lang
  const tier = REWARD_TIERS[tierIndex(status.tier)]
  const n = (x: number) => x.toLocaleString(locale)
  const since = memberSince ? new Date(memberSince).toLocaleDateString(locale, { month: 'short', year: 'numeric' }) : null
  return (
    <>
      <Link href="/rewards/tiers" className="rh-status press" aria-label={t('m.rw.status')} onClick={() => triggerHaptic('light')}>
        <span className="rh-shine" aria-hidden />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span className="rh-tier">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#FFD54A" aria-hidden><path d="M12 2l2.9 6.3L22 9.2l-5.2 4.7 1.5 7.1L12 17.3 5.7 21l1.5-7.1L2 9.2l7.1-.9z" /></svg>
              {labels.tier(tier.key)}
            </span>
            {since && <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>{t('m.rw.memberSince', { date: since })}</span>}
          </div>

          <p style={{ margin: '18px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>{t('m.rw.pointsToSpend')}</p>
          <p style={{ margin: '2px 0 0', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="num" style={{ fontSize: '40px', lineHeight: 1 }}>{n(status.points)}</span>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{t('m.rw.pts')}</span>
          </p>

          <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '13px' }}>
            <span style={{ fontWeight: 600 }}>{labels.tier(tier.key)}</span>
            <span style={{ color: 'rgba(255,255,255,0.85)' }}>{status.next ? withNum(t('m.rw.toTier', { n: n(status.pointsToNext), tier: labels.tier(status.next) }), n(status.pointsToNext)) : t('m.rw.topTier')}</span>
          </div>
          <div className="rh-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={status.percent}>
            <i style={{ width: `${status.percent}%` }} />
          </div>
          <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.75)' }}>{withNum(t('m.rw.lifetimeLine', { n: n(status.lifetimePoints) }), n(status.lifetimePoints))}</p>
        </div>
      </Link>

      <nav className="rh-quick" aria-label={t('m.rw.title')}>
        <Link href="/pay" className="press" onClick={() => triggerHaptic('light')}><Icon name="qr" size={20} />{t('m.rw.scan')}</Link>
        <Link href="/rewards/mine" className="press" onClick={() => triggerHaptic('light')}>
          <Icon name="gift" size={20} />
          <span>{t('m.rw.mine')}{activeVouchers > 0 && <> <span className="num" style={{ fontSize: '11px', color: 'var(--rum-text)' }}>{activeVouchers}</span></>}</span>
        </Link>
        <Link href="/rewards/history" className="press" onClick={() => triggerHaptic('light')}><Icon name="clock" size={20} />{t('m.rw.history')}</Link>
      </nav>
    </>
  )
}
