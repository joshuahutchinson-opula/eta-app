// components/Dock.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

export default function Dock() {
  const pathname = usePathname()
  const [pulseDone, setPulseDone] = useState(false)
  const { t } = useLang()

  const tabs = [
    { name: t('m.tab.home'), href: '/', icon: 'home', type: 'icon' },
    { name: t('m.tab.experiences'), href: '/experiences', icon: 'compass', type: 'icon' },
    { name: t('m.tab.pay'), href: '/pay', icon: '', type: 'logo' },
    { name: t('m.tab.market'), href: '/marketplace', icon: 'marketplace', type: 'icon' },
    { name: t('m.tab.profile'), href: '/profile', icon: 'user', type: 'icon' }
  ]

  useEffect(() => {
    const timer = setTimeout(() => setPulseDone(true), 1300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <nav className="tab-bar" aria-label={t('m.tab.nav')}>
      {tabs.map(tab => {
        const isActive = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            onClick={() => triggerHaptic('selection')}
            aria-current={isActive ? 'page' : undefined}
            aria-label={tab.type === 'logo' ? tab.name : undefined}
            className={`tab-item ${isActive ? 'active' : 'inactive'}`}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              textDecoration: 'none',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            {tab.type === 'logo' ? (
              <div className={`tab-logo-container ${!pulseDone ? 'tab-logo-pulse' : ''}`}>
                <img
                  src="/logo-tb.png"
                  alt=""
                  className="tab-logo"
                />
              </div>
            ) : (
              <>
                <div className="tab-icon" aria-hidden>
                  <Icon name={tab.icon} size={24} />
                </div>
                <span className="tab-label">{tab.name}</span>
              </>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
