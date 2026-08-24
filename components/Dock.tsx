// components/Dock.tsx
'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Icon from '@/lib/icons'

export default function Dock() {
  const pathname = usePathname()
  const router = useRouter()
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    setDarkMode(savedTheme === 'dark')
  }, [])

  const tabs = [
    { name: 'Home', href: '/', icon: 'home', type: 'icon' },
    { name: 'Experiences', href: '/experiences', icon: 'compass', type: 'icon' },
    { name: '', href: '/pay', icon: '', type: 'logo' },
    { name: 'Market', href: '/marketplace', icon: 'marketplace', type: 'icon' },
    { name: 'Profile', href: '/profile', icon: 'user', type: 'icon' }
  ]

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
              <img 
                src={darkMode ? '/logo-dark.png' : '/logo.png'} 
                alt="ETA" 
                style={{ width: '32px', height: '32px', objectFit: 'contain' }}
              />
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