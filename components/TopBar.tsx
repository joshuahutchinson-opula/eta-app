// components/TopBar.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'

export default function TopBar() {
  const router = useRouter()
  const [walletHidden, setWalletHidden] = useState(true)
  const [points] = useState(1240)
  const [balance] = useState(250)

  return (
    <header className="nav-bar">
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        {/* Status Bar - left side */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0',
          flex: 1
        }}>
          {/* Points */}
          <button
            onClick={() => router.push('/rewards')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px 4px 0',
              fontFamily: 'inherit',
              transition: 'opacity 0.2s ease'
            }}
          >
            <Icon name="sparkle" size={16} style={{ color: 'var(--gold)' }} />
            <span style={{ 
              fontSize: '15px', 
              fontWeight: 700, 
              color: 'var(--gold)',
              fontFamily: 'Space Mono, monospace'
            }}>
              {points.toLocaleString()}
            </span>
          </button>

          {/* Divider */}
          <div style={{
            width: '1px',
            height: '20px',
            background: 'var(--light-grey)',
            margin: '0 4px'
          }} />

          {/* Wallet */}
          <button
            onClick={() => setWalletHidden(!walletHidden)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              fontFamily: 'inherit',
              transition: 'opacity 0.2s ease'
            }}
          >
            <Icon name="wallet" size={16} style={{ color: 'var(--grey)' }} />
            <span style={{ 
              fontSize: '15px', 
              fontWeight: 700,
              color: 'var(--black)',
              fontFamily: 'Space Mono, monospace',
              letterSpacing: walletHidden ? '1px' : '0'
            }}>
              {walletHidden ? '••••' : `$${balance}`}
            </span>
          </button>
        </div>

        {/* Profile avatar - right */}
        <Link href="/profile" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'var(--light-grey)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
            border: '2px solid var(--light-grey)',
            transition: 'all 0.2s ease'
          }}>
            <Icon name="user" size={18} />
          </div>
        </Link>
      </div>
    </header>
  )
}