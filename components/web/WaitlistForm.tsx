// components/web/WaitlistForm.tsx
'use client'

import { useState } from 'react'

interface Props {
  type: 'traveler' | 'vendor'
  source: string
  label: string
  placeholder: string
  button: string
  success: string
  /** 'dark' = dark button on a light/accent surface (vendor design). */
  variant?: 'primary' | 'dark'
}

export default function WaitlistForm({ type, source, label, placeholder, button, success, variant = 'primary' }: Props) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('sending')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type, source })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setState('done')
      setMessage(success)
    } catch (err) {
      setState('error')
      setMessage(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  if (state === 'done') {
    return <p className="w-form-msg" role="status" style={{ fontSize: 16 }}>✓ {message}</p>
  }

  const inputId = `waitlist-${type}-${source}`
  return (
    <form onSubmit={submit} style={{ width: '100%', maxWidth: 480 }}>
      <div className="w-form-row">
        <label htmlFor={inputId} className="w-sr">{label}</label>
        <input
          id={inputId}
          className="w-input"
          type="email"
          required
          autoComplete="email"
          placeholder={placeholder}
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={variant === 'dark' ? { border: 'none', background: '#fff', color: '#14120E' } : undefined}
        />
        <button type="submit" className={`w-btn ${variant === 'dark' ? '' : 'w-btn-primary'}`} style={{ height: 52, borderRadius: 12, ...(variant === 'dark' ? { background: '#14120E', color: '#fff' } : {}) }} disabled={state === 'sending'}>
          {state === 'sending' ? '…' : button}
        </button>
      </div>
      {state === 'error' ? <p className="w-form-msg" role="alert">{message}</p> : null}
    </form>
  )
}
