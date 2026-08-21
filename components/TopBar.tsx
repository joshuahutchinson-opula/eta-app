// components/TopBar.tsx
'use client'

import Link from 'next/link'
import Icon from '@/lib/icons'

export default function TopBar() {
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '4px 16px',
      background: 'rgba(15, 14, 12, 0.4)',
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '48px'
    }}>
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 800,
          fontSize: '24px',
          color: 'var(--sand)'
        }}>
          ET<span style={{ color: 'var(--rum)' }}>A</span>
        </span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          fontSize: '12px',
          color: 'var(--sand-dim)',
          fontWeight: 600
        }}>
          Negril
        </span>
        <Link href="/profile" style={{ textDecoration: 'none' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
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