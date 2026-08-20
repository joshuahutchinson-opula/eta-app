'use client'

import Link from 'next/link'
import Icon from '@/lib/icons'

export default function TopBar() {
  return (
    <div className="top-bar">
      <Link href="/" style={{ textDecoration: 'none', color: 'var(--sand)' }}>
        <span style={{ fontSize: '20px', fontWeight: 800, cursor: 'pointer' }}>
          ET<span style={{ color: 'var(--rum)' }}>A</span>
        </span>
      </Link>

      <div className="glass-pill" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '13px', color: 'var(--sand-dim)', cursor: 'pointer' }}>
        <Icon name="mapPin" size={14} />
        Negril
        <Icon name="chevronDown" size={14} />
      </div>

      <Link href="/profile" style={{ textDecoration: 'none' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'var(--gradient-rum)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: 700,
          color: 'var(--sand)',
          cursor: 'pointer',
          border: 'none'
        }}>
          J
        </div>
      </Link>
    </div>
  )
}