// app/rewards/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import SuccessAnimation from '@/components/SuccessAnimation'
import { getCurrentUser, setCurrentUser, CurrentUser } from '@/lib/auth-client'
import { patois } from '@/lib/patois'
import { hapticRewardRedeemed } from '@/lib/haptics'
import { REWARD_TIERS, getTierForPoints } from '@/lib/rewardTiers'

interface RewardItem {
  id: string
  name: string
  cost: number
  description: string
  icon: string
  minTier?: string
}

interface Redemption {
  id: string
  rewardName: string
  pointCost: number
  redeemedAt: string
}

const REWARD_CATALOG: RewardItem[] = [
  {
    id: 'credit-10',
    name: '$10 Marketplace Credit',
    cost: 500,
    description: 'Knock $10 off any vendor order in the marketplace.',
    icon: 'gift'
  },
  {
    id: 'booking-10off',
    name: '10% Off Next Booking',
    cost: 300,
    description: 'A discount on your next experience booking.',
    icon: 'sparkle'
  },
  {
    id: 'rum-punch',
    name: 'Free Round of Rum Punch',
    cost: 350,
    description: 'On the house at a participating beach bar.',
    icon: 'glass'
  },
  {
    id: 'airport-transfer',
    name: 'Free Airport Transfer',
    cost: 800,
    description: 'One-way transfer between MBJ and your stay.',
    icon: 'route'
  },
  {
    id: 'priority-table',
    name: 'Priority Restaurant Table',
    cost: 600,
    description: 'Skip the wait at a top-rated Negril spot.',
    icon: 'star'
  },
  {
    id: 'sunset-cruise',
    name: 'Free Sunset Cruise Upgrade',
    cost: 1200,
    description: 'Upgrade to the sunset sail on your next catamaran trip.',
    icon: 'wave'
  },
  {
    id: 'spa-pass',
    name: 'Half-Day Spa Pass',
    cost: 1500,
    description: 'A half day of spa access at a partner resort.',
    icon: 'spa'
  },
  {
    id: 'vip-cabana',
    name: 'VIP Cabana for a Day',
    cost: 2000,
    description: 'A full day in a private beachfront cabana.',
    icon: 'crown'
  },
  {
    id: 'legend-concierge',
    name: 'Personal Concierge Day',
    cost: 2500,
    description: 'A dedicated local concierge plans and runs your whole day. Legend tier exclusive.',
    icon: 'star',
    minTier: 'LOCAL_LEGEND'
  }
]

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function RewardsPage() {
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    setUser(getCurrentUser())
    try {
      const raw = localStorage.getItem('etaRedemptions')
      if (raw) setRedemptions(JSON.parse(raw))
    } catch {
      setRedemptions([])
    }
    setMounted(true)
  }, [])

  const meetsTier = (reward: RewardItem) => {
    if (!reward.minTier || !user) return true
    const currentIdx = REWARD_TIERS.findIndex(t => t.key === getTierForPoints(user.points).key)
    const requiredIdx = REWARD_TIERS.findIndex(t => t.key === reward.minTier)
    return currentIdx >= requiredIdx
  }

  const openConfirm = (reward: RewardItem) => {
    if (!user || user.points < reward.cost || !meetsTier(reward)) return
    setSelectedReward(reward)
    setSheetOpen(true)
  }

  const closeSheet = () => {
    setSheetOpen(false)
  }

  const handleConfirmRedeem = () => {
    if (!user || !selectedReward) return
    const cost = selectedReward.cost
    const updatedUser: CurrentUser = { ...user, points: user.points - cost }
    setCurrentUser(updatedUser)
    setUser(updatedUser)
    hapticRewardRedeemed()

    const newRedemption: Redemption = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      rewardName: selectedReward.name,
      pointCost: cost,
      redeemedAt: new Date().toISOString()
    }
    const updatedRedemptions = [newRedemption, ...redemptions]
    setRedemptions(updatedRedemptions)
    try {
      localStorage.setItem('etaRedemptions', JSON.stringify(updatedRedemptions))
    } catch {
      // ignore storage errors
    }

    setSheetOpen(false)
    setSelectedReward(null)
    setShowSuccess(true)
  }

  if (!mounted) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
        <Dock />
      </main>
    )
  }

  if (!user) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
        <div className="empty-state" style={{ minHeight: '70vh' }}>
          <Icon name="gift" size={32} style={{ color: 'var(--label-tertiary)' }} />
          <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>Log in to see your rewards</p>
          <p style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>
            Track your points and redeem perks around Negril &amp; Montego Bay.
          </p>
          <Link href="/login" className="btn btn-primary" style={{ marginTop: '8px', textDecoration: 'none' }}>
            Log In
          </Link>
        </div>
        <Dock />
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <SuccessAnimation show={showSuccess} onComplete={() => setShowSuccess(false)} />

      <div className="content-fade-in" style={{ padding: '16px' }}>
        {/* HEADER */}
        <div style={{ marginBottom: '8px' }}>
          <span className="section-eyebrow">Rewards</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 12px' }}>
            <span className="num-font" style={{ fontSize: '40px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)' }}>
              {user.points.toLocaleString()}
            </span>
            <span style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>points</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            <span className="chip" style={{ cursor: 'default' }}>
              <Icon name={getTierForPoints(user.points).icon as any} size={14} style={{ color: 'var(--rum-text)' }} />
              {getTierForPoints(user.points).label}
            </span>
            {user.streak > 0 && (
              <span className="chip" style={{ cursor: 'default' }}>
                <Icon name="flame" size={14} style={{ color: 'var(--warning)' }} />
                <span className="num-font">{user.streak}</span> day streak
              </span>
            )}
            <span className="chip" style={{ cursor: 'default' }}>
              <Icon name="wallet" size={14} style={{ color: 'var(--label-secondary)' }} />
              <span className="num-font">${user.walletBalance.toFixed(2)}</span> wallet
            </span>
          </div>
        </div>

        {/* TIER LADDER */}
        <div className="section-header">
          <div className="section-heading">
            <span className="section-eyebrow">Loyalty</span>
            <span className="section-title">Your Tier</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' }}>
          {REWARD_TIERS.map(tier => {
            const isCurrent = tier.key === getTierForPoints(user.points).key
            const unlocked = user.points >= tier.threshold
            return (
              <div
                key={tier.key}
                className="card"
                style={{
                  padding: '14px',
                  cursor: 'default',
                  border: isCurrent ? '1.5px solid var(--rum)' : undefined,
                  opacity: unlocked ? 1 : 0.55
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: tier.perks.length ? '6px' : 0 }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isCurrent ? 'var(--rum)' : 'var(--system-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={tier.icon as any} size={15} style={{ color: isCurrent ? 'white' : 'var(--label-secondary)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>{tier.label}</p>
                    <p className="num-font" style={{ fontSize: '12px', color: 'var(--label-tertiary)' }}>{tier.threshold.toLocaleString()}+ pts</p>
                  </div>
                  {isCurrent && <span className="chip" style={{ cursor: 'default', fontSize: '11px' }}>Current</span>}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--label-secondary)', lineHeight: 1.4 }}>{tier.perks.join(' · ')}</p>
              </div>
            )
          })}
        </div>

        {/* REWARD CATALOG */}
        <div className="section-header">
          <div className="section-heading">
            <span className="section-eyebrow">Redeem</span>
            <span className="section-title">Available Rewards</span>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: '28px' }}>
          {REWARD_CATALOG.map(reward => {
            const tierOk = meetsTier(reward)
            const canAfford = user.points >= reward.cost && tierOk
            const requiredTier = reward.minTier ? REWARD_TIERS.find(t => t.key === reward.minTier) : null
            return (
              <div
                key={reward.id}
                className="card"
                style={{
                  opacity: canAfford ? 1 : 0.5,
                  pointerEvents: canAfford ? 'auto' : 'none'
                }}
                onClick={() => openConfirm(reward)}
              >
                <div className="card-content">
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'var(--rum-tint)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '10px'
                    }}
                  >
                    <Icon name={reward.icon} size={20} style={{ color: 'var(--rum-text)' }} />
                  </div>
                  <p className="card-title">{reward.name}</p>
                  <p className="card-subtitle" style={{ marginBottom: '10px' }}>{reward.description}</p>
                  <p className="num-font card-price" style={{ marginBottom: '10px' }}>
                    {reward.cost.toLocaleString()} pts
                  </p>
                  <button
                    className={`btn ${canAfford ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ width: '100%' }}
                    disabled={!canAfford}
                    onClick={(e) => { e.stopPropagation(); openConfirm(reward) }}
                  >
                    {!tierOk && requiredTier ? `${requiredTier.label} tier required` : canAfford ? 'Redeem' : `Need ${(reward.cost - user.points).toLocaleString()} more`}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* RECENT REDEMPTIONS */}
        <div>
          <div className="section-header">
            <div className="section-heading">
              <span className="section-eyebrow">History</span>
              <span className="section-title">Recent Redemptions</span>
            </div>
          </div>

          {redemptions.length === 0 ? (
            <div className="empty-state">
              <Icon name="gift" size={28} style={{ color: 'var(--label-tertiary)' }} />
              <p>{patois.emptyRewards}</p>
            </div>
          ) : (
            <div className="card" style={{ padding: '4px 16px' }}>
              {redemptions.map((r, i) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 0',
                    borderBottom: i < redemptions.length - 1 ? '0.5px solid var(--separator)' : 'none'
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'var(--system-bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Icon name="gift" size={18} style={{ color: 'var(--label-secondary)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{r.rewardName}</p>
                    <p className="caption-font" style={{ color: 'var(--label-secondary)' }}>{formatDate(r.redeemedAt)}</p>
                  </div>
                  <span className="num-font" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--label-secondary)' }}>
                    -{r.pointCost.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* REDEEM CONFIRMATION SHEET */}
      <div className={`bottom-sheet-overlay ${sheetOpen ? 'open' : ''}`} onClick={closeSheet} />
      <div className={`bottom-sheet ${sheetOpen ? 'open' : ''}`}>
        <div className="sheet-grabber" />
        {selectedReward && (
          <div style={{ padding: '0 20px 20px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: 'var(--rum-tint)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px'
              }}
            >
              <Icon name={selectedReward.icon} size={26} style={{ color: 'var(--rum-text)' }} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', textAlign: 'center', marginBottom: '4px' }}>
              {selectedReward.name}
            </h3>
            <p style={{ fontSize: '15px', color: 'var(--label-secondary)', textAlign: 'center', marginBottom: '16px' }}>
              {selectedReward.description}
            </p>

            <div className="divider-faded" style={{ margin: '4px 0 16px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>Cost</span>
              <span className="num-font" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>
                {selectedReward.cost.toLocaleString()} pts
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>Balance after</span>
              <span className="num-font" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>
                {(user.points - selectedReward.cost).toLocaleString()} pts
              </span>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', marginBottom: '8px' }} onClick={handleConfirmRedeem}>
              Confirm Redemption
            </button>
            <button className="btn btn-tertiary" style={{ width: '100%' }} onClick={closeSheet}>
              Cancel
            </button>
          </div>
        )}
      </div>

      <Dock />
    </main>
  )
}
