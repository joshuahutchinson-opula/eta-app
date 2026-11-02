// app/verify-email/page.tsx — where the link in the verification email lands.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { getCurrentUser, setCurrentUser } from '@/lib/auth-client'
import { responseError } from '@/lib/errors'

export default function VerifyEmailPage() {
  const { t } = useLang()
  const errorText = useErrorText()
  const [state, setState] = useState<'checking' | 'done' | 'failed'>('checking')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) { setState('failed'); return }
    fetch('/api/auth/verify-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(async res => {
        if (!res.ok) throw await responseError(res)
        const data = await res.json()
        // Update this device's copy when it's the same account.
        const me = getCurrentUser()
        if (me && data.user?.id === me.id) setCurrentUser(data.user)
        setState('done')
      })
      .catch(e => { setError(errorText(e)); setState('failed') })
  }, [errorText])

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="empty-state" role="status" style={{ maxWidth: '360px' }}>
        <Icon name={state === 'done' ? 'check' : state === 'failed' ? 'close' : 'clock'} size={32} style={{ color: state === 'done' ? 'var(--success)' : state === 'failed' ? 'var(--error)' : 'var(--label-tertiary)' }} />
        <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>
          {state === 'checking' ? t('m.verify.checking') : state === 'done' ? t('m.verify.done') : t('m.verify.failed')}
        </p>
        {error && <p>{error}</p>}
        {state !== 'checking' && (
          <Link href={state === 'done' ? '/' : '/profile'} className="btn btn-primary" style={{ textDecoration: 'none', marginTop: '8px' }}>
            {state === 'done' ? t('m.verify.continue') : t('m.verify.resend')}
          </Link>
        )}
      </div>
    </main>
  )
}
