// app/rewards/page.tsx — points, tier, this month's challenges, the opt-in
// leaderboard, the rewards available in the selected region (with the
// vendors that honour them) and your vouchers, with expiry countdowns and
// a Used state once a vendor redeems them.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import SuccessAnimation from '@/components/SuccessAnimation'
import QRCode from '@/components/QRCode'
import ErrorState from '@/components/ErrorState'
import Price from '@/components/Price'
import { getCurrentUser, setCurrentUser, type CurrentUser } from '@/lib/auth-client'
import { useErrorText, useLang, usePatois } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { hapticRewardRedeemed, triggerHaptic } from '@/lib/haptics'
import { REWARD_TIERS, getTierForPoints } from '@/lib/rewardTiers'
import type { RewardItem } from '@/lib/rewards'
import { apiJson } from '@/lib/api-client'
import { useRegion } from '@/components/RegionProvider'

interface Redemption {
  id: string
  rewardName: string
  pointCost: number
  code: string
  status: 'ACTIVE' | 'USED' | 'EXPIRED'
  expiresAt: string | null
  usedAt: string | null
  createdAt: string
}

interface Challenge { id: string; title: string; description: string; target: number; bonusPoints: number; progress: number; completed: boolean }
interface BoardRow { rank: number; name: string; points: number; me: boolean }

export default function RewardsPage() {
  const patois = usePatois()
  const { t, lang } = useLang()
  const errorText = useErrorText()
  const labels = useLabels()
  const { city, town, ready } = useRegion()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [catalog, setCatalog] = useState<RewardItem[] | null>(null)
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [board, setBoard] = useState<BoardRow[]>([])
  const [selected, setSelected] = useState<RewardItem | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [voucher, setVoucher] = useState<Redemption | null>(null)
  const [redeeming, setRedeeming] = useState(false)
  const [redeemError, setRedeemError] = useState<string | null>(null)
  const [historyFailed, setHistoryFailed] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const locale = lang === 'en' ? 'en-US' : lang

  const loadRedemptions = useCallback(async () => {
    setHistoryFailed(false)
    try { setRedemptions(await apiJson<Redemption[]>('/api/rewards/redemptions')) } catch { setHistoryFailed(true) }
  }, [])

  const loadBoard = useCallback(() => {
    apiJson<{ rows: BoardRow[] }>('/api/leaderboard').then(d => setBoard(d.rows)).catch(() => {})
  }, [])

  useEffect(() => {
    const current = getCurrentUser()
    setUser(current)
    if (current) {
      apiJson<{ user: CurrentUser }>('/api/users/me').then(d => { if (d.user) { setCurrentUser(d.user); setUser(d.user) } }).catch(() => {})
      loadRedemptions()
      loadBoard()
    }
    setMounted(true)
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [loadRedemptions, loadBoard])

  useEffect(() => {
    if (!ready) return
    setCatalog(null)
    fetch(`/api/rewards?city=${city}`).then(r => (r.ok ? r.json() : [])).then(d => setCatalog(Array.isArray(d) ? d : [])).catch(() => setCatalog([]))
    if (getCurrentUser()) apiJson<{ challenges: Challenge[] }>(`/api/challenges?city=${city}`).then(d => setChallenges(d.challenges)).catch(() => {})
  }, [city, ready])

  const tierIndex = (key: string) => REWARD_TIERS.findIndex(x => x.key === key)
  const meetsTier = (reward: RewardItem) => !reward.minTier || !user || tierIndex(getTierForPoints(user.points).key) >= tierIndex(reward.minTier)

  const confirmRedeem = async () => {
    if (!user || !selected) return
    setRedeeming(true)
    setRedeemError(null)
    try {
      const data = await apiJson<{ redemption: Redemption; points: number }>('/api/rewards/redeem', { method: 'POST', body: { rewardId: selected.id } })
      const updated = { ...user, points: data.points }
      setCurrentUser(updated)
      setUser(updated)
      hapticRewardRedeemed()
      setRedemptions(prev => [data.redemption, ...prev])
      setSelected(null)
      setShowSuccess(true)
      setVoucher(data.redemption)
    } catch (e) {
      setRedeemError(errorText(e))
    } finally {
      setRedeeming(false)
    }
  }

  const toggleBoard = async () => {
    if (!user) return
    try {
      const { user: updated } = await apiJson<{ user: CurrentUser }>('/api/users/me', { method: 'PUT', body: { leaderboardOptIn: !user.leaderboardOptIn } })
      triggerHaptic('selection')
      setCurrentUser(updated)
      setUser(updated)
      loadBoard()
    } catch {}
  }

  // "3 days" / "5 h 20 min" until a voucher expires.
  const expiresIn = (iso: string | null) => {
    if (!iso) return null
    const ms = Date.parse(iso) - now
    if (ms <= 0) return null
    const days = Math.floor(ms / 86400000)
    if (days >= 1) return t('m.rewards.expiresIn', { time: t('m.rewards.expiresDays', { n: days }) })
    const mins = Math.floor(ms / 60000)
    return t('m.rewards.expiresIn', { time: t('m.rewards.expiresHours', { h: Math.floor(mins / 60), m: mins % 60 }) })
  }
  const statusOf = (r: Redemption): Redemption['status'] => (r.status === 'ACTIVE' && r.expiresAt && Date.parse(r.expiresAt) <= now ? 'EXPIRED' : r.status)

  if (!mounted) return <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}><Dock /></main>

  if (!user) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
        <div className="empty-state" style={{ minHeight: '70vh' }}>
          <Icon name="gift" size={32} style={{ color: 'var(--label-tertiary)' }} />
          <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.rewards.loginTitle')}</p>
          <p style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>{t('m.rewards.loginBody')}</p>
          <Link href="/login?next=/rewards" className="btn btn-primary" style={{ marginTop: '8px', textDecoration: 'none' }}>{t('m.profile.login')}</Link>
        </div>
        <Dock />
      </main>
    )
  }

  const currentTier = getTierForPoints(user.points)

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <SuccessAnimation show={showSuccess} onComplete={() => setShowSuccess(false)} />

      <div className="content-fade-in" style={{ padding: '16px' }}>
        {/* Header */}
        <div style={{ marginBottom: '8px' }}>
          <span className="section-eyebrow">{t('m.rewards.title')}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 12px' }}>
            <span className="num-font" style={{ fontSize: '40px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)' }}>{user.points.toLocaleString(locale)}</span>
            <span style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>{t('m.rewards.points')}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            <span className="chip" style={{ cursor: 'default' }}><Icon name={currentTier.icon} size={14} style={{ color: 'var(--rum-text)' }} />{labels.tier(currentTier.key)}</span>
            {user.streak > 0 && <span className="chip" style={{ cursor: 'default' }}><Icon name="flame" size={14} style={{ color: 'var(--warning)' }} />{t('m.rewards.dayStreak', { n: user.streak })}</span>}
            <span className="chip" style={{ cursor: 'default' }}><Icon name="wallet" size={14} style={{ color: 'var(--label-secondary)' }} /><Price usd={user.walletBalance} compact /> {t('m.rewards.wallet')}</span>
          </div>
        </div>

        <Link href="/passport" className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', marginBottom: '24px', textDecoration: 'none' }}>
          <Icon name="mapPin" size={20} style={{ color: 'var(--rum-text)' }} />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)' }}>{t('m.rewards.passport')}</span>
            <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>{t('m.rewards.passportSub')}</span>
          </span>
          <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
        </Link>

        {/* Challenges */}
        <div className="section-header"><div className="section-heading"><span className="section-eyebrow">{t('m.challenges.eyebrow')}</span><span className="section-title">{t('m.challenges.title')}</span></div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' }}>
          {challenges.length === 0 ? <p style={{ fontSize: '14px', color: 'var(--label-secondary)' }}>{t('m.challenges.none')}</p> : challenges.map(c => (
            <div key={c.id} className="card" style={{ padding: '12px 14px', cursor: 'default' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Icon name={c.completed ? 'check' : 'flame'} size={16} style={{ color: c.completed ? 'var(--success)' : 'var(--warning)' }} />
                <span style={{ flex: 1, fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>{c.title}</span>
                <span className="num-font" style={{ fontSize: '13px', fontWeight: 700, color: c.completed ? 'var(--success)' : 'var(--rum-text)' }}>{c.completed ? t('m.challenges.done', { pts: c.bonusPoints }) : t('m.challenges.bonus', { pts: c.bonusPoints })}</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '8px' }}>{c.description}</p>
              <div role="progressbar" aria-valuemin={0} aria-valuemax={c.target} aria-valuenow={c.progress} style={{ height: '6px', borderRadius: '3px', background: 'var(--system-bg-secondary)', overflow: 'hidden' }}>
                <div style={{ width: `${(c.progress / c.target) * 100}%`, height: '100%', background: c.completed ? 'var(--success)' : 'var(--rum)' }} />
              </div>
              <p className="num-font" style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '4px', textAlign: 'right' }}>{t('m.challenges.progress', { n: c.progress, target: c.target })}</p>
            </div>
          ))}
        </div>

        {/* Leaderboard */}
        <div className="section-header"><div className="section-heading"><span className="section-eyebrow">{t('m.board.sub')}</span><span className="section-title">{t('m.board.title')}</span></div></div>
        <div className="card" style={{ padding: '6px 16px', marginBottom: '28px', cursor: 'default' }}>
          {board.length === 0 ? <p style={{ fontSize: '14px', color: 'var(--label-secondary)', padding: '10px 0' }}>{t('m.board.empty')}</p> : board.map(r => (
            <div key={r.rank} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '0.5px solid var(--separator)', fontWeight: r.me ? 700 : 500 }}>
              <span className="num-font" style={{ width: '24px', color: r.rank <= 3 ? 'var(--gold)' : 'var(--label-tertiary)' }}>{r.rank}</span>
              <span style={{ flex: 1, color: 'var(--label-primary)' }}>{r.name}{r.me ? ` (${t('m.board.you')})` : ''}</span>
              <span className="num-font" style={{ color: 'var(--label-secondary)' }}>{t('m.rewards.ptsShort', { n: r.points.toLocaleString(locale) })}</span>
            </div>
          ))}
          <button className="btn btn-tertiary" onClick={toggleBoard} style={{ width: '100%', minHeight: '44px' }}>
            {user.leaderboardOptIn ? `${t('m.board.joined')} · ${t('m.board.leave')}` : t('m.board.join')}
          </button>
        </div>

        {/* Tier ladder */}
        <div className="section-header"><div className="section-heading"><span className="section-eyebrow">{t('m.rewards.loyalty')}</span><span className="section-title">{t('m.rewards.yourTier')}</span></div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' }}>
          {REWARD_TIERS.map(tier => {
            const isCurrent = tier.key === currentTier.key
            return (
              <div key={tier.key} className="card" style={{ padding: '14px', cursor: 'default', border: isCurrent ? '1.5px solid var(--rum)' : undefined, opacity: user.points >= tier.threshold ? 1 : 0.55 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isCurrent ? 'var(--rum)' : 'var(--system-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={tier.icon} size={15} style={{ color: isCurrent ? 'white' : 'var(--label-secondary)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>{labels.tier(tier.key)}</p>
                    <p className="num-font" style={{ fontSize: '12px', color: 'var(--label-tertiary)' }}>{t('m.rewards.ptsPlus', { n: tier.threshold.toLocaleString(locale) })}</p>
                  </div>
                  {isCurrent && <span className="chip" style={{ cursor: 'default', fontSize: '11px' }}>{t('m.rewards.current')}</span>}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--label-secondary)', lineHeight: 1.4 }}>{tier.perks.map((_, i) => t(`m.perk.${tier.key}.${i}` as 'm.perk.WANDERER.0')).join(' · ')}</p>
              </div>
            )
          })}
        </div>

        {/* Catalog for the selected region */}
        <div className="section-header"><div className="section-heading"><span className="section-eyebrow">{t('m.rewards.redeem')}</span><span className="section-title">{t('m.rewards.available', { town: town.name })}</span></div></div>
        {catalog === null ? (
          <div className="skeleton-card" style={{ height: '160px', marginBottom: '28px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
        ) : catalog.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '28px' }}>{t('m.rewards.noneHere', { town: town.name })}</p>
        ) : (
          <div className="grid-2" style={{ marginBottom: '28px' }}>
            {catalog.map(reward => {
              const tierOk = meetsTier(reward)
              const canAfford = user.points >= reward.cost && tierOk
              return (
                <div key={reward.id} className="card" style={{ opacity: canAfford ? 1 : 0.6, cursor: 'default' }}>
                  <div className="card-content">
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--rum-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                      <Icon name={reward.icon} size={20} style={{ color: 'var(--rum-text)' }} />
                    </div>
                    <p className="card-title">{reward.name}</p>
                    <p className="card-subtitle" style={{ marginBottom: '6px' }}>{reward.description}</p>
                    <p style={{ fontSize: '11px', color: 'var(--label-tertiary)', marginBottom: '8px' }}>
                      {reward.vendors?.length ? t('m.rewards.at', { list: reward.vendors.map(v => v.name).join(', ') }) : reward.city ? null : t('m.rewards.everywhere')}
                    </p>
                    <p className="num-font card-price" style={{ marginBottom: '10px' }}>{t('m.rewards.ptsShort', { n: reward.cost.toLocaleString(locale) })}</p>
                    <button className={`btn ${canAfford ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%' }} disabled={!canAfford} onClick={() => { setRedeemError(null); setSelected(reward) }}>
                      {!tierOk && reward.minTier ? t('m.rewards.tierRequired', { tier: labels.tier(reward.minTier) }) : canAfford ? t('m.rewards.redeem') : t('m.rewards.needMore', { n: (reward.cost - user.points).toLocaleString(locale) })}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Vouchers */}
        <div className="section-header"><div className="section-heading"><span className="section-eyebrow">{t('m.rewards.history')}</span><span className="section-title">{t('m.rewards.recent')}</span></div></div>
        {historyFailed ? <ErrorState compact onRetry={loadRedemptions} /> : redemptions.length === 0 ? (
          <div className="empty-state"><Icon name="gift" size={28} style={{ color: 'var(--label-tertiary)' }} /><p>{patois.emptyRewards}</p></div>
        ) : (
          <div className="card" style={{ padding: '4px 16px' }}>
            {redemptions.map((r, i) => {
              const status = statusOf(r)
              const countdown = status === 'ACTIVE' ? expiresIn(r.expiresAt) : null
              return (
                <button key={r.id} onClick={() => setVoucher(r)} aria-label={t('m.rewards.showVoucher', { name: r.rewardName })} style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: i < redemptions.length - 1 ? '0.5px solid var(--separator)' : 'none', opacity: status === 'ACTIVE' ? 1 : 0.6 }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: status === 'USED' ? 'var(--system-bg-secondary)' : 'var(--rum-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={status === 'USED' ? 'check' : 'gift'} size={18} style={{ color: status === 'USED' ? 'var(--success)' : 'var(--rum-text)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)', textDecoration: status === 'USED' ? 'line-through' : undefined }}>{r.rewardName}</p>
                    <p className="caption-font" style={{ color: status === 'ACTIVE' ? 'var(--warning)' : 'var(--label-secondary)' }}>
                      <span className="num-font">{r.code}</span> · {status === 'USED' && r.usedAt ? t('m.rewards.usedOn', { date: new Date(r.usedAt).toLocaleDateString(locale, { month: 'short', day: 'numeric' }) }) : countdown ?? t(`m.rewards.status.${status}` as 'm.rewards.status.USED')}
                    </p>
                  </div>
                  <span className="num-font" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--label-secondary)' }}>-{r.pointCost.toLocaleString(locale)}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Redeem confirmation */}
      <div className={`bottom-sheet-overlay ${selected ? 'open' : ''}`} onClick={() => setSelected(null)} />
      <div className={`bottom-sheet ${selected ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.rewards.confirm')}>
        <div className="sheet-grabber" />
        {selected && (
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'var(--rum-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Icon name={selected.icon} size={26} style={{ color: 'var(--rum-text)' }} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', textAlign: 'center', marginBottom: '4px' }}>{selected.name}</h3>
            <p style={{ fontSize: '15px', color: 'var(--label-secondary)', textAlign: 'center', marginBottom: '16px' }}>{selected.description}</p>
            <div className="divider-faded" style={{ margin: '4px 0 16px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>{t('m.rewards.cost')}</span>
              <span className="num-font" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.rewards.ptsShort', { n: selected.cost.toLocaleString(locale) })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>{t('m.rewards.balanceAfter')}</span>
              <span className="num-font" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.rewards.ptsShort', { n: (user.points - selected.cost).toLocaleString(locale) })}</span>
            </div>
            {redeemError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px', textAlign: 'center' }}>{redeemError}</p>}
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: '8px' }} onClick={confirmRedeem} disabled={redeeming}>{redeeming ? patois.loadingRedeem : t('m.rewards.confirm')}</button>
            <button className="btn btn-tertiary" style={{ width: '100%' }} onClick={() => setSelected(null)}>{t('m.book.cancel')}</button>
          </div>
        )}
      </div>

      {/* Voucher */}
      <div className={`bottom-sheet-overlay ${voucher ? 'open' : ''}`} onClick={() => setVoucher(null)} />
      <div className={`bottom-sheet ${voucher ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.rewards.voucher')}>
        <div className="sheet-grabber" />
        {voucher && (() => {
          const status = statusOf(voucher)
          return (
            <div style={{ padding: '0 20px 24px', textAlign: 'center' }}>
              <p className="section-eyebrow">{t('m.rewards.voucher')}</p>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', margin: '2px 0 12px' }}>{voucher.rewardName}</h3>
              <div style={{ opacity: status === 'ACTIVE' ? 1 : 0.35, position: 'relative' }}>
                <QRCode value={voucher.code} size={200} />
              </div>
              <p className="num-font" style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--label-primary)', marginTop: '12px', textDecoration: status === 'USED' ? 'line-through' : undefined }}>{voucher.code}</p>
              <p role="status" style={{ fontSize: '14px', fontWeight: 700, margin: '6px 0 4px', color: status === 'ACTIVE' ? 'var(--warning)' : status === 'USED' ? 'var(--success)' : 'var(--error)' }}>
                {status === 'ACTIVE' ? expiresIn(voucher.expiresAt) : status === 'USED' && voucher.usedAt ? t('m.rewards.usedOn', { date: new Date(voucher.usedAt).toLocaleDateString(locale, { month: 'short', day: 'numeric' }) }) : t(`m.rewards.status.${status}` as 'm.rewards.status.USED')}
              </p>
              {status === 'ACTIVE' && <p style={{ fontSize: '13px', color: 'var(--label-secondary)', margin: '0 0 16px' }}>{t('m.rewards.showVendor')}</p>}
              <button className="btn btn-tertiary" onClick={() => setVoucher(null)} style={{ width: '100%', marginTop: '8px' }}>{t('m.profile.done')}</button>
            </div>
          )
        })()}
      </div>

      <Dock />
    </main>
  )
}
