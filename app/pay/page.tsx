// app/pay/page.tsx
'use client'

import { useState } from 'react'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import { patois } from '@/lib/patois'

type Rail = 'JAM-DEX' | 'Lynk' | 'Stripe'

export default function PayPage() {
  const [view, setView] = useState<'scan' | 'qr'>('scan')
  const [amount, setAmount] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [rail, setRail] = useState<Rail>('JAM-DEX')
  const [autoRouting, setAutoRouting] = useState(true)
  const [flashOn, setFlashOn] = useState(false)
  const [manualCode, setManualCode] = useState(false)
  const [manualInput, setManualInput] = useState('')

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

  const handleKeypad = (key: string) => {
    if (key === '⌫') {
      setAmount(amount.slice(0, -1))
    } else if (key === '.' && amount.includes('.')) {
      return
    } else {
      setAmount(amount + key)
    }
  }

  const simulateScan = () => {
    setCheckoutOpen(true)
  }

  const processPayment = () => {
    setCheckoutOpen(false)
    setAmount('')
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <div style={{ padding: '16px 16px 0' }}>
        {/* Toggle */}
        <div style={{ 
          display: 'flex', 
          background: 'var(--system-bg-secondary)', 
          borderRadius: '10px', 
          padding: '2px', 
          gap: '2px',
          marginBottom: '16px'
        }}>
          {(['scan', 'qr'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                fontFamily: 'inherit',
                background: view === v ? 'var(--system-bg-elevated)' : 'transparent',
                color: view === v ? 'var(--label-primary)' : 'var(--label-secondary)',
                boxShadow: view === v ? 'var(--shadow-card)' : 'none',
                minHeight: '44px'
              }}
            >
              {v === 'scan' ? 'Scan' : 'QR Code'}
            </button>
          ))}
        </div>

        {view === 'scan' && (
          <div>
            <div style={{
              width: '100%',
              height: '360px',
              background: '#000000',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
              marginBottom: '12px'
            }}>
              <div style={{
                width: '220px',
                height: '220px',
                border: '2px solid rgba(255,255,255,0.6)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: flashOn ? 'rgba(255,255,255,0.08)' : 'transparent',
                transition: 'background 0.2s ease'
              }}>
                <Icon name="camera" size={48} style={{ color: flashOn ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)' }} />
              </div>
              <button
                onClick={() => setFlashOn(!flashOn)}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: flashOn ? 'var(--gold)' : 'rgba(255,255,255,0.15)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: flashOn ? 'var(--black)' : 'white'
                }}
              >
                <Icon name="sparkle" size={18} />
              </button>
              <div style={{
                position: 'absolute',
                bottom: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '6px 12px',
                borderRadius: '999px',
                background: 'rgba(0,0,0,0.7)',
                color: 'var(--live)',
                fontSize: '13px',
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}>
                Splitting with 2 others
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: '8px' }} onClick={simulateScan}>
              Simulate Scan
            </button>
            <button className="btn btn-tertiary" onClick={() => setManualCode(!manualCode)} style={{ width: '100%', minHeight: '44px' }}>
              Enter code manually
            </button>
            {manualCode && (
              <input
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Enter vendor code"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '14px',
                  border: '1px solid var(--separator)',
                  background: 'var(--system-bg-elevated)',
                  fontSize: '17px',
                  fontFamily: 'inherit',
                  color: 'var(--label-primary)',
                  outline: 'none',
                  marginTop: '8px',
                  minHeight: '44px'
                }}
              />
            )}
          </div>
        )}

        {view === 'qr' && (
          <div style={{ textAlign: 'center', paddingTop: '20px' }}>
            <div style={{
              width: '240px',
              height: '240px',
              margin: '0 auto 16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(12, 1fr)',
              gap: '2px',
              padding: '16px',
              background: 'white',
              borderRadius: '14px',
              boxShadow: 'var(--shadow-card)',
              border: '2px solid var(--rum)'
            }}>
              {[...Array(144)].map((_, i) => (
                <div key={i} style={{
                  background: (i * 13 + i * i) % 3 === 0 ? '#0F0E0C' : 'transparent',
                  borderRadius: '1px'
                }} />
              ))}
            </div>
            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '4px' }}>
              Jordan Hutchinson
            </p>
            <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '16px' }}>
              Gold Member · 1,240 pts
            </p>
            <p className="caption-font" style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>
              Vendor scans this to charge you
            </p>
          </div>
        )}
      </div>

      {/* Checkout Sheet */}
      {checkoutOpen && (
        <div className="bottom-sheet-overlay open" onClick={() => setCheckoutOpen(false)} />
      )}
      <div className={`bottom-sheet ${checkoutOpen ? 'open' : ''}`}>
        {checkoutOpen && (
          <div style={{ padding: '0 20px 20px' }}>
            <div className="sheet-grabber" />
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '16px' }}>Checkout</h3>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '4px' }}>Amount</p>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid var(--separator)', background: 'var(--system-bg-elevated)', fontSize: '24px', fontWeight: 700, fontFamily: 'Space Mono, monospace', color: 'var(--label-primary)', outline: 'none', marginBottom: '8px' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                {keys.map(k => (
                  <button
                    key={k}
                    onClick={() => handleKeypad(k)}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'var(--system-bg-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '17px',
                      fontWeight: 600,
                      color: 'var(--label-primary)',
                      fontFamily: 'inherit',
                      minHeight: '44px'
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>
                {autoRouting ? 'Auto-routing' : 'Paying via'}
              </p>
              {autoRouting ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--live)', fontSize: '15px', fontWeight: 600 }}>
                  <Icon name="sparkle" size={16} />
                  JAM-DEX → Lynk → Stripe
                  <button onClick={() => setAutoRouting(false)} style={{ background: 'none', border: 'none', color: 'var(--rum)', cursor: 'pointer', fontSize: '15px', fontWeight: 600, marginLeft: 'auto', minHeight: '44px' }}>
                    Override
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['JAM-DEX', 'Lynk', 'Stripe'] as Rail[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setRail(r)}
                      className={`chip ${rail === r ? 'active' : ''}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>
                Points earned: <span className="num-font" style={{ color: 'var(--rum)', fontWeight: 700 }}>+{Math.floor(parseFloat(amount || '0'))}</span>
              </p>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={processPayment}>
              {patois.ctaConfirm}
            </button>
          </div>
        )}
      </div>

      <Dock />
    </main>
  )
}