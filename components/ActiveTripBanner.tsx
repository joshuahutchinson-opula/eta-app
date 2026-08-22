// components/ActiveTripBanner.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'

interface ActiveTripBannerProps {
  tripName: string
  etaMinutes: number
  nextStopName: string
  onDismiss?: () => void
}

export default function ActiveTripBanner({ 
  tripName, 
  etaMinutes, 
  nextStopName,
  onDismiss 
}: ActiveTripBannerProps) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const [lastEta, setLastEta] = useState(etaMinutes)

  // Reappear when ETA changes significantly (new stop reached)
  useEffect(() => {
    if (Math.abs(etaMinutes - lastEta) >= 5) {
      setDismissed(false)
      setLastEta(etaMinutes)
    }
  }, [etaMinutes, lastEta])

  if (dismissed) return null

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDismissed(true)
    if (onDismiss) onDismiss()
  }

  const handleTap = () => {
    router.push('/experiences')
  }

  return (
    <div className="active-trip-banner" onClick={handleTap}>
      <div className="active-trip-banner-content">
        <span className="active-trip-banner-eta num-font">
          {etaMinutes}m
        </span>
        <div className="active-trip-banner-text">
          <p className="active-trip-banner-title">{tripName}</p>
          <p className="active-trip-banner-sub">
            Next: {nextStopName}
          </p>
        </div>
        <button 
          className="active-trip-banner-dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          <Icon name="close" size={12} />
        </button>
      </div>
    </div>
  )
}