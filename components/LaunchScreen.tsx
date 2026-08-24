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
      <img 
        src="/logo.png" 
        alt="ETA" 
        style={{ 
          width: '120px', 
          height: 'auto'
        }} 
      />
    </div>
  )
}