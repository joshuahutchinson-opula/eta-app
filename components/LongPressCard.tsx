// components/LongPressCard.tsx
'use client'

import { useState, useRef, useEffect } from 'react'

interface LongPressCardProps {
  children: React.ReactNode
  preview: React.ReactNode
  onPress?: () => void
  duration?: number
}

export default function LongPressCard({ children, preview, onPress, duration = 450 }: LongPressCardProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const startLongPress = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    longPressTimer.current = setTimeout(() => {
      setPosition({ x: clientX, y: clientY })
      setShowPreview(true)
    }, duration)
  }

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    setShowPreview(false)
  }

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
      }
    }
  }, [])

  return (
    <div
      ref={cardRef}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
      onClick={onPress}
      style={{ position: 'relative' }}
    >
      {children}

      {showPreview && (
        <div
          className="peek-preview"
          style={{
            top: position.y + 10,
            left: position.x - 100,
            width: '200px'
          }}
        >
          {preview}
        </div>
      )}
    </div>
  )
}