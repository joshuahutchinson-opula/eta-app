// app/pay/page.tsx
'use client'

import { useState } from 'react'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import { patois } from '@/lib/patois'

export default function PayPage() {
  const [step, setStep] = useState<'scan' | 'amount' | 'confirm' | 'receipt'>('scan')
  const [amount, setAmount] = useState('')

  const handleKeypad = (key: string) => {
    if (key === '⌫') {
      setAmount(amount.slice(0, -1))
    } else if (key === '.' && amount.includes('.')) {
      return
    } else {
      setAmount(amount + key)
    }
  }

  const processPayment = () => {
    setStep('receipt')
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', background: '#0A1628' }}>
      {step === 'scan' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '240px', height: '240px', border: '2px solid var(--gold)', borderRadius: '24px', opacity: 0.7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="camera" size={60} />
          </div>
          <p style={{ fontSize: '14px', color: 'var(--sand-dim)', marginTop: '20px' }}>
            Point at vendor QR code
          </p>
          <button className="btn-secondary" style={{ marginTop: '20px' }} onClick={() => setStep('amount')}>
            Enter amount manually
          </button>
        </div>
      )}

      {step === 'amount' && (
        <div style={{ flex: 1, padding: '20px' }}>
          <p style={{ fontSize: '36px', fontWeight: 800, textAlign: 'center', marginBottom: '16px' }}>
            ${amount || '0'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            {keys.map(k => (
              <button
                key={k}
                className="glass-button"
                style={{ padding: '14px', fontSize: '18px' }}
                onClick={() => handleKeypad(k)}
              >
                {k}
              </button>
            ))}
          </div>
          {amount && (
            <button className="btn-primary" style={{ marginTop: '16px' }} onClick={() => setStep('confirm')}>
              Continue
            </button>
          )}
        </div>
      )}

      {step === 'confirm' && (
        <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '24px' }}>Confirm payment</h1>
          <div className="glass" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--sand-dim)' }}>Vendor</span>
              <span style={{ fontWeight: 600 }}>Push Cart</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--sand-dim)' }}>Amount</span>
              <span style={{ fontWeight: 600 }}>${amount} JMD</span>
            </div>
          </div>
          <button className="btn-primary" style={{ marginTop: '24px' }} onClick={processPayment}>
            {patois.ctaConfirm}
          </button>
        </div>
      )}

      {step === 'receipt' && (
        <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '340px', padding: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: '18px', fontWeight: 800 }}>
              ET<span style={{ color: 'var(--rum)' }}>A</span>
            </p>
            <p style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px' }}>Push Cart</p>
            <div style={{ borderTop: '1px solid var(--glass-border)', margin: '12px 0', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--sand-dim)' }}>Amount</span>
                <span style={{ fontWeight: 600 }}>${amount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{ color: 'var(--sand-dim)' }}>Points earned</span>
                <span style={{ fontWeight: 600, color: 'var(--gold)' }}>
                  +{Math.floor(parseFloat(amount || '0'))}
                </span>
              </div>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--sea)', fontWeight: 600 }}>
              {patois.successPayment}
            </p>
          </div>
        </div>
      )}

      <Dock />
    </main>
  )
}