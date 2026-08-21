// app/rewards/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/TopBar'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'

interface PointsTransaction {
  id: string
  amount: number
  type: 'earned' | 'spent' | 'redeemed'
  description: string
  date: string
}

interface Redemption {
  id: string
  reward: string
  pointsCost: number
  status: 'pending' | 'completed' | 'cancelled'
  date: string
  icon: string
}

export default function RewardsPage() {
  const router = useRouter()
  const [points, setPoints] = useState(1240)
  const [displayPoints, setDisplayPoints] = useState(0)
  const [history, setHistory] = useState<PointsTransaction[]>([])
  const [outstanding, setOutstanding] = useState<Redemption[]>([])
  const [redemptionHistory, setRedemptionHistory] = useState<Redemption[]>([])
  const [loading, setLoading] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    fetchRewardsData()
  }, [])

  useEffect(() => {
    // Animated counter
    const duration = 1500
    const start = performance.now()
    const from = 0
    const to = points
    
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayPoints(Math.round(from + (to - from) * eased))
      if (progress < 1) requestAnimationFrame(animate)
    }
    
    requestAnimationFrame(animate)
  }, [points])

  const fetchRewardsData = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/transactions?type=points', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      
      if (res.ok) {
        const data = await res.json()
        // Mock data for now
        setPoints(1240)
        setHistory([
          { id: '1', amount: 250, type: 'earned', description: 'Completed Sunset Catamaran experience', date: 'Today, 4:30 PM' },
          { id: '2', amount: 100, type: 'earned', description: 'Checked in at Rick\'s Café', date: 'Today, 3:15 PM' },
          { id: '3', amount: 500, type: 'redeemed', description: 'Redeemed Free Jerk Plate', date: 'Yesterday' },
          { id: '4', amount: 320, type: 'earned', description: 'Completed Water Life Loop', date: 'Yesterday' },
          { id: '5', amount: 50, type: 'earned', description: 'Reviewed Pork Pit', date: '2 days ago' },
          { id: '6', amount: 170, type: 'earned', description: 'Completed Golden Hour Drift', date: '3 days ago' }
        ])
        setOutstanding([
          { id: 'o1', reward: 'Free Sunset Catamaran Ride', pointsCost: 800, status: 'pending', date: 'Requested today', icon: 'activity' },
          { id: 'o2', reward: '2x Points Weekend Pass', pointsCost: 500, status: 'pending', date: 'Requested today', icon: 'sparkle' }
        ])
        setRedemptionHistory([
          { id: 'r1', reward: 'Free Jerk Plate at Pork Pit', pointsCost: 500, status: 'completed', date: 'Yesterday', icon: 'food' },
          { id: 'r2', reward: 'Beach Day Pass', pointsCost: 350, status: 'completed', date: 'Last week', icon: 'sun' },
          { id: 'r3', reward: 'Rum Punch Flight', pointsCost: 250, status: 'completed', date: '2 weeks ago', icon: 'drink' }
        ])
      }
    } catch (error) {
      console.error('Failed to fetch rewards:', error)
    } finally {
      setLoading(false)
    }
  }

  const triggerConfetti = () => {
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 2000)
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--off-white)' }}>
        <TopBar />
        <div style={{ padding: '16px', paddingBottom: '100px' }}>
          <div className="skeleton" style={{ height: '120px', borderRadius: '16px', marginBottom: '16px' }} />
          <div className="skeleton" style={{ height: '40px', borderRadius: '10px', marginBottom: '16px' }} />
          <div className="skeleton" style={{ height: '200px', borderRadius: '12px' }} />
        </div>
        <Dock />
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--off-white)', paddingBottom: '80px', overflowX: 'hidden', position: 'relative' }}>
      <TopBar />

      {/* Confetti overlay */}
      {showConfetti && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, pointerEvents: 'none' }}>
          {[...Array(20)].map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              top: '-10px',
              left: `${Math.random() * 100}%`,
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: ['#FFB800', '#FF4B2B', '#00E5CC', '#9333EA'][i % 4],
              animation: `confettiFall ${1.5 + Math.random()}s ease-in forwards`,
              animationDelay: `${Math.random() * 0.5}s`
            }} />
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes confettiFall {
          to { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes spinSlow {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{ padding: '16px' }}>
        {/* Points Hero Card */}
        <div className="featured-card" style={{ 
          padding: '24px', 
          textAlign: 'center',
          marginBottom: '20px',
          position: 'relative',
          background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF8E7 100%)'
        }}>
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            animation: 'float 3s ease-in-out infinite'
          }}>
            <Icon name="sparkle" size={20} style={{ color: 'var(--gold)' }} />
          </div>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--grey)', marginBottom: '8px' }}>
            Yuh Points
          </div>
          <div style={{ 
            fontSize: '48px', 
            fontWeight: 900, 
            fontFamily: 'Space Mono, monospace',
            color: 'var(--gold)',
            marginBottom: '4px',
            cursor: 'pointer'
          }}
          onClick={triggerConfetti}
          >
            {displayPoints.toLocaleString()}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--grey)' }}>
            Tap the number fi a likkle celebration 🎉
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <div className="card" style={{ flex: 1, padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--sea)', fontFamily: 'Space Mono, monospace' }}>
              {outstanding.length}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--grey)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Outstanding
            </div>
          </div>
          <div className="card" style={{ flex: 1, padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--rum)', fontFamily: 'Space Mono, monospace' }}>
              {redemptionHistory.length}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--grey)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Redeemed
            </div>
          </div>
          <div className="card" style={{ flex: 1, padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--gold)', fontFamily: 'Space Mono, monospace' }}>
              {history.filter(h => h.type === 'earned').reduce((a, h) => a + h.amount, 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--grey)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Earned
            </div>
          </div>
        </div>

        {/* Outstanding Redemptions */}
        {outstanding.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div className="section-header">
              <div className="section-heading-card">
                <div className="section-heading section-heading-animate">
                  <span className="section-eyebrow">Pending</span>
                  <div className="section-title-row">
                    <span className="section-accent-bar" />
                    <span className="section-title">Outstanding</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {outstanding.map(item => (
                <div key={item.id} className="card" style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--light-grey)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={item.icon as any} size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--black)' }}>{item.reward}</p>
                    <p style={{ fontSize: '11px', color: 'var(--grey)' }}>{item.pointsCost} pts • {item.date}</p>
                  </div>
                  <span style={{ 
                    fontSize: '10px', 
                    fontWeight: 700, 
                    padding: '5px 10px', 
                    borderRadius: '100px',
                    background: 'rgba(255,184,0,0.15)',
                    color: 'var(--gold)'
                  }}>
                    PENDING
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Points History */}
        <div style={{ marginBottom: '24px' }}>
          <div className="section-header">
            <div className="section-heading-card">
              <div className="section-heading section-heading-animate">
                <span className="section-eyebrow">Activity</span>
                <div className="section-title-row">
                  <span className="section-accent-bar" />
                  <span className="section-title">Points History</span>
                </div>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px' }}>
            {history.map((h, i) => (
              <div key={h.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                padding: '12px',
                borderBottom: i < history.length - 1 ? '1px solid var(--light-grey)' : 'none'
              }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: h.type === 'earned' ? 'rgba(0,229,204,0.15)' : 'rgba(255,75,43,0.15)',
                  color: h.type === 'earned' ? 'var(--sea)' : 'var(--rum)',
                  flexShrink: 0
                }}>
                  <Icon name={h.type === 'earned' ? 'arrow-up' : h.type === 'spent' ? 'arrow-down' : 'gift'} size={14} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--black)' }}>{h.description}</p>
                  <p style={{ fontSize: '11px', color: 'var(--grey)' }}>{h.date}</p>
                </div>
                <span style={{ 
                  fontSize: '14px', 
                  fontWeight: 800, 
                  fontFamily: 'Space Mono, monospace',
                  color: h.type === 'earned' ? 'var(--sea)' : 'var(--rum)'
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
              <div className="section-heading-card">
                <div className="section-heading section-heading-animate">
                  <span className="section-eyebrow">Previous</span>
                  <div className="section-title-row">
                    <span className="section-accent-bar" />
                    <span className="section-title">Redeemed</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {redemptionHistory.map(item => (
                <div key={item.id} className="card" style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--light-grey)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={item.icon as any} size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--black)' }}>{item.reward}</p>
                    <p style={{ fontSize: '11px', color: 'var(--grey)' }}>{item.pointsCost} pts • {item.date}</p>
                  </div>
                  <span style={{ 
                    fontSize: '10px', 
                    fontWeight: 700, 
                    padding: '5px 10px', 
                    borderRadius: '100px',
                    background: 'rgba(0,229,204,0.15)',
                    color: 'var(--sea)'
                  }}>
                    COMPLETED
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