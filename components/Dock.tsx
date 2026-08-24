// components/Dock.tsx
'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Icon from '@/lib/icons'

export default function Dock() {
  const pathname = usePathname()
  const router = useRouter()
  const [pulseDone, setPulseDone] = useState(false)

  const tabs = [
    { name: 'Home', href: '/', icon: 'home', type: 'icon' },
    { name: 'Experiences', href: '/experiences', icon: 'compass', type: 'icon' },
    { name: '', href: '/pay', icon: '', type: 'logo' },
    { name: 'Market', href: '/marketplace', icon: 'marketplace', type: 'icon' },
    { name: 'Profile', href: '/profile', icon: 'user', type: 'icon' }
  ]

  useEffect(() => {
    // One-time pulse on first load
    const timer = setTimeout(() => setPulseDone(true), 1300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <nav className="tab-bar">
      {tabs.map(tab => {
        const isActive = pathname === tab.href
        return (
          <div
            key={tab.href}
            className={`tab-item ${isActive ? 'active' : 'inactive'}`}
            onClick={() => router.push(tab.href)}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            {tab.type === 'logo' ? (
              <div className={`tab-logo-container ${!pulseDone ? 'tab-logo-pulse' : ''}`}>
                <img 
                  src="/logo-dark.png" 
                  alt="ETA" 
                  className="tab-logo"
                />
              </div>
            ) : (
              <>
                <div className="tab-icon">
                  <Icon name={tab.icon} size={24} />
                </div>
                <span className="tab-label">{tab.name}</span>
              </>
            )}
          </div>
        )
      })}
    </nav>
  )
}