// components/Dock.tsx
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/lib/icons'

export default function Dock() {
  const pathname = usePathname()

  const tabs = [
    { name: 'Home', href: '/', icon: 'home' },
    { name: 'Experiences', href: '/experiences', icon: 'compass' },
    { name: 'Pay', href: '/pay', icon: 'camera' },
    { name: 'Marketplace', href: '/marketplace', icon: 'marketplace' },
    { name: 'Explore', href: '/explore', icon: 'mapPin' }
  ]

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      padding: '8px 16px',
      paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
      background: 'rgba(15, 14, 12, 0.6)',
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      borderTop: '1px solid rgba(255, 255, 255, 0.08)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        maxWidth: '500px',
        margin: '0 auto',
        height: '52px'
      }}>
        {tabs.map(tab => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.name}
              href={tab.href}
              style={{
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                padding: '6px 12px',
                borderRadius: '12px',
                transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                transform: isActive ? 'scale(1.05)' : 'scale(1)'
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isActive ? 'var(--rum)' : 'transparent',
                color: isActive ? 'var(--sand)' : 'var(--sand-dim)',
                transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }}>
                <Icon name={tab.icon} size={18} />
              </div>
              <span style={{
                fontSize: '9px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--sand)' : 'var(--sand-dim)'
              }}>
                {tab.name}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}