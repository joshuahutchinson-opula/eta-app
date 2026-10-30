// app/pay/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { usePatois } from '@/lib/i18n-client'
import { getCurrentUser, setCurrentUser, type CurrentUser } from '@/lib/auth-client'
import { authHeaders } from '@/lib/api-client'
import { useLang } from '@/lib/i18n-client'
import Price from '@/components/Price'
import SuccessAnimation from '@/components/SuccessAnimation'
import Dock from '@/components/Dock'
import { getTierForPoints } from '@/lib/rewardTiers'
import { hapticBookingConfirmed } from '@/lib/haptics'

type Rail = 'JAM-DEX' | 'Lynk' | 'Stripe'

const TIP_PRESETS = [10, 15, 20]

export default function PayPage() {
  const patois = usePatois()
  const router = useRouter()
  const { t } = useLang()
  // Tip: a preset %, a custom dollar amount, or none.
  const [tipChoice, setTipChoice] = useState<number | 'custom' | null>(null)
  const [customTip, setCustomTip] = useState('')
  const [payError, setPayError] = useState<string | null>(null)
  const [view, setView] = useState<'scan' | 'qr'>('scan')
  const [amount, setAmount] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [rail, setRail] = useState<Rail>('JAM-DEX')
  const [autoRouting, setAutoRouting] = useState(true)
  const [flashOn, setFlashOn] = useState(false)
  const [manualCode, setManualCode] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [paying, setPaying] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    setUser(getCurrentUser())
  }, [])

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

  const simulateScan = () => setCheckoutOpen(true)

  const base = parseFloat(amount || '0') || 0
  const tip = tipChoice === 'custom'
    ? Math.max(0, parseFloat(customTip || '0') || 0)
    : tipChoice ? Math.round(base * tipChoice) / 100 : 0
  const total = Math.round((base + tip) * 100) / 100

  const processPayment = async () => {
    if (!user || !base || paying) return
    setPaying(true)
    setPayError(null)
    try {
      const res = await fetch('/api/pay', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ amount: base, tip, rail: autoRouting ? 'Auto (JAM-DEX → Lynk → Stripe)' : rail, vendorCode: manualInput })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || patois.errorPaymentFailed)
      if (typeof data.points === 'number') {
        const updated = { ...user, points: data.points }
        setCurrentUser(updated)
        setUser(updated)
      }
      setCheckoutOpen(false)
      setAmount('')
      setTipChoice(null)
      setCustomTip('')
      hapticBookingConfirmed()
      // The receipt screen is the confirmation; it's also kept in Wallet.
      router.push(`/receipt/${data.transactionId}`)
    } catch (error) {
      setPayError(error instanceof Error ? error.message : patois.errorPaymentFailed)
    } finally {
      setPaying(false)
    }
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <div style={{ padding: '16px 16px 0' }}>
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
              className="tappable"
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
                className="tappable"
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
                  color: flashOn ? '#0F0E0C' : 'white'
                }}
              >
                <Icon name="sparkle" size={18} />
              </button>
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
              {user?.name || 'Guest'}
            </p>
            <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '16px' }}>
              {user ? `${getTierForPoints(user.points).label} · ${user.points.toLocaleString()} pts` : ''}
            </p>
            <p className="caption-font" style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>
              Vendor scans this to charge you
            </p>
          </div>
        )}
      </div>

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
                    className="tappable"
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
                  <button onClick={() => setAutoRouting(false)} style={{ background: 'none', border: 'none', color: 'var(--rum-text)', cursor: 'pointer', fontSize: '15px', fontWeight: 600, marginLeft: 'auto', minHeight: '44px' }}>
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
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.pay.addTip')}</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="group" aria-label={t('m.pay.addTip')}>
                <button className={`chip ${tipChoice === null ? 'active' : ''}`} aria-pressed={tipChoice === null} onClick={() => setTipChoice(null)}>{t('m.pay.noTip')}</button>
                {TIP_PRESETS.map(p => (
                  <button key={p} className={`chip ${tipChoice === p ? 'active' : ''}`} aria-pressed={tipChoice === p} onClick={() => setTipChoice(p)}>{p}%</button>
                ))}
                <button className={`chip ${tipChoice === 'custom' ? 'active' : ''}`} aria-pressed={tipChoice === 'custom'} onClick={() => setTipChoice('custom')}>{t('m.pay.custom')}</button>
              </div>
              {tipChoice === 'custom' && (
                <input
                  inputMode="decimal"
                  value={customTip}
                  onChange={e => setCustomTip(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  aria-label={t('m.pay.customTip')}
                  style={{ width: '100%', marginTop: '8px', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg-elevated)', fontSize: '17px', fontFamily: 'Space Mono, monospace', color: 'var(--label-primary)', minHeight: '44px' }}
                />
              )}
            </div>
            <div style={{ marginBottom: '20px', fontSize: '15px', color: 'var(--label-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {tip > 0 && <span>{t('m.pay.tip')}: <Price usd={tip} compact style={{ fontWeight: 700, color: 'var(--label-primary)' }} /></span>}
              <span>{t('m.book.total')}: <Price usd={total} style={{ fontWeight: 700, color: 'var(--label-primary)' }} /></span>
              <span>
                Points earned: <span className="num-font" style={{ color: 'var(--rum-text)', fontWeight: 700 }}>+{Math.floor(base)}</span>
              </span>
            </div>
            {payError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{payError}</p>}
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={processPayment} disabled={paying || !base}>
              {paying ? patois.loadingPayment : patois.ctaConfirm}
            </button>
          </div>
        )}
      </div>

      <SuccessAnimation show={showSuccess} onComplete={() => setShowSuccess(false)} />
      <Dock />
    </main>
  )
}