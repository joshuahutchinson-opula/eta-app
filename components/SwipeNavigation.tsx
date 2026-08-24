// components/SwipeNavigation.tsx
'use client'

import { useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const TABS = ['/', '/experiences', '/pay', '/marketplace', '/profile']

export default function SwipeNavigation({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const touchStartX = useRef<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) {
      const currentIndex = TABS.indexOf(pathname)
      if (currentIndex === -1) return
      if (dx < 0 && currentIndex < TABS.length - 1) {
        router.push(TABS[currentIndex + 1])
      } else if (dx > 0 && currentIndex > 0) {
        router.push(TABS[currentIndex - 1])
      }
    }
    touchStartX.current = null
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ minHeight: '100dvh' }}
    >
      {children}
    </div>
  )
}