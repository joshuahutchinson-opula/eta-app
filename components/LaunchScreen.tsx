// components/LaunchScreen.tsx
'use client'

import { useEffect, useState } from 'react'

export default function LaunchScreen() {
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFading(true)
    }, 1800)

    const hideTimer = setTimeout(() => {
      setVisible(false)
    }, 2200)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  if (!visible) return null

  return (
    <div 
      className="launch-screen"
      style={{
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.4s ease-in-out'
      }}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div className="launch-logo">
          ET<span>A</span>
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--grey)',
          fontWeight: 500,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          animation: 'pulse 1.5s ease-in-out infinite'
        }}>
          Experience Travel Adventure
        </div>
      </div>
    </div>
  )
}