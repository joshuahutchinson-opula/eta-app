// components/Dock.tsx
'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Icon from '@/lib/icons'

export default function Dock() {
  const pathname = usePathname()
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      // Show border when content has scrolled underneath
      setScrolled(scrollY > 0 && scrollY + windowHeight < documentHeight - 10)
    }
    
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const tabs = [
    { name: 'Home', href: '/', icon: 'home' },
    { name: 'Experiences', href: '/experiences', icon: 'compass' },
    { name: 'Pay', href: '/pay', icon: 'camera' },
    { name: 'Market', href: '/marketplace', icon: 'marketplace' },
    { name: 'Explore', href: '/explore', icon: 'mapPin' }
  ]

  return (
    <nav className={`tab-bar ${scrolled ? 'scrolled' : ''}`}>
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
            <div className="tab-icon">
              <Icon name={tab.icon} size={24} />
            </div>
            <span className="tab-label">{tab.name}</span>
          </div>
        )
      })}
    </nav>
  )
}