// app/reset-password/page.tsx — set a new password from a reset link (?token=…).
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { signIn } from '@/lib/auth-client'
import { useLang, usePatois } from '@/lib/i18n-client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { t } = useLang()
  const patois = usePatois()
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setToken(new URLSearchParams(window.location.search).get('token')) }, [])

  const submit = async () => {
    if (password !== confirm) { setError(t('m.reset.mismatch')); return }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || patois.errorGeneric)
      signIn(data.token, data.user)
      router.replace('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : patois.errorNetwork)
      setBusy(false)
    }
  }

  const field = (value: string, set: (v: string) => void, label: string) => (
    <label className="card" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px', marginBottom: '12px', cursor: 'text' }}>
      <Icon name="settings" size={18} />
      <input type="password" autoComplete="new-password" value={value} onChange={e => set(e.target.value)} placeholder={label} aria-label={label} style={{ flex: 1, background: 'none', border: 'none', color: 'var(--label-primary)', fontSize: '16px', outline: 'none', fontFamily: 'inherit' }} />
    </label>
  )

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--system-bg)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px', maxWidth: '400px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', color: 'var(--label-primary)' }}>{t('m.reset.title')}</h1>
        {token === null ? null : !token ? (
          <p role="alert" style={{ fontSize: '15px', color: 'var(--error)' }}>{t('m.reset.noToken')}</p>
        ) : (
          <>
            <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '24px' }}>{t('m.reset.body')}</p>
            {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '12px' }}>{error}</p>}
            {field(password, setPassword, t('m.reset.new'))}
            {field(confirm, setConfirm, t('m.reset.confirm'))}
            <button className="btn btn-primary" onClick={submit} disabled={busy || password.length < 8} style={{ marginTop: '4px' }}>{busy ? patois.loadingHome : t('m.reset.save')}</button>
          </>
        )}
        <Link href="/forgot-password" style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', fontWeight: 600, color: 'var(--rum-text)', textDecoration: 'none' }}>{t('m.reset.newLink')}</Link>
      </div>
    </main>
  )
}
