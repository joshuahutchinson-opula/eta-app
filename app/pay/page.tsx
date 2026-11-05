// app/pay/page.tsx — Scan & Pay, the middle ETA button. One scanner: scanning
// a vendor's ETA QR card logs the visit (points, first-visit bonus, that
// vendor's rewards unlocked; lib/visit-client.ts) and goes straight on to
// paying that vendor — amount, tip, how to pay — ending on the receipt.
// Below the scanner: the wallet balance, payment history and saved cards.
// /v/<token> (the phone camera) and ?code= land here mid-flow; ?via=explore
// (from Explore mode) lets the scan reach quest checkpoints' explorer perks.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import Price from '@/components/Price'
import QrScanner from '@/components/QrScanner'
import ErrorState from '@/components/ErrorState'
import SuccessAnimation from '@/components/SuccessAnimation'
import Dock from '@/components/Dock'
import { getCurrentUser, setCurrentUser, type CurrentUser } from '@/lib/auth-client'
import { apiJson } from '@/lib/api-client'
import { useErrorText, useLang, usePatois } from '@/lib/i18n-client'
import { ApiError } from '@/lib/errors'
import { currentRate, useCurrency } from '@/lib/currency'
import { LocationError, submitVisit, type VisitResult } from '@/lib/visit-client'
import { hapticBookingConfirmed, hapticSaved, triggerHaptic } from '@/lib/haptics'

type Stage = 'scan' | 'checking' | 'pay'
type Rail = 'ETA Wallet' | 'Auto' | 'JAM-DEX' | 'Lynk' | 'Stripe'

interface PayVendor { id: string; name: string; image: string | null; neighborhood?: string }
interface Transaction {
  id: string
  amount: number
  type: 'PAYMENT' | 'REWARD' | 'TOPUP' | 'TRANSFER' | 'REFUND'
  status: 'PENDING' | 'COMPLETED' | 'FAILED'
  createdAt: string
  vendor?: { name: string } | null
  description?: string | null
}
interface PaymentCard { id: string; brand: string; last4: string; label: string }

const TIP_PRESETS = [10, 15, 20]
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']
const AUTO_RAIL = 'Auto (JAM-DEX → Lynk → Stripe)'
const CARDS_STORAGE_KEY = 'etaWalletCards'
const DEFAULT_CARDS: PaymentCard[] = [
  { id: 'card-1', brand: 'Visa', last4: '4242', label: 'Default' },
  { id: 'card-2', brand: 'Mastercard', last4: '8888', label: 'Backup' }
]
const isCredit = (type: Transaction['type']) => type === 'REWARD' || type === 'TOPUP' || type === 'REFUND'
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', marginBottom: '16px', fontSize: '17px', color: 'var(--label-primary)', background: 'var(--system-bg-secondary)', border: 'none', borderRadius: 'var(--radius-md)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }

export default function ScanAndPayPage() {
  const patois = usePatois()
  const router = useRouter()
  const { t, lang } = useLang()
  const errorText = useErrorText()
  const { currency } = useCurrency()
  const locale = lang === 'en' ? 'en-US' : lang
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [stage, setStage] = useState<Stage>('scan')
  const [scanKey, setScanKey] = useState(0)
  const [scanError, setScanError] = useState<string | null>(null)
  const [vendor, setVendor] = useState<PayVendor | null>(null)
  const [visit, setVisit] = useState<VisitResult | null>(null)
  const [visitNote, setVisitNote] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [tipChoice, setTipChoice] = useState<number | 'custom' | null>(null)
  const [customTip, setCustomTip] = useState('')
  const [rail, setRail] = useState<Rail>('Auto')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[] | null>(null)
  const [txFailed, setTxFailed] = useState(false)
  const [cards, setCards] = useState<PaymentCard[]>([])
  const [cardSheet, setCardSheet] = useState(false)
  const [newCard, setNewCard] = useState({ brand: '', last4: '', label: '' })
  const [showSuccess, setShowSuccess] = useState(false)
  const viaRef = useRef<'explore' | undefined>(undefined)

  const loadTransactions = useCallback(async () => {
    setTxFailed(false)
    try { const d = await apiJson<Transaction[]>('/api/transactions'); setTransactions(Array.isArray(d) ? d : []) } catch { setTxFailed(true) }
  }, [])

  // ---- Scan → visit → pay ------------------------------------------------
  const handleCode = useCallback(async (code: string) => {
    setScanError(null)
    setVisitNote(null)
    setVisit(null)
    setStage('checking')
    // Who the card belongs to (for paying) and the visit, together.
    const who = apiJson<{ vendor: PayVendor }>(`/api/visits/vendor?code=${encodeURIComponent(code)}`).then(d => d.vendor).catch(() => null)
    try {
      const result = await submitVisit(code, viaRef.current)
      setVisit(result)
      const u = getCurrentUser()
      if (u) setUser({ ...u, points: result.totalPoints })
      setVendor((await who) ?? { id: result.vendor.id, name: result.vendor.name, image: null })
      setStage('pay')
    } catch (e) {
      if (e instanceof ApiError && e.code === 'QR_INVALID') { setScanError(errorText(e)); setStage('scan'); setScanKey(k => k + 1); return }
      const found = await who
      if (!found) { setScanError(errorText(e)); setStage('scan'); setScanKey(k => k + 1); return }
      // Can't log the visit, but they can still pay the vendor.
      setVisitNote(e instanceof LocationError ? t('m.scan.needLocation') : errorText(e))
      setVendor(found)
      setStage('pay')
    }
  }, [errorText, t])

  useEffect(() => {
    const current = getCurrentUser()
    setUser(current)
    if (current) {
      apiJson<{ user: CurrentUser }>('/api/users/me').then(d => { if (d.user) { setCurrentUser(d.user); setUser(d.user) } }).catch(() => {})
      loadTransactions()
      const params = new URLSearchParams(window.location.search)
      if (params.get('via') === 'explore') viaRef.current = 'explore'
      const code = params.get('code')
      if (code) { window.history.replaceState(null, '', viaRef.current ? '/pay?via=explore' : '/pay'); handleCode(code) }
    }
    try {
      const raw = localStorage.getItem(CARDS_STORAGE_KEY)
      if (raw) setCards(JSON.parse(raw))
      else { setCards(DEFAULT_CARDS); localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(DEFAULT_CARDS)) }
    } catch { setCards(DEFAULT_CARDS) }
    setMounted(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Typed in the traveler's currency; everything is stored in USD.
  const entered = Math.max(0, parseFloat(amount || '0') || 0)
  const base = Math.round((currency === 'JMD' ? entered / currentRate() : entered) * 100) / 100
  const tip = tipChoice === 'custom'
    ? Math.max(0, parseFloat(customTip || '0') || 0)
    : tipChoice ? Math.round(base * tipChoice) / 100 : 0
  const total = Math.round((base + tip) * 100) / 100
  const balance = user?.walletBalance ?? 0
  const walletOk = balance >= total && total > 0

  // The wallet leads when it covers the bill.
  useEffect(() => { if (stage === 'pay') setRail(r => (r === 'ETA Wallet' && !walletOk ? 'Auto' : r)) }, [walletOk, stage])

  const keypad = (key: string) => {
    if (key === '⌫') setAmount(a => a.slice(0, -1))
    else if (key === '.' && amount.includes('.')) return
    else if (/\.\d{2}$/.test(amount)) return
    else setAmount(a => (a === '0' && key !== '.' ? key : a + key))
    triggerHaptic('selection')
  }

  const pay = async () => {
    if (!user || !vendor || !base || paying) return
    setPaying(true)
    setPayError(null)
    try {
      const data = await apiJson<{ transactionId: string; points: number | null; walletBalance: number | null }>('/api/pay', {
        method: 'POST',
        body: { vendorId: vendor.id, amount: base, tip, rail: rail === 'Auto' ? AUTO_RAIL : rail }
      })
      const updated = { ...user, ...(typeof data.points === 'number' ? { points: data.points } : {}), ...(typeof data.walletBalance === 'number' ? { walletBalance: data.walletBalance } : {}) }
      setCurrentUser(updated)
      setUser(updated)
      hapticBookingConfirmed()
      router.push(`/receipt/${data.transactionId}`)
    } catch (e) {
      setPayError(e instanceof ApiError || e instanceof Error ? errorText(e) : patois.errorPaymentFailed)
    } finally {
      setPaying(false)
    }
  }

  const reset = () => {
    setStage('scan')
    setVendor(null)
    setVisit(null)
    setVisitNote(null)
    setAmount('')
    setTipChoice(null)
    setCustomTip('')
    setPayError(null)
    setScanKey(k => k + 1)
  }

  const saveCards = (updated: PaymentCard[]) => {
    setCards(updated)
    try { localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(updated)) } catch {}
  }
  const addCard = () => {
    const brand = newCard.brand.trim()
    if (!brand || !/^\d{4}$/.test(newCard.last4)) return
    saveCards([...cards, { id: `card-${Date.now()}`, brand, last4: newCard.last4, label: newCard.label.trim() || t('m.hub.card') }])
    hapticSaved()
    setCardSheet(false)
    setShowSuccess(true)
    setNewCard({ brand: '', last4: '', label: '' })
  }

  const heading = (eyebrow: string, title: string) => (
    <div className="section-header"><div className="section-heading"><span className="section-eyebrow">{eyebrow}</span><span className="section-title">{title}</span></div></div>
  )

  if (!mounted) return <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}><Dock /></main>

  if (!user) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
        <div className="empty-state" style={{ minHeight: '70vh' }}>
          <Icon name="qr" size={32} style={{ color: 'var(--label-tertiary)' }} />
          <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.sp.loginTitle')}</p>
          <p style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>{t('m.sp.loginBody')}</p>
          <Link href="/login?next=/pay" className="btn btn-primary" style={{ marginTop: '8px', textDecoration: 'none' }}>{t('m.profile.login')}</Link>
        </div>
        <Dock />
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '96px' }}>
      <SuccessAnimation show={showSuccess} onComplete={() => setShowSuccess(false)} />
      <div className="content-fade-in" style={{ padding: '16px' }}>
        <span className="section-eyebrow">{t('m.sp.eyebrow')}</span>
        <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginBottom: '4px' }}>{t('m.sp.title')}</h1>
        {stage === 'scan' && <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '14px' }}>{t('m.sp.sub')}</p>}

        {stage === 'scan' && (
          <>
            {scanError && <p role="alert" style={{ fontSize: '14px', color: 'var(--error)', marginBottom: '10px' }}>{scanError}</p>}
            <QrScanner key={scanKey} onCode={handleCode} />
          </>
        )}

        {stage === 'checking' && (
          <div className="empty-state" style={{ padding: '48px 0' }}>
            <Icon name="mapPin" size={32} style={{ color: 'var(--rum-text)' }} />
            <p>{t('m.scan.checking')}</p>
          </div>
        )}

        {stage === 'pay' && vendor && (
          <section aria-label={t('m.sp.payVendor', { name: vendor.name })} style={{ marginTop: '10px' }}>
            {/* The visit */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', marginBottom: '12px', cursor: 'default' }}>
              <span style={{ width: '56px', height: '56px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, background: 'var(--system-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-tertiary)' }}>
                {vendor.image ? <Img src={vendor.image} alt="" width={112} height={112} sizes="56px" /> : <Icon name="marketplace" size={20} />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '17px', fontWeight: 700, color: 'var(--label-primary)' }}>{vendor.name}</span>
                {visit ? (
                  <span className="num-font" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', fontWeight: 600, color: 'var(--success)' }}>
                    <Icon name="check" size={13} /> {visit.firstDiscovery ? t('m.checkin.firstTime', { points: visit.pointsAwarded }) : t('m.checkin.done', { points: visit.pointsAwarded })}
                  </span>
                ) : visitNote ? (
                  <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>{visitNote}</span>
                ) : null}
              </span>
            </div>
            {visit && visit.unlockedRewards.length > 0 && (
              <Link href="/rewards" className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', textDecoration: 'none', marginBottom: '12px', border: '1.5px solid var(--gold)' }}>
                <Icon name="gift" size={20} style={{ color: 'var(--rum-text)' }} />
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>{t('m.scan.unlocked')}</span>
                  <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>{visit.unlockedRewards.map(r => r.name).join(', ')}</span>
                </span>
                <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
              </Link>
            )}

            {visit?.explore && (visit.explore.quests.length > 0 || visit.explore.perks.length > 0) && (
              <Link href="/explore" className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', textDecoration: 'none', marginBottom: '12px', background: '#0E1220', color: 'white' }}>
                <Icon name="compass" size={20} style={{ color: 'var(--gold)' }} />
                <span style={{ flex: 1 }}>
                  {visit.explore.quests.map(q => (
                    <span key={q.title} style={{ display: 'block', fontSize: '14px', fontWeight: 700 }}>{q.completed ? t('m.ex.questDone', { title: q.title, badge: q.badgeName ?? '' }) : t('m.ex.checkpointHit', { title: q.title, n: q.reached, total: q.total })}</span>
                  ))}
                  {visit.explore.perks.map(p => (
                    <span key={p.code} style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--gold)' }}>{t('m.ex.perkUnlocked', { name: p.name })}</span>
                  ))}
                </span>
                <Icon name="chevronRight" size={14} style={{ color: 'rgba(255,255,255,0.6)' }} />
              </Link>
            )}

            {/* Amount */}
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label-secondary)', marginBottom: '6px' }}>{t('m.sp.amount')}</p>
            <div className="card" style={{ padding: '14px', marginBottom: '8px', cursor: 'default', textAlign: 'center' }}>
              <span className="num-font" aria-live="polite" style={{ fontSize: '36px', fontWeight: 700, color: entered ? 'var(--label-primary)' : 'var(--label-tertiary)' }}>{currency === 'JMD' ? 'J$' : '$'}{amount || '0'}</span>
              <p style={{ fontSize: '12px', color: 'var(--label-secondary)' }}>{t('m.sp.enterIn', { currency })}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '16px' }}>
              {KEYS.map(k => (
                <button key={k} onClick={() => keypad(k)} aria-label={k === '⌫' ? t('m.sp.delete') : k} className="tappable" style={{ padding: '12px', borderRadius: '12px', background: 'var(--system-bg-secondary)', border: 'none', cursor: 'pointer', fontSize: '20px', fontWeight: 600, color: 'var(--label-primary)', fontFamily: 'inherit', minHeight: '48px' }}>{k}</button>
              ))}
            </div>

            {/* Tip */}
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.pay.addTip')}</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }} role="group" aria-label={t('m.pay.addTip')}>
              <button className={`chip ${tipChoice === null ? 'active' : ''}`} aria-pressed={tipChoice === null} onClick={() => setTipChoice(null)}>{t('m.pay.noTip')}</button>
              {TIP_PRESETS.map(p => (
                <button key={p} className={`chip ${tipChoice === p ? 'active' : ''}`} aria-pressed={tipChoice === p} onClick={() => setTipChoice(p)}>{p}%</button>
              ))}
              <button className={`chip ${tipChoice === 'custom' ? 'active' : ''}`} aria-pressed={tipChoice === 'custom'} onClick={() => setTipChoice('custom')}>{t('m.pay.custom')}</button>
            </div>
            {tipChoice === 'custom' && (
              <input inputMode="decimal" value={customTip} onChange={e => setCustomTip(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" aria-label={t('m.pay.customTip')} className="num-font" style={{ width: '100%', marginBottom: '8px', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg-elevated)', fontSize: '17px', color: 'var(--label-primary)', minHeight: '44px' }} />
            )}

            {/* How to pay */}
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label-secondary)', margin: '12px 0 8px' }}>{t('m.sp.payWith')}</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }} role="radiogroup" aria-label={t('m.sp.payWith')}>
              <button role="radio" aria-checked={rail === 'ETA Wallet'} disabled={!walletOk} className={`chip ${rail === 'ETA Wallet' ? 'active' : ''}`} onClick={() => setRail('ETA Wallet')}>
                <Icon name="wallet" size={14} /> {t('m.sp.wallet')} · <Price usd={balance} />
              </button>
              <button role="radio" aria-checked={rail === 'Auto'} className={`chip ${rail === 'Auto' ? 'active' : ''}`} onClick={() => setRail('Auto')}><Icon name="sparkle" size={14} /> {t('m.sp.auto')}</button>
              {(['JAM-DEX', 'Lynk', 'Stripe'] as const).map(r => (
                <button key={r} role="radio" aria-checked={rail === r} className={`chip ${rail === r ? 'active' : ''}`} onClick={() => setRail(r)}>{r}</button>
              ))}
            </div>

            <div className="card" style={{ padding: '12px 14px', marginBottom: '14px', cursor: 'default', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '15px', color: 'var(--label-secondary)' }}>
              {tip > 0 && <span style={{ display: 'flex', justifyContent: 'space-between' }}>{t('m.pay.tip')} <Price usd={tip} style={{ fontWeight: 700, color: 'var(--label-primary)' }} /></span>}
              <span style={{ display: 'flex', justifyContent: 'space-between' }}>{t('m.book.total')} <Price usd={total} style={{ fontWeight: 700, color: 'var(--label-primary)' }} /></span>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}>{t('m.sp.pointsEarned')} <span className="num-font" style={{ color: 'var(--rum-text)', fontWeight: 700 }}>+{Math.floor(base)}</span></span>
            </div>
            {payError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{payError}</p>}
            <button className="btn btn-primary" style={{ width: '100%', minHeight: '52px', marginBottom: '8px' }} onClick={pay} disabled={paying || !base}>
              {paying ? patois.loadingPayment : base ? <>{t('m.sp.payNow', { name: vendor.name })} · <Price usd={total} style={{ color: 'white' }} /></> : t('m.sp.enterAmount')}
            </button>
            <button className="btn btn-tertiary" style={{ width: '100%' }} onClick={reset}>{visit ? t('m.sp.done') : t('m.scan.again')}</button>
          </section>
        )}

        {/* Wallet */}
        {stage === 'scan' && (
          <div style={{ marginTop: '28px' }}>
            <div className="card" style={{ padding: '18px 16px', marginBottom: '20px', cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span>
                <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)' }}>{t('m.hub.balance')}</span>
                <Price usd={balance} style={{ fontSize: '30px', fontWeight: 700, color: 'var(--label-primary)' }} />
              </span>
              <Icon name="wallet" size={28} style={{ color: 'var(--rum-text)' }} />
            </div>

            {heading(t('m.hub.activity'), t('m.hub.history'))}
            {txFailed ? <ErrorState compact onRetry={loadTransactions} /> : transactions === null ? (
              <div className="skeleton-card" style={{ height: '120px', marginBottom: '28px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
            ) : transactions.length === 0 ? (
              <div className="empty-state" style={{ marginBottom: '20px' }}><Icon name="receipt" size={28} style={{ color: 'var(--label-tertiary)' }} /><p>{t('m.hub.noTransactions')}</p></div>
            ) : (
              <div className="card" style={{ padding: '4px 16px', marginBottom: '28px' }}>
                {transactions.map((tx, i) => (
                  <Link key={tx.id} href={`/receipt/${tx.id}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', textDecoration: 'none', borderBottom: i < transactions.length - 1 ? '0.5px solid var(--separator)' : 'none' }}>
                    <span style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--system-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name={isCredit(tx.type) ? 'sparkle' : 'receipt'} size={18} style={{ color: 'var(--label-secondary)' }} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.vendor?.name || tx.description || t(`m.hub.tx.${tx.type}` as 'm.hub.tx.PAYMENT')}</span>
                      <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>{new Date(tx.createdAt).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}{tx.status !== 'COMPLETED' ? ` · ${t(`m.hub.txStatus.${tx.status}` as 'm.hub.txStatus.PENDING')}` : ''}</span>
                    </span>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: isCredit(tx.type) ? 'var(--success)' : 'var(--label-secondary)' }}>
                      {isCredit(tx.type) ? '+' : '−'}<Price usd={Math.abs(tx.amount)} />
                    </span>
                    <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
                  </Link>
                ))}
              </div>
            )}

            {heading(t('m.hub.payWith'), t('m.hub.cards'))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
              {cards.map(card => (
                <div key={card.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'default' }}>
                  <span style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--rum-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="card" size={18} style={{ color: 'var(--rum-text)' }} /></span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: 'var(--label-primary)' }}>{card.brand} <span className="num-font">•••• {card.last4}</span></span>
                    <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>{card.label}</span>
                  </span>
                </div>
              ))}
            </div>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setCardSheet(true)}><Icon name="plus" size={16} /> {t('m.hub.addCard')}</button>
          </div>
        )}
      </div>

      {/* Add card */}
      <div className={`bottom-sheet-overlay ${cardSheet ? 'open' : ''}`} onClick={() => setCardSheet(false)} />
      <div className={`bottom-sheet ${cardSheet ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.hub.addCard')}>
        <div className="sheet-grabber" />
        <div style={{ padding: '0 20px 20px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '16px' }}>{t('m.hub.addCard')}</h3>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '6px' }}>{t('m.hub.cardBrand')}</p>
          <input type="text" placeholder="Visa" value={newCard.brand} onChange={e => setNewCard({ ...newCard, brand: e.target.value })} style={inputStyle} />
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '6px' }}>{t('m.hub.cardLast4')}</p>
          <input type="text" inputMode="numeric" maxLength={4} placeholder="4242" value={newCard.last4} onChange={e => setNewCard({ ...newCard, last4: e.target.value.replace(/\D/g, '').slice(0, 4) })} style={inputStyle} />
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '6px' }}>{t('m.hub.cardLabel')}</p>
          <input type="text" value={newCard.label} onChange={e => setNewCard({ ...newCard, label: e.target.value })} style={{ ...inputStyle, marginBottom: '20px' }} />
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={!newCard.brand.trim() || newCard.last4.length !== 4} onClick={addCard}>{t('m.hub.addCard')}</button>
        </div>
      </div>

      <Dock />
    </main>
  )
}
