// components/FloatingPill.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { getCurrentUser } from '@/lib/auth-client'

export default function FloatingPill() {
  const router = useRouter()
  const [points, setPoints] = useState(0)

  useEffect(() => {
    const user = getCurrentUser()
    setPoints(user?.points ?? 0)
  }, [])

  return (
    <div className="floating-pill">
      {/* Avatar - tap for profile */}
      <div 
        className="floating-pill-avatar"
        onClick={() => router.push('/profile')}
        role="button"
        aria-label="Profile"
      >
        <Icon name="user" size={14} />
      </div>

      {/* Points - tap for wallet/rewards */}
      <div 
        className="floating-pill-points"
        onClick={() => router.push('/wallet')}
        role="button"
        aria-label="Points"
      >
        <Icon name="sparkle" size={12} style={{ color: 'var(--rum)' }} />
        <span className="num-font" style={{ 
          fontSize: '13px', 
          fontWeight: 700, 
          color: 'var(--label-primary)'
        }}>
          {points.toLocaleString()}
        </span>
      </div>
    </div>
  )
}