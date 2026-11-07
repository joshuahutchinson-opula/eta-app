// app/rewards/page.tsx — the Rewards hub (Profile → Rewards, or the points
// pill on Home). Top to bottom:
//   status card     tier (from lifetime points), points to spend, progress
//                   to the next tier, lifetime points, "Your status never drops"
//   quick buttons   Scan To Earn (Scan & Pay), My Rewards, History
//   Today's boosts  quiet hours with live countdowns, rainy-day, crew bonus
//   Rewards         filter pills: All, Vendor Perks, Insider Only, Events, ETA Perks
//   Give Back       the town's cause, community progress, donate any amount
//   Badges          progress rings, "one more to unlock", shareable cards
//   Leaderboard     this month in the town, opt-in, your rank
//   Tiers & How To Earn link, and "Points can't be exchanged for cash."
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import ErrorState from '@/components/ErrorState'
import RewardsTop from '@/components/rewards/RewardsTop'
import StatusCard, { type HubStatus } from '@/components/rewards/StatusCard'
import Boosts, { type BoostView } from '@/components/rewards/Boosts'
import RewardsCatalog from '@/components/rewards/RewardsCatalog'
import GiveBack, { type CauseView } from '@/components/rewards/GiveBack'
import Badges, { type BadgeView } from '@/components/rewards/Badges'
import Leaderboard, { type Board } from '@/components/rewards/Leaderboard'
import { apiJson } from '@/lib/api-client'
import { USER_EVENT, getCurrentUser, type CurrentUser } from '@/lib/auth-client'
import { refreshMe } from '@/lib/rewards-client'
import { useLang } from '@/lib/i18n-client'
import { useRegion } from '@/components/RegionProvider'
import type { RewardItem } from '@/lib/rewards'

interface Hub {
  city: string
  status: (HubStatus & { leaderboardOptIn: boolean; birthday: string | null; local: boolean }) | null
  boosts: BoostView[]
  cause: CauseView | null
  badges: BadgeView[]
  leaderboard: Board
  activeVouchers: number
}

export default function RewardsHub() {
  const { t } = useLang()
  const { city, town, ready } = useRegion()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [hub, setHub] = useState<Hub | null>(null)
  const [failed, setFailed] = useState(false)
  const [catalog, setCatalog] = useState<RewardItem[] | null>(null)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const [h, c] = await Promise.all([
        apiJson<Hub>(`/api/rewards/hub?city=${city}`),
        apiJson<RewardItem[]>(`/api/rewards?city=${city}`).catch(() => [] as RewardItem[])
      ])
      setHub(h)
      setCatalog(Array.isArray(c) ? c : [])
    } catch {
      setFailed(true)
    }
  }, [city])

  useEffect(() => {
    setUser(getCurrentUser())
    setMounted(true)
    refreshMe().then(u => { if (u) setUser(u) })
    const read = () => setUser(getCurrentUser())
    window.addEventListener(USER_EVENT, read)
    return () => window.removeEventListener(USER_EVENT, read)
  }, [])

  useEffect(() => {
    if (!ready || !mounted) return
    setCatalog(null)
    load()
  }, [ready, mounted, load])

  if (!mounted) return <main className="rw"><Dock /></main>

  if (!user) {
    return (
      <main className="rw">
        <RewardsTop title={t('m.rw.title')} back={false} />
        <div className="empty-state" style={{ minHeight: '60vh' }}>
          <Icon name="gift" size={32} style={{ color: 'var(--label-tertiary)' }} />
          <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.rewards.loginTitle')}</p>
          <p style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>{t('m.rewards.loginBody')}</p>
          <Link href="/login?next=/rewards" className="btn btn-primary" style={{ marginTop: '8px', textDecoration: 'none' }}>{t('m.profile.login')}</Link>
        </div>
        <Dock />
      </main>
    )
  }

  // Live balances from the cached user (they move as you redeem or donate); the rest from the hub.
  const status: HubStatus | null = hub?.status ? { ...hub.status, points: user.points, lifetimePoints: user.lifetimePoints ?? hub.status.lifetimePoints } : null
  const heading = (eyebrow: string, title: string, link?: React.ReactNode) => (
    <div className="section-header"><div className="section-heading"><span className="section-eyebrow">{eyebrow}</span><span className="section-title">{title}</span></div>{link}</div>
  )

  return (
    <main className="rw">
      <RewardsTop title={t('m.rw.title')} back={false} />
      {failed && !hub ? <div className="rw-pad"><ErrorState onRetry={load} /></div> : !hub || !status ? (
        <div className="rw-pad">
          <div className="skeleton-card" style={{ height: '220px', borderRadius: '24px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
          <div className="skeleton-card" style={{ height: '86px', marginTop: '14px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
        </div>
      ) : (
        <div className="content-fade-in">
          <StatusCard status={status} activeVouchers={hub.activeVouchers} />

          <section className="rw-section" aria-label={t('m.rw.boosts')}>
            {heading(t('m.rw.boostsEyebrow'), t('m.rw.boosts'))}
            <Boosts boosts={hub.boosts} />
          </section>

          <section className="rw-section" aria-label={t('m.rw.rewards')}>
            {heading(t('m.rw.spendEyebrow'), t('m.rw.rewards'))}
            <RewardsCatalog rewards={catalog} points={user.points} lifetimePoints={status.lifetimePoints} signedIn onRedeemed={load} />
          </section>

          {hub.cause && (
            <section className="rw-section" aria-label={t('m.rw.giveBack')}>
              {heading(t('m.rw.giveBackEyebrow', { town: town.name }), t('m.rw.giveBack'))}
              <GiveBack cause={hub.cause} townName={town.name} points={user.points} signedIn onDonated={cause => { setHub(h => h ? { ...h, cause } : h); load() }} />
            </section>
          )}

          <section className="rw-section" aria-label={t('m.rw.badges')}>
            {heading(t('m.rw.badgesEyebrow'), t('m.rw.badges'), <Link href="/rewards/passport" className="section-link">{t('m.rw.passport')}</Link>)}
            <Badges badges={hub.badges} />
          </section>

          <section className="rw-section" aria-label={t('m.rw.board')}>
            {heading(t('m.rw.boardEyebrow', { town: town.name }), t('m.rw.board'))}
            <Leaderboard board={hub.leaderboard} optedIn={hub.status?.leaderboardOptIn ?? false} townName={town.name} signedIn onChange={load} />
          </section>

          <section className="rw-section">
            <Link href="/rewards/tiers" className="rw-link press">
              <span className="rw-card-ic gold" style={{ marginBottom: 0 }} aria-hidden><Icon name="crown" size={20} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '16px', fontWeight: 800 }}>{t('m.rw.tiersLink')}</span>
                <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)', marginTop: '2px' }}>{t('m.rw.tiersLinkSub')}</span>
              </span>
              <Icon name="chevronRight" size={18} style={{ color: 'var(--label-tertiary)' }} />
            </Link>
          </section>

          <p className="rw-foot">{t('m.rw.footer')}</p>
        </div>
      )}
      <Dock />
    </main>
  )
}
