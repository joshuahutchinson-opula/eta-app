// components/FloatingPill.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { getCurrentUser } from '@/lib/auth-client'

export default function FloatingPill() {
  const [points, setPoints] = useState(0)

  useEffect(() => {
    const user = getCurrentUser()
    setPoints(user?.points ?? 0)
  }, [])

  return (
    <div className="floating-pill">
      {/* Avatar - tap for profile */}
      <Link href="/profile" className="floating-pill-avatar" aria-label="Profile" style={{ color: 'inherit' }}>
        <Icon name="user" size={14} />
      </Link>

      {/* Points - tap for wallet/rewards */}
      <Link href="/wallet" className="floating-pill-points" aria-label={`${points.toLocaleString()} points — open wallet`} style={{ textDecoration: 'none' }}>
        <Icon name="sparkle" size={12} style={{ color: 'var(--rum)' }} />
        <span className="num-font" style={{
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--label-primary)'
        }}>
          {points.toLocaleString()}
        </span>
      </Link>
    </div>
  )
}
