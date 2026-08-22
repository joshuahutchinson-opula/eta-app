// app/wallet/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import FloatingPill from '@/components/FloatingPill'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'

interface PointsTransaction {
  id: string
  amount: number
  type: 'earned' | 'spent'
  description: string
  date: string
}

interface Reward {
  id: string
  name: string
  pointsCost: number
  icon: string
  available: boolean
}

interface Redemption {
  id: string
  reward: string
  pointsCost: number
  status: 'pending' | 'completed'
  date: string
}

const NEXT_REWARD_THRESHOLD = 2000

export default function WalletPage() {
  const router = useRouter()
  const [points, setPoints] = useState(1240)
  const [history, setHistory] = useState<PointsTransaction[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [outstanding, setOutstanding] = useState<Redemption[]>([])
  const [redemptionHistory, setRedemptionHistory] = useState<Redemption[]>([])
  const [loading, setLoading] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    fetchWalletData()
  }, [])

  const fetchWalletData = async () => {
    try {
      // Mock data — will connect to API
      setPoints(1240)
      setRewards([
        { id: 'r1', name: 'Free Jerk Plate', pointsCost: 500, icon: 'food', available: true },
        { id: 'r2', name: 'Sunset Catamaran Ride', pointsCost: 800, icon: 'activity', available: true },
        { id: 'r3', name: 'Beach Day Pass', pointsCost: 350, icon: 'sun', available: true },
        { id: 'r4', name: 'Rum Punch Flight', pointsCost: 250, icon: 'drink', available: true },
        { id: 'r5', name: '2x Points Weekend', pointsCost: 500, icon: 'sparkle', available: true },
        { id: 'r6', name: 'Private Driver Day', pointsCost: 1500, icon: 'compass', available: false }
      ])
      setHistory([
        { id: '1', amount: 250, type: 'earned', description: 'Sunset Catamaran experience', date: 'Today, 4:30 PM' },
        { id: '2', amount: 100, type: 'earned', description: 'Check-in at Rick\'s Café', date: 'Today, 3:15 PM' },
        { id: '3', amount: 500, type: 'spent', description: 'Redeemed Free Jerk Plate', date: 'Yesterday' },
        { id: '4', amount: 320, type: 'earned', description: 'Water Life Loop completed', date: 'Yesterday' },
        { id: '5', amount: 50, type: 'earned', description: 'Reviewed Pork Pit', date: '2 days ago' },
        { id: '6', amount: 170, type: 'earned', description: 'Golden Hour Drift completed', date: '3 days ago' }
      ])
      setOutstanding([
        { id: 'o1', reward: 'Sunset Catamaran Ride', pointsCost: 800, status: 'pending', date: 'Requested today' },
        { id: 'o2', reward: '2x Points Weekend Pass', pointsCost: 500, status: 'pending', date: 'Requested today' }
      ])
      setRedemptionHistory([
        { id: 'rh1', reward: 'Free Jerk Plate at Pork Pit', pointsCost: 500, status: 'completed', date: 'Yesterday' },
        { id: 'rh2', reward: 'Beach Day Pass', pointsCost: 350, status: 'completed', date: 'Last week' }
      ])
    } catch (error) {
      console.error('Failed to fetch wallet data:', error)
    } finally {
      setLoading(false)
    }
  }

  const progressPercent = Math.min(100, Math.round((points / NEXT_REWARD_THRESHOLD) * 100))
  const pointsToNext = Math.max(0, NEXT_REWARD_THRESHOLD - points)

  const triggerConfetti = () => {
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 1500)
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--off-white)' }}>
        <FloatingPill />
        <div style={{ padding: '16px', paddingBottom: '100px', paddingTop: '60px' }}>
          <div className="skeleton-card" style={{ height: '180px', marginBottom: '24px' }}>
            <div className="skeleton-image" style={{ height: '100%' }} />
          </div>
          <div className="skeleton-card" style={{ height: '100px', marginBottom: '24px' }}>
            <div className="skeleton-image" style={{ height: '100%' }} />
          </div>
          <div className="skeleton-card" style={{ height: '200px' }}>
            <div className="skeleton-image" style={{ height: '100%' }} />
          </div>
        </div>
        <Dock />
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--off-white)', paddingBottom: '80px', overflowX: 'hidden' }}>
      <FloatingPill />

      {/* Confetti */}
      {showConfetti && (
        <>
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-10px',
                background: ['#FF4B2B', '#FFB800', '#00E5CC', '#9333EA'][i % 4],
                animationDelay: `${Math.random() * 0.3}s`
              }}
            />
          ))}
        </>
      )}

      <div style={{ padding: '60px 16px 16px' }}>
        {/* Branded Membership Card */}
        <div className="wallet-branded-card" style={{ marginBottom: '24px' }}>
          <div className="wallet-branded-card-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                ET<span style={{ color: 'var(--rum)' }}>A</span>
              </span>
              <span style={{ 
                fontSize: '10px', 
                fontWeight: 700, 
                letterSpacing: '1.5px', 
                textTransform: 'uppercase',
                background: 'rgba(255,75,43,0.3)',
                padding: '4px 10px',
                borderRadius: '999px'
              }}>
                Gold Member
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
              Jordan Hutchinson
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className="num-font" style={{ fontSize: '36px', fontWeight: 700, color: 'var(--rum)' }}>
                {points.toLocaleString()}
              </span>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>points</span>
            </div>

            {/* Progress ring */}
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                  {pointsToNext > 0 ? `${pointsToNext} pts to next reward` : 'Next reward unlocked!'}
                </span>
                <span className="num-font" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                  {progressPercent}%
                </span>
              </div>
              <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
                <div className="progress-fill" style={{ 
                  width: `${progressPercent}%`, 
                  height: '100%', 
                  borderRadius: '3px',
                  background: 'var(--rum)'
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Outstanding */}
        {outstanding.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">PENDING</span>
                <span className="section-title">Outstanding</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {outstanding.map(item => (
                <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--black)', marginBottom: '2px' }}>{item.reward}</p>
                    <p className="num-font" style={{ fontSize: '11px', color: 'var(--grey)' }}>{item.pointsCost} pts · {item.date}</p>
                  </div>
                  <span style={{ 
                    fontSize: '10px', 
                    fontWeight: 700, 
                    padding: '4px 8px', 
                    borderRadius: '999px',
                    background: 'var(--light-grey)',
                    color: 'var(--grey)'
                  }}>
                    PENDING
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Redeemable Rewards - horizontal scroll */}
        <div style={{ marginBottom: '32px' }}>
          <div className="section-header">
            <div className="section-heading">
              <span className="section-eyebrow">REDEEM</span>
              <span className="section-title">Rewards</span>
            </div>
          </div>
          <div className="horizontal-scroll" style={{ padding: '8px 0 16px 0' }}>
            {rewards.map(reward => (
              <div key={reward.id} className="card" style={{ width: '140px', flexShrink: 0, cursor: reward.available ? 'pointer' : 'default', opacity: reward.available ? 1 : 0.5 }}>
                <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--light-grey)' }}>
                  <Icon name={reward.icon as any} size={28} style={{ color: 'var(--grey)' }} />
                </div>
                <div className="card-content">
                  <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--black)', marginBottom: '4px' }}>{reward.name}</p>
                  <p className="num-font" style={{ fontSize: '11px', color: reward.available ? 'var(--rum)' : 'var(--grey)' }}>
                    {reward.pointsCost} pts
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Points History */}
        <div style={{ marginBottom: '32px' }}>
          <div className="section-header">
            <div className="section-heading">
              <span className="section-eyebrow">ACTIVITY</span>
              <span className="section-title">Points History</span>
            </div>
          </div>
          <div className="card" style={{ padding: '4px 16px' }}>
            {history.map((h, i) => (
              <div key={h.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                padding: '12px 0',
                borderBottom: i < history.length - 1 ? '1px solid var(--light-grey)' : 'none'
              }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: h.type === 'earned' ? 'rgba(255,75,43,0.08)' : 'var(--light-grey)',
                  flexShrink: 0
                }}>
                  <Icon name={h.type === 'earned' ? 'arrow-up' : 'gift'} size={14} style={{ color: h.type === 'earned' ? 'var(--rum)' : 'var(--grey)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--black)' }}>{h.description}</p>
                  <p style={{ fontSize: '11px', color: 'var(--grey)' }}>{h.date}</p>
                </div>
                <span className="num-font" style={{ 
                  fontSize: '13px', 
                  fontWeight: 700, 
                  color: h.type === 'earned' ? 'var(--rum)' : 'var(--grey)'
                }}>
                  {h.type === 'earned' ? '+' : '-'}{h.amount}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Redemption History */}
        {redemptionHistory.length > 0 && (
          <div>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">PREVIOUS</span>
                <span className="section-title">Redeemed</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {redemptionHistory.map(item => (
                <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--black)', marginBottom: '2px' }}>{item.reward}</p>
                    <p className="num-font" style={{ fontSize: '11px', color: 'var(--grey)' }}>{item.pointsCost} pts · {item.date}</p>
                  </div>
                  <span style={{ 
                    fontSize: '10px', 
                    fontWeight: 700, 
                    padding: '4px 8px', 
                    borderRadius: '999px',
                    background: 'var(--light-grey)',
                    color: 'var(--grey)'
                  }}>
                    DONE
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dock />
    </main>
  )
}