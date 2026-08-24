// components/BrandedRefresh.tsx
'use client'

import { useState, useEffect } from 'react'
import Icon from '@/lib/icons'

interface BrandedRefreshProps {
  refreshing: boolean
  onRefresh: () => Promise<void> | void
}

export default function BrandedRefresh({ refreshing, onRefresh }: BrandedRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [startY, setStartY] = useState<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === null) return
    const currentY = e.touches[0].clientY
    const distance = currentY - startY
    if (distance > 0 && window.scrollY === 0) {
      setPullDistance(Math.min(distance * 0.5, 80))
    }
  }

  const handleTouchEnd = () => {
    if (pullDistance > 50 && !refreshing) {
      onRefresh()
    }
    setPullDistance(0)
    setStartY(null)
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 0 && (
        <div className="branded-refresh" style={{ height: pullDistance }}>
          <Icon name="sparkle" size={20} style={{ color: 'var(--rum)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>
            {pullDistance > 50 ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      )}
      {refreshing && (
        <div className="branded-refresh">
          <div className="branded-refresh-spinner" />
          <span>Refreshing...</span>
        </div>
      )}
    </div>
  )
}