// components/LaunchScreen.tsx
'use client'

import { useEffect, useState } from 'react'

export default function LaunchScreen() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div className="launch-screen">
      <div className="launch-logo">
        ET<span>A</span>
      </div>
    </div>
  )
}