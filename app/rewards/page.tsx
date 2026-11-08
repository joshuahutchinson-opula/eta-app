// app/rewards/page.tsx — the Rewards hub (Profile → Rewards, or the points
// pill on Home), after docs/mockups/RewardsHub.dc.html. Top to bottom:
//   top bar         back, "Rewards", and "?" (Tiers & Earning)
//   status card     tier chip, member since, points to spend, progress to
//                   the next tier, lifetime points, "Your status never drops"
//   quick buttons   Scan To Earn (Scan & Pay), My Rewards, History
//   Boosts          today in the town: quiet hours (live bar + countdown),
//                   rainy-day bonus, crew bonus
//   Rewards         filter pills: All, Vendor Perks, Insider Only, Events, ETA Perks
//   Give Back       the town's cause, community progress, give right there
//   Badges          collected n of N, medals and rings, "one more to unlock"
//   Leaderboard     this month in the town, your row, opt-in switch
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
import { useLabels } from '@/lib/labels'
import { triggerHaptic } from '@/lib/haptics'
import { REWARD_TIERS } from '@/lib/rewardTiers'
import type { RewardItem } from '@/lib/rewards'

interface Hub {
  city: string
  status: (HubStatus & { leaderboardOptIn: boolean; birthday: string | null; local: boolean }) | null
  boosts: BoostView[]
  cause: CauseView | null
  badges: BadgeView[]
  leaderboard: Board
  activeVouchers: number
  indoorSpots?: number
}

export default function RewardsHub() {
  const { t, lang } = useLang()
  const labels = useLabels()
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
        <RewardsTop title={t('m.rw.title')} fallback="/profile" />
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
  const month = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : lang, { month: 'long', timeZone: 'America/Jamaica' })
  const help = (
    <Link href="/rewards/tiers" className="rh-round press" aria-label={t('m.rw.howItWorks')} onClick={() => triggerHaptic('light')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14" /><circle cx="12" cy="17.2" r="0.6" fill="currentColor" /></svg>
    </Link>
  )

  return (
    <main className="rw">
      <RewardsTop title={t('m.rw.title')} fallback="/profile" right={help} />
      {failed && !hub ? <div className="rh-pad"><ErrorState onRetry={load} /></div> : !hub || !status ? (
        <div className="rh-pad" aria-hidden>
          <div className="skeleton-card" style={{ height: '210px', borderRadius: '22px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
          <div className="skeleton-card" style={{ height: '64px', marginTop: '12px', borderRadius: '14px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
        </div>
      ) : (
        <div className="rh-pad content-fade-in">
          <StatusCard status={status} activeVouchers={hub.activeVouchers} memberSince={user.createdAt ?? null} />

          <section className="rh-sec" aria-label={t('m.rw.boostsTitle')}>
            <p className="rh-eb">{t('m.rw.todayIn', { town: town.name })}</p>
            <h2 className="rh-st" style={{ marginBottom: '12px' }}>{t('m.rw.boostsTitle')}</h2>
            <Boosts boosts={hub.boosts} indoorSpots={hub.indoorSpots ?? 0} />
          </section>

          <section className="rh-sec" aria-label={t('m.rw.rewards')}>
            <p className="rh-eb">{t('m.rw.spendEyebrow')}</p>
            <h2 className="rh-st" style={{ marginBottom: '12px' }}>{t('m.rw.rewards')}</h2>
            <RewardsCatalog rewards={catalog} points={user.points} lifetimePoints={status.lifetimePoints} signedIn onRedeemed={load} />
          </section>

          {hub.cause && (
            <GiveBack cause={hub.cause} townName={town.name} points={user.points} signedIn onDonated={cause => { setHub(h => h ? { ...h, cause } : h); load() }} />
          )}

          <section className="rh-sec" aria-label={t('m.rw.badges')}>
            <Badges badges={hub.badges} />
          </section>

          <section className="rh-sec" aria-label={t('m.rw.board')}>
            <p className="rh-eb">{town.name} · {month}</p>
            <h2 className="rh-st" style={{ marginBottom: '12px' }}>{t('m.rw.board')}</h2>
            <Leaderboard board={hub.leaderboard} optedIn={hub.status?.leaderboardOptIn ?? false} townName={town.name} signedIn onChange={load} />
          </section>

          <Link href="/rewards/tiers" className="rh-card rh-link press" style={{ marginTop: '24px' }} onClick={() => triggerHaptic('light')}>
            <span className="rh-ic" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4V10H4zM10 20h4V4h-4zM16 20h4v-7h-4z" /></svg>
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '15px', fontWeight: 700 }}>{t('m.rw.tiersLink')}</span>
              <span className="rh-sub" style={{ display: 'block', fontSize: '13px' }}>{REWARD_TIERS.map(x => labels.tier(x.key)).join(' → ')}</span>
            </span>
            <Icon name="chevronRight" size={14} style={{ color: 'var(--rum-text)' }} />
          </Link>
          <p className="rh-sub" style={{ margin: '12px 4px 0', fontSize: '12px', textAlign: 'center' }}>{t('m.rw.footer')}</p>
        </div>
      )}
      <Dock />
    </main>
  )
}
