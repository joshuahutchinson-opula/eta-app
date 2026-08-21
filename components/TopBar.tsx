// components/TopBar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Icon from '@/lib/icons'

export default function TopBar() {
  const pathname = usePathname()

  const getTitle = () => {
    switch (pathname) {
      case '/': return 'Home'
      case '/experiences': return 'Experiences'
      case '/marketplace': return 'Marketplace'
      case '/explore': return 'Explore'
      case '/wallet': return 'Wallet'
      case '/profile': return 'Profile'
      default: return 'Home'
    }
  }

  return (
    <header className="nav-bar">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 800,
            fontSize: '24px',
            color: 'var(--black)'
          }}>
            ET<span style={{ color: 'var(--rum)' }}>A</span>
          </span>
          <span className="nav-title">{getTitle()}</span>
        </div>
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
            overflow: 'hidden'
          }}>
            <Icon name="user" size={18} />
          </div>
        </Link>
      </div>
    </header>
  )
}