// components/FloatingPill.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { getCurrentUser } from '@/lib/auth-client'
import { useLang } from '@/lib/i18n-client'

export default function FloatingPill() {
  const { t } = useLang()
  const [points, setPoints] = useState(0)

  useEffect(() => {
    const user = getCurrentUser()
    setPoints(user?.points ?? 0)
  }, [])

  return (
    <div className="floating-pill">
      {/* Avatar - tap for profile */}
      <Link href="/profile" className="floating-pill-avatar" aria-label={t('m.tab.profile')} style={{ color: 'inherit' }}>
        <Icon name="user" size={14} />
      </Link>

      {/* Points - tap for the Rewards hub (points, vouchers, discoveries, wallet) */}
      <Link href="/rewards" className="floating-pill-points" aria-label={t('m.hub.open', { n: points.toLocaleString() })} style={{ textDecoration: 'none' }}>
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
