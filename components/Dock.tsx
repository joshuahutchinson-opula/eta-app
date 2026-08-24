// components/Dock.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Icon from '@/lib/icons'

export default function Dock() {
  const pathname = usePathname()
  const router = useRouter()
  const [darkMode, setDarkMode] = useState(false)
  const [indicatorPosition, setIndicatorPosition] = useState(0)
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const tabs = [
    { name: 'Home', href: '/', icon: 'home', type: 'icon' },
    { name: 'Experiences', href: '/experiences', icon: 'compass', type: 'icon' },
    { name: '', href: '/pay', icon: '', type: 'logo' },
    { name: 'Market', href: '/marketplace', icon: 'marketplace', type: 'icon' },
    { name: 'Profile', href: '/profile', icon: 'user', type: 'icon' }
  ]

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    setDarkMode(savedTheme === 'dark')

    // Listen for theme changes immediately
    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.getAttribute('data-theme')
      setDarkMode(currentTheme === 'dark')
    })

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    // Also listen for storage changes
    const handleStorage = () => {
      const saved = localStorage.getItem('theme')
      setDarkMode(saved === 'dark')
    }
    window.addEventListener('storage', handleStorage)

    return () => {
      observer.disconnect()
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  // Update indicator position when tab changes
  useEffect(() => {
    const activeTab = tabs.find(tab => tab.href === pathname)
    if (activeTab) {
      const activeElement = tabRefs.current.get(activeTab.href)
      if (activeElement) {
        setIndicatorPosition(activeElement.offsetLeft + activeElement.offsetWidth / 2 - 2)
      }
    }
  }, [pathname, tabs])

  return (
    <nav className="tab-bar">
      {/* Sliding accent indicator */}
      <div
        className="tab-indicator"
        style={{ left: `${indicatorPosition}px` }}
      />

      {tabs.map(tab => {
        const isActive = pathname === tab.href
        return (
          <div
            key={tab.href}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.href, el)
              else tabRefs.current.delete(tab.href)
            }}
            className={`tab-item ${isActive ? 'active' : 'inactive'}`}
            onClick={() => router.push(tab.href)}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            {tab.type === 'logo' ? (
              <div className="tab-logo-container">
                <img 
                  src={darkMode ? '/logo-dark.png' : '/logo.png'} 
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