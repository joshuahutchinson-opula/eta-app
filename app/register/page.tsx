// app/register/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/i18n-client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { usePatois } from '@/lib/i18n-client'

export default function RegisterPage() {
  const patois = usePatois()
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const { t } = useLang()

  // Invite links look like /register?ref=CODE.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) setReferralCode(ref.toUpperCase())
  }, [])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError(patois.errorGeneric)
      return
    }
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, referralCode: referralCode.trim() || undefined })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || patois.errorGeneric)
        return
      }

      localStorage.setItem('eta_token', data.token)
      localStorage.setItem('eta_user', JSON.stringify(data.user))
      router.push('/onboarding')
    } catch (err) {
      setError(patois.errorNetwork)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', background: 'var(--system-bg)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px', maxWidth: '400px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', color: 'var(--label-primary)' }}>
          {patois.ctaWelcome}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '30px' }}>
          Create your ETA account
        </p>

        {error && (
          <div className="card" style={{ padding: '12px', marginBottom: '16px', cursor: 'default' }}>
            <p style={{ fontSize: '13px', color: 'var(--error)' }}>{error}</p>
          </div>
        )}

        <div className="card" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px', marginBottom: '12px', cursor: 'default' }}>
          <Icon name="user" size={18} />
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--label-primary)', fontSize: '16px', outline: 'none', fontFamily: 'inherit' }}
          />
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px', marginBottom: '12px', cursor: 'default' }}>
          <Icon name="user" size={18} />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--label-primary)', fontSize: '16px', outline: 'none', fontFamily: 'inherit' }}
          />
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px', marginBottom: '20px', cursor: 'default' }}>
          <Icon name="settings" size={18} />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--label-primary)', fontSize: '16px', outline: 'none', fontFamily: 'inherit' }}
          />
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px', marginBottom: '20px', marginTop: '-8px', cursor: 'default' }}>
          <Icon name="gift" size={18} />
          <input
            type="text"
            placeholder={t('m.register.referral')}
            aria-label={t('m.register.referral')}
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--label-primary)', fontSize: '16px', outline: 'none', fontFamily: 'inherit', letterSpacing: '0.04em' }}
          />
        </div>

        <button className="btn btn-primary" onClick={handleRegister} disabled={loading}>
          {loading ? patois.loadingHome : patois.ctaPrimary}
        </button>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--label-secondary)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--rum-text)', fontWeight: 600, textDecoration: 'none' }}>
            Login
          </Link>
        </p>
      </div>
    </main>
  )
}