// app/forgot-password/page.tsx — ask for a password reset link.
'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { useLang, usePatois } from '@/lib/i18n-client'

export default function ForgotPasswordPage() {
  const { t } = useLang()
  const patois = usePatois()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  // Only returned outside production, while email sending is stubbed.
  const [devLink, setDevLink] = useState<string | null>(null)

  const submit = async () => {
    setState('busy')
    setError(null)
    try {
      const res = await fetch('/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || patois.errorGeneric)
      setDevLink(data.resetUrl ?? null)
      setState('sent')
    } catch (e) {
      setError(e instanceof Error ? e.message : patois.errorNetwork)
      setState('error')
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--system-bg)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px', maxWidth: '400px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', color: 'var(--label-primary)' }}>{t('m.forgot.title')}</h1>
        <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '24px' }}>{t('m.forgot.body')}</p>
        {state === 'sent' ? (
          <div className="card" role="status" style={{ padding: '16px', cursor: 'default' }}>
            <p style={{ fontSize: '15px', color: 'var(--label-primary)' }}>{t('m.forgot.sent')}</p>
            {devLink && (
              <a href={devLink} style={{ display: 'block', marginTop: '10px', fontSize: '13px', color: 'var(--rum-text)', wordBreak: 'break-all' }}>{t('m.forgot.devLink')}</a>
            )}
          </div>
        ) : (
          <>
            {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '12px' }}>{error}</p>}
            <label className="card" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px', marginBottom: '16px', cursor: 'text' }}>
              <Icon name="user" size={18} />
              <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('m.login.email')} aria-label={t('m.login.email')} style={{ flex: 1, background: 'none', border: 'none', color: 'var(--label-primary)', fontSize: '16px', outline: 'none', fontFamily: 'inherit' }} />
            </label>
            <button className="btn btn-primary" onClick={submit} disabled={state === 'busy' || !email.trim()}>{state === 'busy' ? patois.loadingHome : t('m.forgot.send')}</button>
          </>
        )}
        <Link href="/login" style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', fontWeight: 600, color: 'var(--rum-text)', textDecoration: 'none' }}>{t('m.forgot.back')}</Link>
      </div>
    </main>
  )
}
