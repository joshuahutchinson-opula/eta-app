// app/wallet/page.tsx
'use client'

import { useState } from 'react'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import { hapticRewardRedeemed } from '@/lib/haptics'
import SuccessAnimation from '@/components/SuccessAnimation'

interface PaymentCard {
  id: string
  brand: string
  last4: string
  expiry: string
  isDefault: boolean
}

interface PointsTransaction {
  id: string
  amount: number
  type: 'earned' | 'spent'
  description: string
  date: string
  vendorImage?: string
}

interface Reward {
  id: string
  name: string
  pointsCost: number
  image: string
  available: boolean
}

const MOCK_CARDS: PaymentCard[] = [
  { id: 'card-1', brand: 'Visa', last4: '4242', expiry: '09/27', isDefault: true },
  { id: 'card-2', brand: 'Mastercard', last4: '8888', expiry: '11/26', isDefault: false },
]

const MOCK_HISTORY: PointsTransaction[] = [
  { id: '1', amount: 250, type: 'earned', description: 'Sunset Catamaran experience', date: 'Today', vendorImage: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=60&h=60&fit=crop' },
  { id: '2', amount: 100, type: 'earned', description: 'Check-in at Rick\'s Café', date: 'Today', vendorImage: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=60&h=60&fit=crop' },
  { id: '3', amount: 500, type: 'spent', description: 'Redeemed Free Jerk Plate', date: 'Yesterday', vendorImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=60&h=60&fit=crop' },
  { id: '4', amount: 320, type: 'earned', description: 'Water Life Loop completed', date: 'Yesterday', vendorImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=60&h=60&fit=crop' },
]

const MOCK_REWARDS: Reward[] = [
  { id: 'r1', name: 'Free Jerk Plate', pointsCost: 500, image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&h=150&fit=crop', available: true },
  { id: 'r2', name: 'Sunset Catamaran', pointsCost: 800, image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200&h=150&fit=crop', available: true },
  { id: 'r3', name: 'Beach Day Pass', pointsCost: 350, image: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=200&h=150&fit=crop', available: true },
  { id: 'r4', name: 'Rum Punch Flight', pointsCost: 250, image: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=200&h=150&fit=crop', available: true },
]

const NEXT_REWARD_THRESHOLD = 2000

export default function WalletPage() {
  const [points] = useState(1240)
  const [balance] = useState(250)
  const [passportOpen, setPassportOpen] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const progressPercent = Math.min(100, Math.round((points / NEXT_REWARD_THRESHOLD) * 100))
  const pointsToNext = Math.max(0, NEXT_REWARD_THRESHOLD - points)

  const handleRedeem = (rewardName: string) => {
    hapticRewardRedeemed()
    setShowSuccess(true)
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <SuccessAnimation show={showSuccess} onComplete={() => setShowSuccess(false)} />

      <div className="content-fade-in" style={{ padding: '16px' }}>
        {/* WALLET SECTION */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '4px' }}>Wallet</p>
          <h2 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginBottom: '16px' }}>
            ${balance.toFixed(2)}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {MOCK_CARDS.map(card => (
              <div key={card.id} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'var(--rum-tint)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Icon name="card" size={20} style={{ color: 'var(--rum)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>
                    {card.brand} •••• {card.last4}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>
                    Expires {card.expiry}
                  </p>
                </div>
                {card.isDefault && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '4px 8px',
                    borderRadius: '999px',
                    background: 'var(--rum-tint)',
                    color: 'var(--rum)'
                  }}>
                    Default
                  </span>
                )}
              </div>
            ))}
          </div>

          <button className="btn btn-secondary" style={{ width: '100%', marginTop: '8px' }}>
            <Icon name="plus" size={16} />
            Add Card
          </button>
        </div>

        {/* PASSPORT SECTION */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '12px' }}>Membership</p>

          {!passportOpen ? (
            <div 
              onClick={() => setPassportOpen(true)}
              className="tappable"
              style={{
                minHeight: '200px',
                borderRadius: '14px',
                background: 'linear-gradient(155deg, #9c2812, #6e1a0c 55%, #4d1207)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
                position: 'relative',
                overflow: 'hidden',
                padding: '24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'pointer'
              }}
            >
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.01) 0px, rgba(255,255,255,0.01) 2px, transparent 2px, transparent 4px)',
                pointerEvents: 'none'
              }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  border: '2px solid var(--gold)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  boxShadow: '0 0 20px rgba(255,184,0,0.25)'
                }}>
                  <Icon name="sparkle" size={28} style={{ color: 'var(--gold)' }} />
                </div>
                <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, letterSpacing: '4px', color: 'var(--gold)', textShadow: '0 1px 0 rgba(0,0,0,0.7)', marginBottom: '8px' }}>
                  ETA
                </h3>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '2px', color: 'rgba(255, 184, 0, 0.7)', textTransform: 'uppercase' }}>
                  Gold Member
                </p>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: '10px', fontStyle: 'italic', color: 'rgba(255,255,255,0.4)', marginTop: '16px' }}>
                  Tap to open
                </p>
              </div>
            </div>
          ) : (
            <div style={{
              minHeight: '200px',
              borderRadius: '14px',
              background: 'linear-gradient(160deg, #FEFBF6 0%, #F3ECDD 100%)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              position: 'relative',
              overflow: 'hidden',
              padding: '24px 20px'
            }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.015) 0px, rgba(0,0,0,0.015) 1px, transparent 1px, transparent 3px)',
                pointerEvents: 'none'
              }} />
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                right: '12px',
                bottom: '12px',
                border: '1px solid rgba(184, 32, 16, 0.25)',
                borderRadius: '4px',
                pointerEvents: 'none'
              }} />
              <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 8px',
                  overflow: 'hidden'
                }}>
                  <Icon name="user" size={24} style={{ color: 'var(--grey)' }} />
                </div>
                <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#0F0E0C', marginBottom: '4px' }}>
                  Jordan Hutchinson
                </h3>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '6px', marginBottom: '16px' }}>
                  <span className="num-font" style={{ fontSize: '32px', fontWeight: 700, color: 'var(--rum)' }}>
                    {points.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--grey)' }}>pts</span>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--grey)' }}>
                      {pointsToNext} pts to next reward
                    </span>
                    <span className="num-font" style={{ fontSize: '11px', color: 'var(--grey)' }}>
                      {progressPercent}%
                    </span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <div className="progress-fill" style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--rum)' }} />
                  </div>
                </div>
                <button onClick={() => setPassportOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--grey)', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', minHeight: '44px' }}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* REWARDS SECTION */}
        <div style={{ marginBottom: '24px' }}>
          <div className="section-header">
            <div className="section-heading">
              <span className="section-eyebrow">Redeem</span>
              <span className="section-title">Rewards</span>
            </div>
          </div>
          <div className="horizontal-scroll" style={{ padding: '4px 0 12px' }}>
            {MOCK_REWARDS.map(reward => (
              <div 
                key={reward.id} 
                className="card" 
                style={{ width: '160px', flexShrink: 0, opacity: reward.available ? 1 : 0.5 }}
                onClick={() => handleRedeem(reward.name)}
              >
                <div className="card-image" style={{ height: '100px' }}>
                  <img src={reward.image} alt={reward.name} />
                </div>
                <div className="card-content">
                  <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '4px' }}>{reward.name}</p>
                  <p className="num-font" style={{ fontSize: '13px', color: reward.available ? 'var(--rum)' : 'var(--label-secondary)' }}>
                    {reward.pointsCost} pts
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* POINTS HISTORY */}
        <div>
          <div className="section-header">
            <div className="section-heading">
              <span className="section-eyebrow">Activity</span>
              <span className="section-title">Points History</span>
            </div>
          </div>
          <div className="card" style={{ padding: '4px 16px' }}>
            {MOCK_HISTORY.map((h, i) => (
              <div key={h.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 0',
                borderBottom: i < MOCK_HISTORY.length - 1 ? '0.5px solid var(--separator)' : 'none'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  flexShrink: 0,
                  background: 'var(--system-bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {h.vendorImage ? (
                    <img src={h.vendorImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Icon name="sparkle" size={18} style={{ color: 'var(--label-secondary)' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{h.description}</p>
                  <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{h.date}</p>
                </div>
                <span className="num-font" style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: h.type === 'earned' ? 'var(--rum)' : 'var(--label-secondary)'
                }}>
                  {h.type === 'earned' ? '+' : '-'}{h.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dock />
    </main>
  )
}