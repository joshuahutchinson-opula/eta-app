'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Icon from '@/lib/icons'

export default function Dock() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)

  const items = [
    { id: 'home', icon: 'home', label: 'Home', href: '/' },
    { id: 'experiences', icon: 'sparkle', label: 'Experiences', href: '/experiences' },
    { id: 'pay', icon: 'camera', label: 'Pay', href: '/pay' },
    { id: 'marketplace', icon: 'marketplace', label: 'Market', href: '/marketplace' },
    { id: 'explore', icon: 'compass', label: 'Explore', href: '/explore' },
  ]

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <div
      className="dock"
      onClick={() => setExpanded(!expanded)}
      style={{ cursor: 'pointer' }}
    >
      {items.map(item => (
        <Link
          key={item.id}
          href={item.href}
          className={`dock-item ${isActive(item.href) ? 'active' : ''}`}
          onClick={(e) => e.stopPropagation()}
          style={{ textDecoration: 'none' }}
        >
          <span style={{ fontSize: '18px', display: 'flex' }}>
            <Icon name={item.icon} size={18} />
          </span>
          {expanded && <span>{item.label}</span>}
        </Link>
      ))}
    </div>
  )
}