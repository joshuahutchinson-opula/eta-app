'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { patois } from '@/lib/patois'

const steps = [
  {
    title: 'Welcome to Negril.',
    text: 'The real one. Not the brochure.',
    button: patois.ctaPrimary,
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800'
  },
  {
    title: 'What brings you here?',
    text: 'Pick your vibe.',
    button: patois.ctaVibe,
    image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800',
    vibeSelector: true
  },
  {
    title: 'Explore. Earn. Repeat.',
    text: 'Going out of your way earns more.',
    button: patois.ctaPrimary,
    image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800'
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [vibe, setVibe] = useState('')

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1)
    } else {
      localStorage.setItem('eta_vibe', vibe)
      router.push('/')
    }
  }

  const current = steps[step]

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${current.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(15,14,12,0.3), rgba(15,14,12,0.95))' }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: '100vh', padding: '24px', paddingBottom: '48px' }}>
        <h1 style={{ fontSize: '34px', fontWeight: 800, marginBottom: '12px' }}>{current.title}</h1>
        <p style={{ fontSize: '16px', color: 'var(--sand-dim)', marginBottom: '28px' }}>{current.text}</p>

        {current.vibeSelector && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
            {['Party', 'Chill', 'Adventure', 'Romance'].map(v => (
              <button
                key={v}
                onClick={() => setVibe(v)}
                style={{
                  padding: '18px',
                  background: vibe === v ? 'var(--gradient-rum)' : 'rgba(26,24,21,0.8)',
                  border: vibe === v ? 'none' : '1px solid var(--glass-border)',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  color: 'var(--sand)',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                {v}
              </button>
            ))}
          </div>
        )}

        <button className="btn-primary" onClick={handleNext}>
          {current.button}
        </button>

        {step > 0 && (
          <button className="btn-secondary" style={{ marginTop: '10px' }} onClick={() => router.push('/')}>
            {patois.ctaSkip}
          </button>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px' }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? '24px' : '8px',
                height: '4px',
                borderRadius: '999px',
                background: i === step ? 'var(--rum)' : '#2A2723',
                transition: 'all 0.3s'
              }}
            />
          ))}
        </div>
      </div>
    </main>
  )
}