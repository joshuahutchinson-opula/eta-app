// components/Dock.tsx
'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'

export default function Dock() {
  const pathname = usePathname()
  const router = useRouter()
  const [pulseDone, setPulseDone] = useState(false)
  const { t } = useLang()

  const tabs = [
    { name: t('m.tab.home'), href: '/', icon: 'home', type: 'icon' },
    { name: t('m.tab.experiences'), href: '/experiences', icon: 'compass', type: 'icon' },
    { name: '', href: '/pay', icon: '', type: 'logo' },
    { name: t('m.tab.market'), href: '/marketplace', icon: 'marketplace', type: 'icon' },
    { name: t('m.tab.profile'), href: '/profile', icon: 'user', type: 'icon' }
  ]

  useEffect(() => {
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
                  src="/logo-tb.png" 
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