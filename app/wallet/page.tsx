// app/wallet/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import { hapticSaved } from '@/lib/haptics'
import SuccessAnimation from '@/components/SuccessAnimation'
import { getCurrentUser, CurrentUser } from '@/lib/auth-client'
import { getTierForPoints, tierProgress } from '@/lib/rewardTiers'

interface PaymentCard {
  id: string
  brand: string
  last4: string
  label: string
}

interface Transaction {
  id: string
  amount: number
  type: 'PAYMENT' | 'REWARD' | 'TOPUP' | 'TRANSFER'
  status: 'PENDING' | 'COMPLETED' | 'FAILED'
  createdAt: string
  userId: string
  vendorId?: string | null
  user?: { name: string }
  vendor?: { name: string } | null
}

const CARDS_STORAGE_KEY = 'etaWalletCards'

const DEFAULT_CARDS: PaymentCard[] = [
  { id: 'card-1', brand: 'Visa', last4: '4242', label: 'Default' },
  { id: 'card-2', brand: 'Mastercard', last4: '8888', label: 'Backup' },
]

const TYPE_LABELS: Record<Transaction['type'], string> = {
  PAYMENT: 'Payment',
  REWARD: 'Reward earned',
  TOPUP: 'Wallet top up',
  TRANSFER: 'Transfer',
}

function isCredit(type: Transaction['type']) {
  return type === 'REWARD' || type === 'TOPUP'
}

function formatDate(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const isSameDay = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  if (isSameDay) return 'Today'
  if (isYesterday) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function WalletPage() {
  const router = useRouter()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [checkedAuth, setCheckedAuth] = useState(false)
  const [cards, setCards] = useState<PaymentCard[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [passportOpen, setPassportOpen] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showAddCardSheet, setShowAddCardSheet] = useState(false)
  const [newCardBrand, setNewCardBrand] = useState('')
  const [newCardLast4, setNewCardLast4] = useState('')
  const [newCardLabel, setNewCardLabel] = useState('')

  useEffect(() => {
    const currentUser = getCurrentUser()
    setUser(currentUser)
    setCheckedAuth(true)

    try {
      const raw = localStorage.getItem(CARDS_STORAGE_KEY)
      if (raw) {
        setCards(JSON.parse(raw))
      } else {
        setCards(DEFAULT_CARDS)
        localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(DEFAULT_CARDS))
      }
    } catch {
      setCards(DEFAULT_CARDS)
    }

    if (!currentUser) return

    fetch('/api/transactions')
      .then(res => res.json())
      .then((data: Transaction[]) => {
        if (Array.isArray(data)) {
          setTransactions(data.filter(t => t.userId === currentUser.id))
        }
      })
      .catch(() => {})
  }, [])

  const points = user?.points ?? 0
  const balance = user?.walletBalance ?? 0
  const currentTier = getTierForPoints(points)
  const { percent: progressPercent, pointsToNext, next: nextTier } = tierProgress(points)

  const saveCards = (updated: PaymentCard[]) => {
    setCards(updated)
    try {
      localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(updated))
    } catch {
      // ignore storage failures
    }
  }

  const handleAddCard = () => {
    const brand = newCardBrand.trim()
    const last4 = newCardLast4.trim()
    if (!brand || last4.length !== 4 || !/^\d{4}$/.test(last4)) return

    const newCard: PaymentCard = {
      id: `card-${Date.now()}`,
      brand,
      last4,
      label: newCardLabel.trim() || 'Card',
    }
    saveCards([...cards, newCard])
    hapticSaved()
    setShowAddCardSheet(false)
    setShowSuccess(true)
    setNewCardBrand('')
    setNewCardLast4('')
    setNewCardLabel('')
  }

  if (checkedAuth && !user) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
        <div className="content-fade-in empty-state" style={{ minHeight: '60vh' }}>
          <Icon name="wallet" size={32} style={{ color: 'var(--label-tertiary)' }} />
          <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>Log in to see your wallet</p>
          <p style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>
            Your balance, points, and payment methods live here once you&apos;re signed in.
          </p>
          <Link href="/login" className="btn btn-primary" style={{ marginTop: '8px' }}>
            Log In
          </Link>
        </div>
        <Dock />
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <SuccessAnimation show={showSuccess} onComplete={() => setShowSuccess(false)} />

      <div className="content-fade-in" style={{ padding: '16px' }}>
        {/* WALLET SECTION */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '4px' }}>Wallet</p>
          <h2 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginBottom: '16px' }}>
            <span className="num-font">${balance.toFixed(2)}</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {cards.map(card => (
              <div key={card.id} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'var(--rum-tint)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Icon name="card" size={20} style={{ color: 'var(--rum-text)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>
                    {card.brand} <span className="num-font">•••• {card.last4}</span>
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>
                    {card.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn-secondary" style={{ width: '100%', marginTop: '8px' }} onClick={() => setShowAddCardSheet(true)}>
            <Icon name="plus" size={16} />
            Add Card
          </button>
        </div>

        {/* PASSPORT SECTION */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '12px' }}>Membership</p>

          {!passportOpen ? (
            <div
              onClick={() => setPassportOpen(true)}
              className="tappable"
              style={{
                minHeight: '200px',
                borderRadius: '14px',
                background: 'linear-gradient(155deg, #9c2812, #6e1a0c 55%, #4d1207)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
                position: 'relative',
                overflow: 'hidden',
                padding: '24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'pointer'
              }}
            >
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.01) 0px, rgba(255,255,255,0.01) 2px, transparent 2px, transparent 4px)',
                pointerEvents: 'none'
              }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  border: '2px solid var(--gold)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  boxShadow: '0 0 20px rgba(255,184,0,0.25)'
                }}>
                  <Icon name="sparkle" size={28} style={{ color: 'var(--gold)' }} />
                </div>
                <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, letterSpacing: '4px', color: 'var(--gold)', textShadow: '0 1px 0 rgba(0,0,0,0.7)', marginBottom: '8px' }}>
                  ETA
                </h3>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: '10px', letterSpacing: '2px', color: 'rgba(255, 184, 0, 0.7)', textTransform: 'uppercase' }}>
                  {user ? currentTier.label : 'Member'}
                </p>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: '10px', fontStyle: 'italic', color: 'rgba(255,255,255,0.4)', marginTop: '16px' }}>
                  Tap to open
                </p>
              </div>
            </div>
          ) : (
            <div style={{
              minHeight: '200px',
              borderRadius: '14px',
              background: 'linear-gradient(160deg, #FEFBF6 0%, #F3ECDD 100%)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              position: 'relative',
              overflow: 'hidden',
              padding: '24px 20px'
            }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.015) 0px, rgba(0,0,0,0.015) 1px, transparent 1px, transparent 3px)',
                pointerEvents: 'none'
              }} />
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                right: '12px',
                bottom: '12px',
                border: '1px solid rgba(184, 32, 16, 0.25)',
                borderRadius: '4px',
                pointerEvents: 'none'
              }} />
              <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 8px',
                  overflow: 'hidden'
                }}>
                  <Icon name="user" size={24} style={{ color: 'rgba(15, 14, 12, 0.55)' }} />
                </div>
                <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#0F0E0C', marginBottom: '4px' }}>
                  {user?.name ?? 'Member'}
                </h3>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '6px', marginBottom: '16px' }}>
                  <span className="num-font" style={{ fontSize: '32px', fontWeight: 700, color: 'var(--rum)' }}>
                    {points.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '13px', color: 'rgba(15, 14, 12, 0.55)' }}>pts</span>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(15, 14, 12, 0.55)' }}>
                      {nextTier ? `${pointsToNext} pts to ${nextTier.label}` : `${currentTier.label} — top tier`}
                    </span>
                    <span className="num-font" style={{ fontSize: '11px', color: 'rgba(15, 14, 12, 0.55)' }}>
                      {progressPercent}%
                    </span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <div className="progress-fill" style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--rum)' }} />
                  </div>
                </div>
                <button onClick={() => setPassportOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(15, 14, 12, 0.55)', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', minHeight: '44px' }}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* REWARDS TEASER */}
        <div style={{ marginBottom: '24px' }}>
          <div className="section-header">
            <div className="section-heading">
              <span className="section-eyebrow">Redeem</span>
              <span className="section-title">Rewards</span>
            </div>
          </div>
          <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '4px' }}>You have</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span className="num-font" style={{ fontSize: '28px', fontWeight: 700, color: 'var(--rum)' }}>
                  {points.toLocaleString()}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>points to spend</span>
              </div>
            </div>
            <button className="btn btn-secondary" onClick={() => router.push('/rewards')}>
              See All
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
        </div>

        {/* POINTS HISTORY */}
        <div>
          <div className="section-header">
            <div className="section-heading">
              <span className="section-eyebrow">Activity</span>
              <span className="section-title">Transaction History</span>
            </div>
          </div>
          {transactions.length === 0 ? (
            <div className="empty-state">
              <Icon name="receipt" size={32} style={{ color: 'var(--label-tertiary)' }} />
              <p style={{ fontSize: '15px' }}>No transactions yet</p>
            </div>
          ) : (
            <div className="card" style={{ padding: '4px 16px' }}>
              {transactions.map((t, i) => (
                <div key={t.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 0',
                  borderBottom: i < transactions.length - 1 ? '0.5px solid var(--separator)' : 'none'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    flexShrink: 0,
                    background: 'var(--system-bg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Icon name={isCredit(t.type) ? 'sparkle' : 'receipt'} size={18} style={{ color: 'var(--label-secondary)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>
                      {t.vendor?.name || TYPE_LABELS[t.type]}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>
                      {formatDate(t.createdAt)}
                      {t.status !== 'COMPLETED' && ` · ${t.status.charAt(0) + t.status.slice(1).toLowerCase()}`}
                    </p>
                  </div>
                  <span className="num-font" style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: isCredit(t.type) ? 'var(--rum)' : 'var(--label-secondary)'
                  }}>
                    {isCredit(t.type) ? '+' : '-'}{Math.abs(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Card Sheet */}
      <div className={`bottom-sheet-overlay ${showAddCardSheet ? 'open' : ''}`} onClick={() => setShowAddCardSheet(false)} />
      <div className={`bottom-sheet ${showAddCardSheet ? 'open' : ''}`}>
        <div className="sheet-grabber" />
        <div style={{ padding: '0 20px 20px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '16px' }}>Add Card</h3>

          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '6px' }}>Card Brand</p>
          <input
            type="text"
            placeholder="e.g. Visa"
            value={newCardBrand}
            onChange={(e) => setNewCardBrand(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', marginBottom: '16px', fontSize: '17px', color: 'var(--label-primary)', background: 'var(--system-bg-secondary)', border: 'none', borderRadius: 'var(--radius-md)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />

          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '6px' }}>Last 4 Digits</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="4242"
            value={newCardLast4}
            onChange={(e) => setNewCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
            style={{ width: '100%', padding: '12px 14px', marginBottom: '16px', fontSize: '17px', color: 'var(--label-primary)', background: 'var(--system-bg-secondary)', border: 'none', borderRadius: 'var(--radius-md)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />

          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '6px' }}>Label (optional)</p>
          <input
            type="text"
            placeholder="e.g. Personal"
            value={newCardLabel}
            onChange={(e) => setNewCardLabel(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', marginBottom: '20px', fontSize: '17px', color: 'var(--label-primary)', background: 'var(--system-bg-secondary)', border: 'none', borderRadius: 'var(--radius-md)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />

          <button
            className="btn btn-primary"
            style={{ width: '100%', opacity: (!newCardBrand.trim() || newCardLast4.length !== 4) ? 0.5 : 1 }}
            disabled={!newCardBrand.trim() || newCardLast4.length !== 4}
            onClick={handleAddCard}
          >
            Add Card
          </button>
        </div>
      </div>

      <Dock />
    </main>
  )
}
