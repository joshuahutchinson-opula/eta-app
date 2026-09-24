// app/not-found.tsx
'use client'

import Link from 'next/link'
import Icon from '@/lib/icons'
import { usePatois } from '@/lib/i18n-client'

export default function NotFound() {
  const patois = usePatois()
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className="empty-state">
        <Icon name="compass" size={40} style={{ color: 'var(--label-tertiary)' }} />
        <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)' }}>{patois.emptySearch}</p>
        <p>Dis page nuh deh yah. Lickle lost, dat's all.</p>
        <Link href="/" className="btn btn-primary" style={{ marginTop: '8px', textDecoration: 'none' }}>
          {patois.ctaPrimary} to Home
        </Link>
      </div>
    </main>
  )
}
