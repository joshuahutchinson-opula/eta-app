// components/BookingSheet.tsx — the booking step for an experience:
// date, time and party size → price breakdown → payment → done.
// Payment is a clearly labelled placeholder ("Pay with ETA Wallet") until
// the real payment rails are decided; it deducts from walletBalance.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import Price from '@/components/Price'
import { useLang } from '@/lib/i18n-client'
import { getAuthToken, getCurrentUser, setCurrentUser } from '@/lib/auth-client'
import { jamaicaToday, priceBreakdown } from '@/lib/pricing'
import { hapticBookingConfirmed, triggerHaptic } from '@/lib/haptics'

export interface BookingDetails {
  date: string
  time: string | null
  partySize: number
}

export interface BookingResult {
  bookingId?: string | null
  transactionId?: string | null
  walletBalance?: number | null
}

interface Props {
  open: boolean
  onClose: () => void
  title: string
  unitPrice: number
  priceIsEstimate?: boolean
  startTimes?: string[]
  maxPartySize?: number | null
  defaultPartySize?: number
  onConfirm: (details: BookingDetails) => Promise<BookingResult>
  /** Called when the traveler taps Continue on the confirmation. */
  onDone: (result: BookingResult) => void
}

function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export default function BookingSheet({ open, onClose, title, unitPrice, priceIsEstimate, startTimes = [], maxPartySize, defaultPartySize = 1, onConfirm, onDone }: Props) {
  const { t } = useLang()
  const [step, setStep] = useState<'details' | 'pay' | 'done'>('details')
  const [date, setDate] = useState(jamaicaToday())
  const [time, setTime] = useState<string>(startTimes[0] ?? '10:00')
  const [party, setParty] = useState(defaultPartySize)
  const [wallet, setWallet] = useState<number | null>(null)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BookingResult>({})
  const max = maxPartySize ?? 20

  useEffect(() => {
    if (!open) return
    setStep('details')
    setError(null)
    setParty(Math.min(max, Math.max(1, defaultPartySize)))
    setTime(startTimes[0] ?? '10:00')
    setWallet(getCurrentUser()?.walletBalance ?? null)
    const token = getAuthToken()
    if (token) {
      fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d?.user) { setCurrentUser(d.user); setWallet(d.user.walletBalance) } })
        .catch(() => {})
    }
    // Reset only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const price = priceBreakdown(unitPrice, party)
  const signedIn = Boolean(getCurrentUser())
  const short = wallet !== null && wallet < price.total

  const pay = async () => {
    setPaying(true)
    setError(null)
    try {
      const r = await onConfirm({ date, time: time || null, partySize: party })
      if (typeof r.walletBalance === 'number') {
        const u = getCurrentUser()
        if (u) setCurrentUser({ ...u, walletBalance: r.walletBalance })
      }
      setResult(r)
      hapticBookingConfirmed()
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sumth nah wuk')
    } finally {
      setPaying(false)
    }
  }

  const row = (label: string, value: React.ReactNode, strong = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0' }}>
      <span style={{ fontSize: '15px', color: strong ? 'var(--label-primary)' : 'var(--label-secondary)', fontWeight: strong ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: strong ? '17px' : '15px', fontWeight: strong ? 700 : 600, color: 'var(--label-primary)' }}>{value}</span>
    </div>
  )

  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', fontSize: '16px', fontFamily: 'inherit', color: 'var(--label-primary)', minHeight: '44px' }

  return (
    <>
      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={step === 'done' ? undefined : onClose} />
      <div className={`bottom-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.book.title')}>
        <div className="sheet-grabber" />
        {open && (
          <div style={{ padding: '0 20px 24px' }}>
            {step === 'details' && (
              <>
                <p className="section-eyebrow">{t('m.book.step', { n: 1 })}</p>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '16px' }}>{title}</h3>

                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '6px' }} htmlFor="book-date">{t('m.book.date')}</label>
                <input id="book-date" type="date" min={jamaicaToday()} value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, marginBottom: '16px' }} />

                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '6px' }}>{t('m.book.time')}</p>
                {startTimes.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                    {startTimes.map(st => (
                      <button key={st} className={`chip ${time === st ? 'active' : ''}`} aria-pressed={time === st} onClick={() => { triggerHaptic('selection'); setTime(st) }}>
                        {timeLabel(st)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input type="time" value={time} onChange={e => setTime(e.target.value)} aria-label={t('m.book.time')} style={{ ...inputStyle, marginBottom: '16px' }} />
                )}

                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '6px' }}>{t('m.book.party')}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                  <button className="heart-btn" aria-label={t('m.book.fewer')} disabled={party <= 1} onClick={() => { triggerHaptic('selection'); setParty(p => Math.max(1, p - 1)) }} style={{ fontSize: '22px', fontWeight: 600, color: 'var(--label-primary)' }}>−</button>
                  <span className="num-font" aria-live="polite" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)', minWidth: '32px', textAlign: 'center' }}>{party}</span>
                  <button className="heart-btn" aria-label={t('m.book.more')} disabled={party >= max} onClick={() => { triggerHaptic('selection'); setParty(p => Math.min(max, p + 1)) }} style={{ fontSize: '22px', fontWeight: 600, color: 'var(--label-primary)' }}>+</button>
                  {maxPartySize ? <span style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{t('m.book.maxParty', { n: maxPartySize })}</span> : null}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-tertiary" onClick={onClose} style={{ flex: 1 }}>{t('m.book.cancel')}</button>
                  <button className="btn btn-primary" onClick={() => { triggerHaptic('light'); setStep('pay') }} disabled={!date} style={{ flex: 2 }}>{t('m.book.review')}</button>
                </div>
              </>
            )}

            {step === 'pay' && (
              <>
                <p className="section-eyebrow">{t('m.book.step', { n: 2 })}</p>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '12px' }}>{t('m.book.breakdown')}</h3>
                <div className="card" style={{ padding: '8px 16px', marginBottom: '16px', cursor: 'default' }}>
                  {row(t('m.book.perPersonTimes', { n: party }), <><Price usd={price.unitPrice} compact /> × {party}</>)}
                  {row(t('m.book.subtotal'), <Price usd={price.subtotal} compact />)}
                  {price.fees > 0 && row(t('m.book.fees'), <Price usd={price.fees} compact />)}
                  <div style={{ borderTop: '0.5px solid var(--separator)', marginTop: '4px', paddingTop: '4px' }}>
                    {row(t('m.book.total'), <Price usd={price.total} />, true)}
                  </div>
                </div>
                {priceIsEstimate && <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '12px' }}>{t('m.book.estimateNote')}</p>}

                <div className="card" style={{ padding: '14px 16px', marginBottom: '16px', cursor: 'default', border: '1.5px dashed var(--separator)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <Icon name="wallet" size={18} style={{ color: 'var(--rum-text)' }} />
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)' }}>{t('m.book.payWallet')}</span>
                    <span className="chip" style={{ marginLeft: 'auto', minHeight: '24px', padding: '2px 8px', fontSize: '11px', cursor: 'default' }}>{t('m.book.placeholder')}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{t('m.book.placeholderNote')}</p>
                  {wallet !== null && (
                    <p style={{ fontSize: '13px', color: short ? 'var(--error)' : 'var(--label-secondary)', marginTop: '6px' }}>
                      {t('m.book.walletBalance')} <Price usd={wallet} compact />
                    </p>
                  )}
                </div>

                {!signedIn && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{t('m.book.loginFirst')}</p>}
                {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{error}</p>}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-tertiary" onClick={() => setStep('details')} style={{ flex: 1 }}>{t('m.book.back')}</button>
                  {short ? (
                    <Link href="/wallet" className="btn btn-primary" style={{ flex: 2, textDecoration: 'none' }}>{t('m.book.topUp')}</Link>
                  ) : (
                    <button className="btn btn-primary" onClick={pay} disabled={paying || !signedIn} style={{ flex: 2 }}>
                      {paying ? '…' : <>{t('m.book.pay')} <Price usd={price.total} compact /></>}
                    </button>
                  )}
                </div>
              </>
            )}

            {step === 'done' && (
              <div style={{ textAlign: 'center' }}>
                <div className="check-pop-in" style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px auto 12px', color: 'white' }}>
                  <Icon name="check" size={26} />
                </div>
                <h3 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '4px' }}>{t('m.book.booked')}</h3>
                <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '20px' }}>{t('m.book.bookedBody')}</p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <Link href="/bookings" className="btn btn-secondary" style={{ flex: 1, textDecoration: 'none' }}>
                    <Icon name="journal" size={16} /> {t('m.book.ticket')}
                  </Link>
                  {result.transactionId && (
                    <Link href={`/receipt/${result.transactionId}`} className="btn btn-secondary" style={{ flex: 1, textDecoration: 'none' }}>
                      <Icon name="receipt" size={16} /> {t('m.book.receipt')}
                    </Link>
                  )}
                </div>
                <button className="btn btn-primary" onClick={() => onDone(result)} style={{ width: '100%' }}>{t('m.book.continue')}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
