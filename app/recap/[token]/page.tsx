// app/recap/[token]/page.tsx — a shared trip recap (read-only, no login).
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import ErrorState from '@/components/ErrorState'
import RecapView from '@/components/RecapView'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import type { TripRecapData } from '@/lib/trip-recap'

export default function SharedRecapPage() {
  const { token } = useParams() as { token: string }
  const { t } = useLang()
  const [recap, setRecap] = useState<TripRecapData | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'gone'>('loading')

  const load = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch(`/api/trip-recap/${encodeURIComponent(token)}`)
      if (res.status === 404) { setState('gone'); return }
      if (!res.ok) throw new Error('recap')
      setRecap(await res.json())
      setState('ready')
    } catch {
      setState('error')
    }
  }, [token])

  useEffect(() => { load() }, [load])

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', padding: '24px 16px 40px' }}>
      {state === 'gone' ? (
        <div className="empty-state"><Icon name="route" size={32} style={{ color: 'var(--label-tertiary)' }} /><p>{t('m.err.notFound')}</p></div>
      ) : state === 'error' ? <ErrorState onRetry={load} /> : !recap ? (
        <div className="skeleton-card" style={{ height: '320px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
      ) : (
        <>
          <RecapView recap={recap} linkPlaces={false} />
          <Link href="/" className="btn btn-primary" style={{ width: '100%', textDecoration: 'none' }}>{t('m.recap.planYours')}</Link>
        </>
      )}
    </main>
  )
}
