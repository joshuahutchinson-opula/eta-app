// app/login/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { useLang, usePatois } from '@/lib/i18n-client'
import { signIn } from '@/lib/auth-client'

export default function LoginPage() {
  const patois = usePatois()
  const { t } = useLang()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Social sign-in buttons only appear for providers configured on the server.
  const [providers, setProviders] = useState<{ google: boolean; apple: boolean }>({ google: false, apple: false })

  useEffect(() => {
    fetch('/api/auth/providers').then(r => (r.ok ? r.json() : null)).then(p => { if (p) setProviders(p) }).catch(() => {})

    // Back from Google/Apple: /login?oauth=<session token> or ?error=…
    const q = new URLSearchParams(window.location.search)
    const oauth = q.get('oauth')
    if (q.get('error')) setError(t('m.login.socialFailed'))
    if (oauth) {
      setLoading(true)
      fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: oauth }) })
        .then(r => (r.ok ? r.json() : Promise.reject()))
        .then(data => { signIn(oauth, data.user); router.replace('/') })
        .catch(() => { setError(t('m.login.socialFailed')); setLoading(false) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError(patois.errorGeneric)
      return
    }
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || patois.errorGeneric)
        return
      }

      signIn(data.token, data.user)
      router.push('/')
    } catch (err) {
      setError(patois.errorNetwork)
    } finally {
      setLoading(false)
    }
  }

  const socialButton = (provider: 'google' | 'apple', label: string) => (
    <a
      href={`/api/auth/oauth/${provider}`}
      className="btn"
      style={{ textDecoration: 'none', marginBottom: '10px', background: provider === 'apple' ? 'var(--label-primary)' : 'var(--system-bg-elevated)', color: provider === 'apple' ? 'var(--system-bg)' : 'var(--label-primary)', border: provider === 'google' ? '1px solid var(--separator)' : 'none' }}
    >
      {label}
    </a>
  )

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', background: 'var(--system-bg)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px', maxWidth: '400px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', color: 'var(--label-primary)' }}>
          {patois.ctaWelcome}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '30px' }}>
          {t('m.login.subtitle')}
        </p>

        {error && (
          <div className="card" role="alert" style={{ padding: '12px', marginBottom: '16px', cursor: 'default' }}>
            <p style={{ fontSize: '13px', color: 'var(--error)' }}>{error}</p>
          </div>
        )}

        {(providers.google || providers.apple) && (
          <>
            {providers.apple && socialButton('apple', t('m.login.apple'))}
            {providers.google && socialButton('google', t('m.login.google'))}
            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--label-secondary)', margin: '6px 0 16px' }}>{t('m.login.or')}</p>
          </>
        )}

        <label className="card" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px', marginBottom: '12px', cursor: 'text' }}>
          <Icon name="user" size={18} />
          <input
            type="email"
            autoComplete="email"
            placeholder={t('m.login.email')}
            aria-label={t('m.login.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--label-primary)', fontSize: '16px', outline: 'none', fontFamily: 'inherit' }}
          />
        </label>

        <label className="card" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px', marginBottom: '8px', cursor: 'text' }}>
          <Icon name="settings" size={18} />
          <input
            type="password"
            autoComplete="current-password"
            placeholder={t('m.login.password')}
            aria-label={t('m.login.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--label-primary)', fontSize: '16px', outline: 'none', fontFamily: 'inherit' }}
          />
        </label>

        <Link href="/forgot-password" style={{ alignSelf: 'flex-end', fontSize: '13px', fontWeight: 600, color: 'var(--rum-text)', textDecoration: 'none', marginBottom: '16px', minHeight: '32px', display: 'flex', alignItems: 'center' }}>
          {t('m.login.forgot')}
        </Link>

        <button className="btn btn-primary" onClick={handleLogin} disabled={loading}>
          {loading ? patois.loadingHome : patois.ctaPrimary}
        </button>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--label-secondary)' }}>
          {t('m.login.noAccount')}{' '}
          <Link href="/register" style={{ color: 'var(--rum-text)', fontWeight: 600, textDecoration: 'none' }}>
            {t('m.login.register')}
          </Link>
        </p>
      </div>
    </main>
  )
}
