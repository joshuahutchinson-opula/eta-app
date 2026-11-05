// app/v/[token]/page.tsx — where a vendor's QR card lands when scanned with
// the phone camera: logs the visit (after login, if needed) and shows the
// points, like the in-app scanner does.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Icon from '@/lib/icons'
import BackButton from '@/components/BackButton'
import { getCurrentUser } from '@/lib/auth-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { LocationError, submitVisit, type VisitResult } from '@/lib/visit-client'

export default function VendorQrLanding() {
  const { token } = useParams() as { token: string }
  const { t } = useLang()
  const errorText = useErrorText()
  const [state, setState] = useState<{ kind: 'login' } | { kind: 'checking' } | { kind: 'done'; result: VisitResult } | { kind: 'error'; message: string }>({ kind: 'checking' })

  const run = useCallback(async () => {
    if (!getCurrentUser()) { setState({ kind: 'login' }); return }
    setState({ kind: 'checking' })
    try {
      setState({ kind: 'done', result: await submitVisit(token) })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof LocationError ? t('m.scan.needLocation') : errorText(e) })
    }
  }, [token, t, errorText])

  useEffect(() => { run() }, [run])

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', padding: '16px' }}>
      <BackButton fallback="/" />
      <div className="empty-state" style={{ minHeight: '70vh', justifyContent: 'center' }}>
        {state.kind === 'login' ? (
          <>
            <Icon name="qr" size={36} style={{ color: 'var(--rum-text)' }} />
            <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--label-primary)' }}>{t('m.scan.title')}</p>
            <p>{t('m.checkin.login')}</p>
            <Link href={`/login?next=${encodeURIComponent(`/v/${token}`)}`} className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('m.profile.login')}</Link>
          </>
        ) : state.kind === 'checking' ? (
          <>
            <Icon name="mapPin" size={36} style={{ color: 'var(--rum-text)' }} />
            <p>{t('m.scan.checking')}</p>
          </>
        ) : state.kind === 'done' ? (
          <>
            <div className="check-pop-in" style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={30} /></div>
            <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)' }}>{state.result.vendor.name}</p>
            <p className="num-font" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--success)' }}>
              {state.result.firstDiscovery ? t('m.checkin.firstTime', { points: state.result.pointsAwarded }) : t('m.checkin.done', { points: state.result.pointsAwarded })}
            </p>
            {state.result.unlockedRewards.length > 0 && <p>{t('m.scan.unlocked')}: <strong>{state.result.unlockedRewards.map(r => r.name).join(', ')}</strong></p>}
            <div style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '360px' }}>
              <Link href={`/vendor/${state.result.vendor.id}`} className="btn btn-secondary" style={{ flex: 1, textDecoration: 'none' }}>{t('m.story.goHere')}</Link>
              <Link href="/rewards" className="btn btn-primary" style={{ flex: 1, textDecoration: 'none' }}>{t('m.profile.rewards')}</Link>
            </div>
          </>
        ) : (
          <>
            <Icon name="mapPin" size={36} style={{ color: 'var(--label-tertiary)' }} />
            <p role="alert" style={{ color: 'var(--error)', fontSize: '15px' }}>{state.message}</p>
            <button className="btn btn-primary" onClick={run}>{t('m.scan.again')}</button>
          </>
        )}
      </div>
    </main>
  )
}
