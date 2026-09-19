// app/not-found.tsx
'use client'

import Link from 'next/link'
import Icon from '@/lib/icons'
import { patois } from '@/lib/patois'

export default function NotFound() {
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
