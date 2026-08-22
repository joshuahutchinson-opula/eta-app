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
        {/* Status Bar */}
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
              fontFamily: 'inherit'
            }}
          >
            <Icon name="sparkle" size={14} style={{ color: 'var(--rum)' }} />
            <span style={{ 
              fontSize: '14px', 
              fontWeight: 700, 
              color: 'var(--black)',
              fontFamily: 'Space Mono, monospace'
            }}>
              {points.toLocaleString()}
            </span>
          </button>

          {/* Divider */}
          <div style={{
            width: '1px',
            height: '16px',
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
              fontFamily: 'inherit'
            }}
          >
            <Icon name="wallet" size={14} style={{ color: 'var(--grey)' }} />
            <span style={{ 
              fontSize: '14px', 
              fontWeight: 700,
              color: 'var(--black)',
              fontFamily: 'Space Mono, monospace',
              letterSpacing: walletHidden ? '1px' : '0'
            }}>
              {walletHidden ? '••••' : `$${balance}`}
            </span>
          </button>
        </div>

        {/* Profile avatar */}
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
            overflow: 'hidden'
          }}>
            <Icon name="user" size={16} />
          </div>
        </Link>
      </div>
    </header>
  )
}