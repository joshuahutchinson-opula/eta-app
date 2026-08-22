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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        {/* Points + Wallet merged */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          {/* Points pill */}
          <button
            onClick={() => router.push('/rewards')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '100px',
              background: 'var(--off-white)',
              border: '1px solid var(--light-grey)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease'
            }}
          >
            <Icon name="sparkle" size={14} style={{ color: 'var(--gold)' }} />
            <span style={{ 
              fontSize: '14px', 
              fontWeight: 800, 
              color: 'var(--gold)',
              fontFamily: 'Space Mono, monospace'
            }}>
              {points.toLocaleString()}
            </span>
          </button>

          {/* Wallet pill */}
          <button
            onClick={() => setWalletHidden(!walletHidden)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '100px',
              background: 'var(--off-white)',
              border: '1px solid var(--light-grey)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease'
            }}
          >
            <Icon name="wallet" size={14} style={{ color: 'var(--grey)' }} />
            <span style={{ 
              fontSize: '14px', 
              fontWeight: 800,
              color: 'var(--black)',
              fontFamily: 'Space Mono, monospace',
              letterSpacing: walletHidden ? '1px' : '0'
            }}>
              {walletHidden ? '••••' : `$${balance}`}
            </span>
          </button>
        </div>

        {/* Profile avatar */}
        <Link href="/profile" style={{ textDecoration: 'none' }}>
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