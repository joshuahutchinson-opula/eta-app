// components/StatusModule.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'

interface StatusModuleProps {
  userId?: string
}

export default function StatusModule({ userId }: StatusModuleProps) {
  const router = useRouter()
  const [walletHidden, setWalletHidden] = useState(true)
  const [points, setPoints] = useState(1240)
  const [balance, setBalance] = useState(250)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (userId) {
      fetchUserStatus()
    }
  }, [userId])

  const fetchUserStatus = async () => {
    setLoading(true)
    try {
      const [pointsRes, walletRes] = await Promise.all([
        fetch(`/api/transactions?userId=${userId}&type=points`),
        fetch(`/api/transactions?userId=${userId}&type=wallet`)
      ])
      
      if (pointsRes.ok) {
        const pointsData = await pointsRes.json()
        if (pointsData.total) setPoints(pointsData.total)
      }
      
      if (walletRes.ok) {
        const walletData = await walletRes.json()
        if (walletData.balance) setBalance(walletData.balance)
      }
    } catch (error) {
      console.error('Failed to fetch user status:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ 
      padding: '16px',
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'relative',
      cursor: 'pointer'
    }}>
      {/* Points Section - clickable to rewards */}
      <div 
        style={{ 
          flex: 1, 
          textAlign: 'center',
          cursor: 'pointer',
          padding: '8px',
          borderRadius: '8px',
          transition: 'background 0.2s ease'
        }}
        onClick={() => router.push('/rewards')}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--light-grey)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ 
          fontSize: '18px', 
          fontWeight: 800, 
          color: 'var(--gold)',
          fontFamily: 'Space Mono, monospace'
        }}>
          {loading ? '...' : points.toLocaleString()}
        </div>
        <div style={{ 
          fontSize: '10px', 
          color: 'var(--grey)', 
          marginTop: '2px',
          fontWeight: 600,
          letterSpacing: '0.5px',
          textTransform: 'uppercase'
        }}>
          Points
        </div>
      </div>

      {/* Divider */}
      <div style={{
        width: '1px',
        height: '32px',
        background: 'var(--light-grey)'
      }} />

      {/* Wallet Section */}
      <div style={{ 
        flex: 1, 
        textAlign: 'center',
        cursor: 'pointer',
        padding: '8px',
        borderRadius: '8px',
        transition: 'background 0.2s ease'
      }}
      onClick={() => setWalletHidden(!walletHidden)}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--light-grey)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{
          fontSize: '18px',
          fontWeight: 800,
          letterSpacing: walletHidden ? '2px' : '0',
          opacity: walletHidden ? 0.5 : 1,
          fontFamily: 'Space Mono, monospace',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px'
        }}>
          {loading ? '...' : walletHidden ? '••••' : `$${balance.toFixed(2)}`}
          <Icon name="eye" size={12} style={{ opacity: 0.5 }} />
        </div>
        <div style={{ 
          fontSize: '10px', 
          color: 'var(--grey)', 
          marginTop: '2px',
          fontWeight: 600,
          letterSpacing: '0.5px',
          textTransform: 'uppercase'
        }}>
          Wallet
        </div>
      </div>
    </div>
  )
}