// components/VerifyEmailBanner.tsx — a nudge for signed-in users who haven't
// confirmed their email yet (they can browse, but not book, review or post).
'use client'

import { useEffect, useState } from 'react'
import Icon from '@/lib/icons'
import { AUTH_EVENT, getCurrentUser, isVerified, type CurrentUser } from '@/lib/auth-client'
import { apiJson } from '@/lib/api-client'
import { useErrorText, useLang } from '@/lib/i18n-client'

export default function VerifyEmailBanner({ padded = true }: { padded?: boolean }) {
  const { t } = useLang()
  const errorText = useErrorText()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const read = () => setUser(getCurrentUser())
    read()
    // SessionGuard refreshes the cached user shortly after load.
    const timer = setTimeout(read, 1500)
    window.addEventListener(AUTH_EVENT, read)
    return () => { clearTimeout(timer); window.removeEventListener(AUTH_EVENT, read) }
  }, [])

  if (!user || isVerified(user)) return null

  const resend = async () => {
    setState('busy')
    setError(null)
    try {
      await apiJson('/api/auth/verify-email/resend', { method: 'POST', body: {} })
      setState('sent')
    } catch (e) {
      setError(errorText(e))
      setState('idle')
    }
  }

  return (
    <div style={{ padding: padded ? '12px 16px 0' : 0 }}>
      <div className="card" role="status" style={{ padding: '12px 14px', cursor: 'default', border: '1.5px solid var(--rum-tint)' }}>
        <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>
          <Icon name="bell" size={16} style={{ color: 'var(--rum-text)' }} /> {t('m.verify.bannerTitle')}
        </p>
        <p style={{ fontSize: '13px', color: 'var(--label-secondary)', margin: '4px 0 8px', lineHeight: 1.4 }}>{t('m.verify.bannerBody', { email: user.email })}</p>
        {state === 'sent' ? (
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success)' }}>{t('m.verify.resent')}</p>
        ) : (
          <button className="btn btn-tertiary" onClick={resend} disabled={state === 'busy'} style={{ minHeight: '36px', padding: '0', fontSize: '14px' }}>{t('m.verify.resend')}</button>
        )}
        {error && <p role="alert" style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>{error}</p>}
      </div>
    </div>
  )
}
