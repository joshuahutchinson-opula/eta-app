'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import Icon from '@/lib/icons'
import { patois } from '@/lib/patois'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
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
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
      <TopBar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px', maxWidth: '400px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>
          {patois.ctaWelcome}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--sand-dim)', marginBottom: '30px' }}>
          Create your ETA account
        </p>

        {error && (
          <div className="glass" style={{ padding: '12px', marginBottom: '16px', borderColor: 'var(--rum)' }}>
            <p style={{ fontSize: '13px', color: 'var(--rum-bright)' }}>{error}</p>
          </div>
        )}

        <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px', marginBottom: '12px' }}>
          <Icon name="user" size={18} />
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--sand)', fontSize: '16px', outline: 'none', fontFamily: 'inherit' }}
          />
        </div>

        <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px', marginBottom: '12px' }}>
          <Icon name="user" size={18} />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--sand)', fontSize: '16px', outline: 'none', fontFamily: 'inherit' }}
          />
        </div>

        <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px', marginBottom: '20px' }}>
          <Icon name="settings" size={18} />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--sand)', fontSize: '16px', outline: 'none', fontFamily: 'inherit' }}
          />
        </div>

        <button className="btn-primary" onClick={handleRegister} disabled={loading}>
          {loading ? patois.loadingHome : patois.ctaPrimary}
        </button>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--sand-dim)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--rum)', fontWeight: 600, textDecoration: 'none' }}>
            Login
          </Link>
        </p>
      </div>
    </main>
  )
}