// components/Dock.tsx
'use client'

import { usePathname, useRouter } from 'next/navigation'
import Icon from '@/lib/icons'

export default function Dock() {
  const pathname = usePathname()
  const router = useRouter()

  const tabs = [
    { name: 'Home', href: '/', icon: 'home' },
    { name: 'Explore', href: '/explore', icon: 'compass' },
    { name: 'Pay', href: '/pay', icon: 'camera' },
    { name: 'Market', href: '/marketplace', icon: 'marketplace' },
    { name: 'Profile', href: '/profile', icon: 'user' }
  ]

  return (
    <nav className="tab-bar">
      {tabs.map(tab => {
        const isActive = pathname === tab.href
        return (
          <div
            key={tab.name}
            className={`tab-item ${isActive ? 'active' : 'inactive'}`}
            onClick={() => router.push(tab.href)}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            <div 
              className="tab-icon"
              style={{
                transition: 'transform 0.2s ease',
                transform: isActive ? 'scale(1.1)' : 'scale(1)'
              }}
            >
              <Icon name={tab.icon} size={24} />
            </div>
            <span className="tab-label">{tab.name}</span>
          </div>
        )
      })}
    </nav>
  )
}