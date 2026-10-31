// app/register/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/lib/icons'
import LinkedText, { safeNext } from '@/components/LinkedText'
import { useErrorText, useLang, usePatois } from '@/lib/i18n-client'
import { signIn } from '@/lib/auth-client'
import { responseError } from '@/lib/errors'

const inputStyle: React.CSSProperties = { flex: 1, background: 'none', border: 'none', color: 'var(--label-primary)', fontSize: '16px', outline: 'none', fontFamily: 'inherit' }

export default function RegisterPage() {
  const patois = usePatois()
  const router = useRouter()
  const { t } = useLang()
  const errorText = useErrorText()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [next, setNext] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Invite links look like /register?ref=CODE.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const ref = q.get('ref')
    if (ref) setReferralCode(ref.toUpperCase())
    setNext(safeNext(q.get('next')))
  }, [])

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError(t('m.register.fillAll'))
      return
    }
    if (!agreed) {
      setError(t('m.register.mustAgree'))
      return
    }
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, acceptTerms: true, referralCode: referralCode.trim() || undefined })
      })
      if (!response.ok) throw await responseError(response)
      const data = await response.json()
      signIn(data.token, data.user)
      router.push(next ?? '/onboarding')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }

  const legal = { terms: { href: '/terms', label: t('m.legal.terms') }, privacy: { href: '/privacy', label: t('m.legal.privacy') } }

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', background: 'var(--system-bg)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px', maxWidth: '400px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', color: 'var(--label-primary)' }}>
          {patois.ctaWelcome}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '30px' }}>
          {t('m.register.subtitle')}
        </p>

        {error && (
          <div className="card" role="alert" style={{ padding: '12px', marginBottom: '16px', cursor: 'default' }}>
            <p style={{ fontSize: '13px', color: 'var(--error)' }}>{error}</p>
          </div>
        )}

        <label className="card" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px', marginBottom: '12px', cursor: 'text' }}>
          <Icon name="user" size={18} />
          <input type="text" autoComplete="name" placeholder={t('m.register.name')} aria-label={t('m.register.name')} value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </label>

        <label className="card" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px', marginBottom: '12px', cursor: 'text' }}>
          <Icon name="user" size={18} />
          <input type="email" autoComplete="email" placeholder={t('m.login.email')} aria-label={t('m.login.email')} value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </label>

        <label className="card" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px', marginBottom: '12px', cursor: 'text' }}>
          <Icon name="lock" size={18} />
          <input type="password" autoComplete="new-password" placeholder={t('m.register.passwordHint')} aria-label={t('m.register.passwordHint')} value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
        </label>

        <label className="card" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px', marginBottom: '16px', cursor: 'text' }}>
          <Icon name="gift" size={18} />
          <input
            type="text"
            placeholder={t('m.register.referral')}
            aria-label={t('m.register.referral')}
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            style={{ ...inputStyle, letterSpacing: '0.04em' }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '20px', fontSize: '14px', color: 'var(--label-primary)', lineHeight: 1.4, minHeight: '44px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            required
            style={{ width: '22px', height: '22px', marginTop: '1px', accentColor: 'var(--rum)', flexShrink: 0 }}
          />
          <span><LinkedText text={t('m.register.agree')} links={legal} /></span>
        </label>

        <button className="btn btn-primary" onClick={handleRegister} disabled={loading || !agreed}>
          {loading ? patois.loadingHome : patois.ctaPrimary}
        </button>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--label-secondary)' }}>
          {t('m.register.haveAccount')}{' '}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} style={{ color: 'var(--rum-text)', fontWeight: 600, textDecoration: 'none' }}>
            {t('m.register.login')}
          </Link>
        </p>
      </div>
    </main>
  )
}
