// components/SuccessAnimation.tsx
'use client'

import { useEffect, useState } from 'react'
import Icon from '@/lib/icons'

interface SuccessAnimationProps {
  show: boolean
  onComplete?: () => void
  duration?: number
}

export default function SuccessAnimation({ show, onComplete, duration = 1200 }: SuccessAnimationProps) {
  const [visible, setVisible] = useState(show)

  useEffect(() => {
    if (show) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        if (onComplete) onComplete()
      }, duration)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [show, duration, onComplete])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none'
    }}>
      <div className="success-check" style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: 'var(--rum)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
      }}>
        <Icon name="check" size={36} style={{ color: 'white' }} />
      </div>
    </div>
  )
}