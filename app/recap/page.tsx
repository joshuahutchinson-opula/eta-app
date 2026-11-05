// app/recap/page.tsx — your trip recap (trip mode): everywhere you went
// between your travel dates, with a Share button that makes a public link.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import ErrorState from '@/components/ErrorState'
import RecapView from '@/components/RecapView'
import Icon from '@/lib/icons'
import { apiJson } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { useTripMode } from '@/lib/trip-mode'
import { shareOrCopy } from '@/lib/share'
import { ApiError } from '@/lib/errors'
import type { TripRecapData } from '@/lib/trip-recap'

export default function MyRecapPage() {
  const { t } = useLang()
  const errorText = useErrorText()
  const { trip } = useTripMode()
  const [recap, setRecap] = useState<TripRecapData | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'login' | 'noTrip'>('loading')
  const [shareMsg, setShareMsg] = useState<string | null>(null)

  const query = trip.start && trip.end ? `?start=${trip.start}&end=${trip.end}` : ''

  const load = useCallback(async () => {
    if (!getCurrentUser()) { setState('login'); return }
    setState('loading')
    try {
      setRecap(await apiJson<TripRecapData>(`/api/trip-recap${query}`))
      setState('ready')
    } catch (e) {
      setState(e instanceof ApiError && e.code === 'NO_TRIP' ? 'noTrip' : 'error')
    }
  }, [query])

  useEffect(() => { load() }, [load])

  const share = async () => {
    setShareMsg(null)
    try {
      const { url } = await apiJson<{ url: string }>(`/api/trip-recap${query}`, { method: 'POST' })
      const result = await shareOrCopy({ title: t('m.recap.shareTitle'), text: t('m.recap.shareText', { n: recap?.counts.places ?? 0 }), url })
      if (result === 'copied') setShareMsg(t('m.events.linkCopied'))
    } catch (e) {
      setShareMsg(errorText(e))
    }
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', padding: '16px', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <BackButton fallback="/" />
        {state === 'ready' && (
          <button className="btn btn-primary" onClick={share} style={{ minHeight: '40px', padding: '0 16px' }}><Icon name="share" size={16} /> {shareMsg ?? t('m.events.share')}</button>
        )}
      </div>
      {state === 'login' ? (
        <div className="empty-state">
          <Icon name="route" size={32} style={{ color: 'var(--label-tertiary)' }} />
          <p>{t('m.recap.login')}</p>
          <Link href="/login?next=/recap" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('m.profile.login')}</Link>
        </div>
      ) : state === 'noTrip' ? (
        <div className="empty-state">
          <Icon name="calendar" size={32} style={{ color: 'var(--label-tertiary)' }} />
          <p>{t('m.recap.noTrip')}</p>
          <Link href="/onboarding?step=dates" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('m.recap.addDates')}</Link>
        </div>
      ) : state === 'error' ? <ErrorState onRetry={load} /> : !recap ? (
        <div className="skeleton-card" style={{ height: '320px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
      ) : (
        <RecapView recap={recap} />
      )}
    </main>
  )
}
