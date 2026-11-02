// app/notifications/page.tsx — the alert inbox: past live and flash-deal
// alerts, unread ones marked, each opening what it was about.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import ErrorState from '@/components/ErrorState'
import { authHeaders } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { useLang } from '@/lib/i18n-client'
import BackButton from '@/components/BackButton'

interface Item { id: string; title: string; body: string | null; url: string | null; readAt: string | null; createdAt: string }

function ago(iso: string, lang: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000)
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  if (mins < 60) return rtf.format(-mins, 'minute')
  if (mins < 1440) return rtf.format(-Math.round(mins / 60), 'hour')
  return rtf.format(-Math.round(mins / 1440), 'day')
}

export default function NotificationsPage() {
  const router = useRouter()
  const { t, lang } = useLang()
  const [items, setItems] = useState<Item[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const res = await fetch('/api/notifications', { headers: authHeaders() })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setItems(data.items ?? [])
      // Opening the inbox reads everything in it.
      if (data.unread > 0) fetch('/api/notifications', { method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }), body: '{}' }).catch(() => {})
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    const ok = Boolean(getCurrentUser())
    setSignedIn(ok)
    if (ok) load()
  }, [load])

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <BackButton />
        <h1 className="section-title" style={{ flex: 1 }}>{t('m.inbox.title')}</h1>
        <Link href="/profile?settings=1" className="section-link">{t('m.inbox.settings')}</Link>
      </div>
      <div style={{ padding: '0 16px' }}>
        {signedIn === false ? (
          <div className="empty-state">
            <Icon name="bell" size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.inbox.login')}</p>
            <Link href="/login" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('m.profile.login')}</Link>
          </div>
        ) : failed ? <ErrorState onRetry={load} /> : items === null ? (
          [0, 1, 2].map(i => <div key={i} className="skeleton-card" style={{ height: '72px', marginBottom: '8px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>)
        ) : items.length === 0 ? (
          <div className="empty-state">
            <Icon name="bell" size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.inbox.empty')}</p>
            <p>{t('m.inbox.emptyBody')}</p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {items.map(n => {
              const inner = (
                <>
                  <span aria-hidden style={{ width: '8px', height: '8px', borderRadius: '50%', background: n.readAt ? 'transparent' : 'var(--rum)', flexShrink: 0, marginTop: '7px' }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '15px', fontWeight: n.readAt ? 500 : 700, color: 'var(--label-primary)' }}>{n.title}</span>
                    {n.body && <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)', marginTop: '2px' }}>{n.body}</span>}
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--label-secondary)', marginTop: '4px' }}>{ago(n.createdAt, lang)}{n.readAt ? '' : ` · ${t('m.inbox.new')}`}</span>
                  </span>
                </>
              )
              const style: React.CSSProperties = { display: 'flex', gap: '10px', padding: '12px', marginBottom: '8px', textDecoration: 'none', cursor: n.url ? 'pointer' : 'default' }
              return (
                <li key={n.id}>
                  {n.url ? <Link href={n.url} className="card" style={style}>{inner}</Link> : <div className="card" style={style}>{inner}</div>}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <Dock />
    </main>
  )
}
