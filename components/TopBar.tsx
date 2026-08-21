// components/TopBar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Icon from '@/lib/icons'

export default function TopBar() {
  const pathname = usePathname()

  return (
    <header className="nav-bar">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 800,
            fontSize: '24px',
            color: 'var(--black)'
          }}>
            ET<span style={{ color: 'var(--rum)' }}>A</span>
          </span>
        </Link>
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