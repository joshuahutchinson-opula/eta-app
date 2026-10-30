// components/NotificationBell.tsx — the bell on Home: opens the alert inbox
// and shows how many alerts are unread.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { authHeaders } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { useLang } from '@/lib/i18n-client'

export default function NotificationBell() {
  const { t } = useLang()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!getCurrentUser()) return
    fetch('/api/notifications', { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (typeof d?.unread === 'number') setUnread(d.unread) })
      .catch(() => {})
  }, [])

  return (
    <Link href="/notifications" aria-label={unread ? t('m.inbox.bellUnread', { n: unread }) : t('m.inbox.title')} className="heart-btn" style={{ position: 'relative', background: 'var(--system-bg-elevated)', boxShadow: 'var(--shadow-card)', color: 'var(--label-primary)' }}>
      <Icon name="bell" size={18} />
      {unread > 0 && (
        <span className="num-font" aria-hidden style={{ position: 'absolute', top: '4px', right: '4px', minWidth: '18px', height: '18px', padding: '0 4px', borderRadius: '9px', background: 'var(--rum)', color: 'white', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--system-bg)' }}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
