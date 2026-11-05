// app/rewards/page.tsx — the Rewards hub (opened from Home's points pill):
// one place for points, vouchers and discoveries. The wallet lives on
// Scan & Pay (app/pay).
//   Points       this month's challenges, the rewards available in the
//                selected region (some unlock with a QR visit), your tier,
//                the opt-in leaderboard.
//   Vouchers     everything redeemed or handed out (welcome perks), with
//                expiry countdowns and a Used state; partner codes.
//   Discoveries  the passport map of everywhere you've been, counts, badges.
// Points never expire, between trips too. ?tab= opens a tab directly.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import SuccessAnimation from '@/components/SuccessAnimation'
import QRCode from '@/components/QRCode'
import ErrorState from '@/components/ErrorState'
import Price from '@/components/Price'
import { getCurrentUser, setCurrentUser, type CurrentUser } from '@/lib/auth-client'
import { useErrorText, useLang, usePatois } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { hapticRewardRedeemed, hapticSaved, triggerHaptic } from '@/lib/haptics'
import { REWARD_TIERS, getTierForPoints, tierProgress } from '@/lib/rewardTiers'
import type { RewardItem } from '@/lib/rewards'
import type { Badge, PassportPlace } from '@/lib/passport'
import { apiJson } from '@/lib/api-client'
import { useRegion } from '@/components/RegionProvider'
import { isCityCode } from '@/lib/regions'

const PassportMap = dynamic(() => import('@/components/PassportMap'), { ssr: false })

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
interface Passport {
  places: PassportPlace[]
  counts: { places: number; checkIns: number; photoSpots: number; gems: number; towns: number; byCategory: Record<string, number> }
  streak: number
  bestStreak: number
  badges: Badge[]
}
const TABS = ['points', 'vouchers', 'discoveries'] as const
type Tab = (typeof TABS)[number]

const BADGE_ICON: Record<string, string> = { firstCheckin: 'check', beaches5: 'wave', food10: 'food', firstGem: 'sparkle', photo5: 'camera', streak7: 'flame', places25: 'mapPin', towns3: 'route' }
export default function RewardsHub() {
  const patois = usePatois()
  const { t, lang } = useLang()
  const errorText = useErrorText()
  const labels = useLabels()
  const { city, town, ready, setCity } = useRegion()
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<Tab>('points')
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [catalog, setCatalog] = useState<RewardItem[] | null>(null)
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [board, setBoard] = useState<BoardRow[]>([])
  const [passport, setPassport] = useState<Passport | null>(null)
  const [passportFailed, setPassportFailed] = useState(false)
  const [selected, setSelected] = useState<RewardItem | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [voucher, setVoucher] = useState<Redemption | null>(null)
  const [redeeming, setRedeeming] = useState(false)
  const [redeemError, setRedeemError] = useState<string | null>(null)
  const [historyFailed, setHistoryFailed] = useState(false)
  const [partnerCode, setPartnerCode] = useState('')
  const [partnerMsg, setPartnerMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const locale = lang === 'en' ? 'en-US' : lang

  const loadRedemptions = useCallback(async () => {
    setHistoryFailed(false)
    try { setRedemptions(await apiJson<Redemption[]>('/api/rewards/redemptions')) } catch { setHistoryFailed(true) }
  }, [])
  const loadBoard = useCallback(() => {
    apiJson<{ rows: BoardRow[] }>('/api/leaderboard').then(d => setBoard(d.rows)).catch(() => {})
  }, [])
  const loadPassport = useCallback(async () => {
    setPassportFailed(false)
    try { setPassport(await apiJson<Passport>('/api/passport')) } catch { setPassportFailed(true) }
  }, [])
  useEffect(() => {
    const current = getCurrentUser()
    setUser(current)
    const asked = new URLSearchParams(window.location.search).get('tab')
    if ((TABS as readonly string[]).includes(asked ?? '')) setTab(asked as Tab)
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
    apiJson<RewardItem[]>(`/api/rewards?city=${city}`).then(d => setCatalog(Array.isArray(d) ? d : [])).catch(() => setCatalog([]))
    if (getCurrentUser()) apiJson<{ challenges: Challenge[] }>(`/api/challenges?city=${city}`).then(d => setChallenges(d.challenges)).catch(() => {})
  }, [city, ready])

  // Discoveries load the first time their tab opens.
  useEffect(() => {
    if (user && tab === 'discoveries' && !passport) loadPassport()
  }, [tab, user, passport, loadPassport])

  const pickTab = (next: Tab) => {
    triggerHaptic('selection')
    setTab(next)
    try { window.history.replaceState(null, '', `/rewards?tab=${next}`) } catch {}
  }

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

  const applyPartnerCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setPartnerMsg(null)
    try {
      const joined = await apiJson<{ property: { name: string; city: string }; redemption: Redemption | null }>(`/api/partners/${encodeURIComponent(partnerCode.trim())}`, { method: 'POST' })
      if (isCityCode(joined.property.city)) setCity(joined.property.city)
      hapticSaved()
      setPartnerCode('')
      setPartnerMsg({ ok: true, text: joined.redemption ? t('m.partner.perkAdded', { name: joined.property.name }) : t('m.partner.linked', { name: joined.property.name }) })
      loadRedemptions()
    } catch (err) {
      setPartnerMsg({ ok: false, text: errorText(err) })
    }
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
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' })

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
  const { percent, pointsToNext, next: nextTier } = tierProgress(user.points)
  const stat = (value: number, label: string) => (
    <div className="card" style={{ padding: '14px 8px', textAlign: 'center', cursor: 'default' }}>
      <p className="num-font" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)' }}>{value}</p>
      <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>{label}</p>
    </div>
  )
  const heading = (eyebrow: string, title: string) => (
    <div className="section-header"><div className="section-heading"><span className="section-eyebrow">{eyebrow}</span><span className="section-title">{title}</span></div></div>
  )

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <SuccessAnimation show={showSuccess} onComplete={() => setShowSuccess(false)} />

      <div className="content-fade-in" style={{ padding: '16px' }}>
        {/* Header: points, tier, wallet */}
        <span className="section-eyebrow">{t('m.rewards.title')}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 8px' }}>
          <span className="num-font" style={{ fontSize: '40px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)' }}>{user.points.toLocaleString(locale)}</span>
          <span style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>{t('m.rewards.points')}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
          <span className="chip" style={{ cursor: 'default' }}><Icon name={currentTier.icon} size={14} style={{ color: 'var(--rum-text)' }} />{labels.tier(currentTier.key)}</span>
          {user.streak > 0 && <span className="chip" style={{ cursor: 'default' }}><Icon name="flame" size={14} style={{ color: 'var(--warning)' }} />{t('m.rewards.dayStreak', { n: user.streak })}</span>}
          <Link href="/pay" className="chip" style={{ textDecoration: 'none' }}><Icon name="wallet" size={14} style={{ color: 'var(--label-secondary)' }} /><Price usd={user.walletBalance} /></Link>
        </div>
        <div style={{ marginBottom: '6px' }}>
          <div style={{ height: '6px', borderRadius: '3px', background: 'var(--system-bg-secondary)', overflow: 'hidden' }}>
            <div className="progress-fill" style={{ width: `${percent}%`, height: '100%', background: 'var(--rum)' }} />
          </div>
          <p className="num-font" style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '4px' }}>
            {nextTier ? t('m.hub.toNext', { n: pointsToNext.toLocaleString(locale), tier: labels.tier(nextTier.key) }) : t('m.hub.topTier')}
          </p>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--label-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
          <Icon name="sparkle" size={12} style={{ color: 'var(--gold)' }} /> {t('m.hub.neverExpire')}
        </p>

        <div role="tablist" aria-label={t('m.rewards.title')} className="segmented-control" style={{ marginBottom: '20px' }}>
          {TABS.map(k => (
            <button key={k} role="tab" aria-selected={tab === k} className={`segmented-control-option ${tab === k ? 'active' : ''}`} onClick={() => pickTab(k)}>
              {t(`m.hub.tab.${k}` as 'm.hub.tab.points')}
            </button>
          ))}
        </div>

        {tab === 'points' && (
          <>
            {heading(t('m.challenges.eyebrow'), t('m.challenges.title'))}
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

            {heading(t('m.rewards.redeem'), t('m.rewards.available', { town: town.name }))}
            {catalog === null ? (
              <div className="skeleton-card" style={{ height: '160px', marginBottom: '28px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
            ) : catalog.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '28px' }}>{t('m.rewards.noneHere', { town: town.name })}</p>
            ) : (
              <div className="grid-2" style={{ marginBottom: '28px' }}>
                {catalog.map(reward => {
                  const tierOk = meetsTier(reward)
                  const locked = Boolean(reward.locked)
                  const canAfford = user.points >= reward.cost && tierOk && !locked
                  return (
                    <div key={reward.id} className="card" style={{ opacity: canAfford ? 1 : 0.6, cursor: 'default' }}>
                      <div className="card-content">
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--rum-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                          <Icon name={locked ? 'lock' : reward.icon} size={20} style={{ color: 'var(--rum-text)' }} />
                        </div>
                        <p className="card-title">{reward.name}</p>
                        <p className="card-subtitle" style={{ marginBottom: '6px' }}>{reward.description}</p>
                        <p style={{ fontSize: '11px', color: 'var(--label-tertiary)', marginBottom: '8px' }}>
                          {reward.vendors?.length ? t('m.rewards.at', { list: reward.vendors.map(v => v.name).join(', ') }) : reward.city ? null : t('m.rewards.everywhere')}
                        </p>
                        <p className="num-font card-price" style={{ marginBottom: '10px' }}>{t('m.rewards.ptsShort', { n: reward.cost.toLocaleString(locale) })}</p>
                        <button className={`btn ${canAfford ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%' }} disabled={!canAfford} onClick={() => { setRedeemError(null); setSelected(reward) }}>
                          {locked ? t('m.rewards.visitToUnlock') : !tierOk && reward.minTier ? t('m.rewards.tierRequired', { tier: labels.tier(reward.minTier) }) : canAfford ? t('m.rewards.redeem') : t('m.rewards.needMore', { n: (reward.cost - user.points).toLocaleString(locale) })}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {heading(t('m.rewards.loyalty'), t('m.rewards.yourTier'))}
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

            {heading(t('m.board.sub'), t('m.board.title'))}
            <div className="card" style={{ padding: '6px 16px', cursor: 'default' }}>
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
          </>
        )}

        {tab === 'vouchers' && (
          <>
            {heading(t('m.rewards.history'), t('m.rewards.recent'))}
            {historyFailed ? <ErrorState compact onRetry={loadRedemptions} /> : redemptions.length === 0 ? (
              <div className="empty-state"><Icon name="gift" size={28} style={{ color: 'var(--label-tertiary)' }} /><p>{patois.emptyRewards}</p></div>
            ) : (
              <div className="card" style={{ padding: '4px 16px', marginBottom: '24px' }}>
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
                          <span className="num-font">{r.code}</span> · {status === 'USED' && r.usedAt ? t('m.rewards.usedOn', { date: shortDate(r.usedAt) }) : countdown ?? t(`m.rewards.status.${status}` as 'm.rewards.status.USED')}
                        </p>
                      </div>
                      <span className="num-font" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--label-secondary)' }}>{r.pointCost > 0 ? `-${r.pointCost.toLocaleString(locale)}` : t('m.hub.free')}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {heading(t('m.partner.eyebrow'), t('m.partner.title'))}
            <form onSubmit={applyPartnerCode} className="card" style={{ padding: '14px', cursor: 'default' }}>
              <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '10px' }}>{t('m.partner.sub')}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={partnerCode} onChange={e => setPartnerCode(e.target.value.toUpperCase())} placeholder={t('m.partner.placeholder')} aria-label={t('m.partner.title')} autoCapitalize="characters" autoComplete="off" className="num-font" style={{ flex: 1, minWidth: 0, padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', color: 'var(--label-primary)', fontSize: '16px', letterSpacing: '0.06em' }} />
                <button type="submit" className="btn btn-primary" disabled={partnerCode.trim().length < 3} style={{ padding: '0 16px' }}>{t('m.partner.apply')}</button>
              </div>
              {partnerMsg && <p role="status" style={{ fontSize: '13px', marginTop: '8px', color: partnerMsg.ok ? 'var(--success)' : 'var(--error)' }}>{partnerMsg.text}</p>}
            </form>
          </>
        )}

        {tab === 'discoveries' && (
          passportFailed ? <ErrorState onRetry={loadPassport} /> : !passport ? (
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

              <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.passport.badges')}</span></div></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                {passport.badges.map(b => (
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
          )
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
                {status === 'ACTIVE' ? expiresIn(voucher.expiresAt) : status === 'USED' && voucher.usedAt ? t('m.rewards.usedOn', { date: shortDate(voucher.usedAt) }) : t(`m.rewards.status.${status}` as 'm.rewards.status.USED')}
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
