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
  type: 'earned' | 'spent'
  description: string
  date: string
}

interface Redemption {
  id: string
  reward: string
  pointsCost: number
  status: 'pending' | 'completed'
  date: string
}

export default function RewardsPage() {
  const router = useRouter()
  const [points, setPoints] = useState(1240)
  const [history, setHistory] = useState<PointsTransaction[]>([])
  const [outstanding, setOutstanding] = useState<Redemption[]>([])
  const [redemptionHistory, setRedemptionHistory] = useState<Redemption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRewardsData()
  }, [])

  const fetchRewardsData = async () => {
    try {
      // Mock data for now — will connect to /api/transactions
      setPoints(1240)
      setHistory([
        { id: '1', amount: 250, type: 'earned', description: 'Completed Sunset Catamaran experience', date: 'Today, 4:30 PM' },
        { id: '2', amount: 100, type: 'earned', description: 'Checked in at Rick\'s Café', date: 'Today, 3:15 PM' },
        { id: '3', amount: 500, type: 'spent', description: 'Redeemed Free Jerk Plate', date: 'Yesterday' },
        { id: '4', amount: 320, type: 'earned', description: 'Completed Water Life Loop', date: 'Yesterday' },
        { id: '5', amount: 50, type: 'earned', description: 'Reviewed Pork Pit', date: '2 days ago' },
        { id: '6', amount: 170, type: 'earned', description: 'Completed Golden Hour Drift', date: '3 days ago' }
      ])
      setOutstanding([
        { id: 'o1', reward: 'Free Sunset Catamaran Ride', pointsCost: 800, status: 'pending', date: 'Requested today' },
        { id: 'o2', reward: '2x Points Weekend Pass', pointsCost: 500, status: 'pending', date: 'Requested today' }
      ])
      setRedemptionHistory([
        { id: 'r1', reward: 'Free Jerk Plate at Pork Pit', pointsCost: 500, status: 'completed', date: 'Yesterday' },
        { id: 'r2', reward: 'Beach Day Pass', pointsCost: 350, status: 'completed', date: 'Last week' },
        { id: 'r3', reward: 'Rum Punch Flight', pointsCost: 250, status: 'completed', date: '2 weeks ago' }
      ])
    } catch (error) {
      console.error('Failed to fetch rewards:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--off-white)' }}>
        <TopBar />
        <div style={{ padding: '16px', paddingBottom: '100px' }}>
          <div className="skeleton" style={{ height: '120px', borderRadius: '12px', marginBottom: '24px' }} />
          <div className="skeleton" style={{ height: '40px', borderRadius: '8px', marginBottom: '24px' }} />
          <div className="skeleton" style={{ height: '200px', borderRadius: '12px' }} />
        </div>
        <Dock />
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--off-white)', paddingBottom: '80px', overflowX: 'hidden' }}>
      <TopBar />

      <div style={{ padding: '16px' }}>
        {/* Points Summary */}
        <div className="card" style={{ 
          padding: '24px', 
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--grey)', marginBottom: '8px' }}>
            Your Points
          </p>
          <p style={{ 
            fontSize: '40px', 
            fontWeight: 700, 
            fontFamily: 'Space Mono, monospace',
            color: 'var(--rum)',
            marginBottom: '4px'
          }}>
            {points.toLocaleString()}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--grey)' }}>
            {outstanding.length} outstanding • {redemptionHistory.length} redeemed
          </p>
        </div>

        {/* Outstanding */}
        {outstanding.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div className="section-header">
              <div className="section-heading">
                <span className="section-eyebrow">Pending</span>
                <span className="section-title">Outstanding</span>
              </div>
            </div>
            <div className="section-content-card">
              {outstanding.map(item => (
                <div key={item.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '12px 0',
                  borderBottom: item.id !== outstanding[outstanding.length - 1].id ? '1px solid var(--light-grey)' : 'none'
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--black)' }}>{item.reward}</p>
                    <p style={{ fontSize: '11px', color: 'var(--grey)' }}>{item.pointsCost} pts • {item.date}</p>
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

        {/* Points History */}
        <div style={{ marginBottom: '32px' }}>
          <div className="section-header">
            <div className="section-heading">
              <span className="section-eyebrow">Activity</span>
              <span className="section-title">Points History</span>
            </div>
          </div>
          <div className="section-content-card">
            {history.map((h, i) => (
              <div key={h.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                padding: '12px 0',
                borderBottom: i < history.length - 1 ? '1px solid var(--light-grey)' : 'none'
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--black)' }}>{h.description}</p>
                  <p style={{ fontSize: '11px', color: 'var(--grey)' }}>{h.date}</p>
                </div>
                <span style={{ 
                  fontSize: '13px', 
                  fontWeight: 700, 
                  fontFamily: 'Space Mono, monospace',
                  color: h.type === 'earned' ? 'var(--black)' : 'var(--grey)'
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
                <span className="section-eyebrow">Previous</span>
                <span className="section-title">Redeemed</span>
              </div>
            </div>
            <div className="section-content-card">
              {redemptionHistory.map(item => (
                <div key={item.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '12px 0',
                  borderBottom: item.id !== redemptionHistory[redemptionHistory.length - 1].id ? '1px solid var(--light-grey)' : 'none'
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--black)' }}>{item.reward}</p>
                    <p style={{ fontSize: '11px', color: 'var(--grey)' }}>{item.pointsCost} pts • {item.date}</p>
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