// app/pay/page.tsx
'use client'

import { useState } from 'react'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import { patois } from '@/lib/patois'

type PaymentStatus = 'paid' | 'pending' | 'failed' | 'queued' | 'refunded'
type Rail = 'JAM-DEX' | 'Lynk' | 'Stripe'

interface TripStop {
  id: string
  vendorName: string
  item: string
  price: number
  status: PaymentStatus
}

interface CrewMember {
  id: string
  name: string
  amount: number
  paid: boolean
  isYou: boolean
}

interface TripPage {
  id: string
  destination: string
  date: string
  totalSpent: number
  stops: TripStop[]
  crew: CrewMember[]
  isActive: boolean
  isSealed: boolean
}

const MOCK_TRIPS: TripPage[] = [
  {
    id: 'trip-1',
    destination: 'Full Moon Float',
    date: 'Aug 15, 2026',
    totalSpent: 185,
    isActive: true,
    isSealed: false,
    stops: [
      { id: 's1', vendorName: 'Push Cart', item: 'Jerk Chicken Plate', price: 45, status: 'paid' },
      { id: 's2', vendorName: 'Coral Reef Bar', item: 'Rum Punch Flight', price: 30, status: 'paid' },
      { id: 's3', vendorName: 'MoBay Watersports', item: 'Catamaran Cruise', price: 110, status: 'pending' },
    ],
    crew: [
      { id: 'c1', name: 'You', amount: 62, paid: false, isYou: true },
      { id: 'c2', name: 'Jules', amount: 62, paid: true, isYou: false },
      { id: 'c3', name: 'Ken', amount: 61, paid: false, isYou: false },
    ],
  },
  {
    id: 'trip-2',
    destination: 'Sunset Dinner',
    date: 'Aug 10, 2026',
    totalSpent: 210,
    isActive: false,
    isSealed: true,
    stops: [
      { id: 's4', vendorName: 'Cliffside Grill', item: 'Lobster Dinner', price: 140, status: 'paid' },
      { id: 's5', vendorName: 'Coral Reef Bar', item: 'Cocktails', price: 70, status: 'paid' },
    ],
    crew: [
      { id: 'c4', name: 'You', amount: 105, paid: true, isYou: true },
      { id: 'c5', name: 'Sarah', amount: 105, paid: true, isYou: false },
    ],
  },
  {
    id: 'trip-3',
    destination: 'Jerk Tour',
    date: 'Aug 5, 2026',
    totalSpent: 75,
    isActive: false,
    isSealed: true,
    stops: [
      { id: 's6', vendorName: 'Push Cart', item: 'Jerk Pork', price: 40, status: 'paid' },
      { id: 's7', vendorName: 'Blue Mahoe', item: 'Coffee Flight', price: 35, status: 'paid' },
    ],
    crew: [
      { id: 'c6', name: 'You', amount: 75, paid: true, isYou: true },
    ],
  },
]

export default function PayPage() {
  const [view, setView] = useState<'passport' | 'scan'>('passport')
  const [passportPage, setPassportPage] = useState(0)
  const [amount, setAmount] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [scanSuccess, setScanSuccess] = useState(false)
  const [stampAnimating, setStampAnimating] = useState(false)
  const [rail, setRail] = useState<Rail>('JAM-DEX')
  const [nudged, setNudged] = useState(false)
  const [flashOn, setFlashOn] = useState(false)

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
    setScanSuccess(true)
    setCheckoutOpen(true)
  }

  const processPayment = () => {
    setCheckoutOpen(false)
    setStampAnimating(true)
    setTimeout(() => {
      setStampAnimating(false)
      setScanSuccess(false)
      setAmount('')
    }, 1200)
  }

  const nudgeUnpaid = () => {
    setNudged(true)
    setTimeout(() => setNudged(false), 2000)
  }

  const passportPages: TripPage[] = MOCK_TRIPS

  const currentPage = passportPages[passportPage]
  const isCover = passportPage === 0
  const hasTrips = passportPages.length > 1

  return (
    <main style={{ minHeight: '100vh', background: 'var(--off-white)', paddingBottom: '80px', overflowX: 'hidden' }}>
      {/* Segmented Control */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ 
          display: 'flex', 
          background: 'var(--light-grey)', 
          borderRadius: '10px', 
          padding: '2px', 
          gap: '2px',
          marginBottom: '20px'
        }}>
          {(['passport', 'scan'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                fontFamily: 'inherit',
                background: view === v ? 'var(--card-bg)' : 'transparent',
                color: view === v ? 'var(--black)' : 'var(--grey)',
                boxShadow: view === v ? 'var(--card-shadow)' : 'none'
              }}
            >
              {v === 'passport' ? 'Passport' : 'Scan'}
            </button>
          ))}
        </div>

        {view === 'passport' && (
          <div>
            {/* Passport Cover / Pages */}
            <div className="card" style={{ minHeight: '480px', position: 'relative', overflow: 'hidden' }}>
              {stampAnimating && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'var(--rum)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'stampLand 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                  }}>
                    <Icon name="check" size={36} style={{ color: 'white' }} />
                  </div>
                </div>
              )}

              {isCover ? (
                /* COVER PAGE */
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  {/* User photo */}
                  <div style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    background: 'var(--light-grey)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                    overflow: 'hidden'
                  }}>
                    <Icon name="user" size={32} />
                  </div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--black)' }}>Jordan Hutchinson</h2>
                  
                  {/* Tier badge */}
                  <div style={{
                    display: 'inline-block',
                    marginTop: '8px',
                    padding: '6px 14px',
                    borderRadius: '999px',
                    background: 'var(--rum)',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                  }}>
                    Gold Member
                  </div>

                  {/* Dummy QR */}
                  <div style={{
                    width: '160px',
                    height: '160px',
                    margin: '24px auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(10, 1fr)',
                    gap: '2px',
                    padding: '12px',
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: 'var(--card-shadow)'
                  }}>
                    {[...Array(100)].map((_, i) => (
                      <div key={i} style={{
                        background: (i * 7 + i * i) % 3 === 0 ? 'var(--black)' : 'transparent',
                        borderRadius: '1px'
                      }} />
                    ))}
                  </div>

                  {/* Points stamp */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    border: '2px dashed var(--rum)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    marginTop: '8px'
                  }}>
                    <Icon name="sparkle" size={16} style={{ color: 'var(--rum)' }} />
                    <span className="num-font" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--black)' }}>
                      1,240 pts
                    </span>
                  </div>

                  {/* Page turn arrows */}
                  {hasTrips && (
                    <button
                      onClick={() => setPassportPage(1)}
                      style={{
                        position: 'absolute',
                        bottom: '16px',
                        right: '16px',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'var(--rum)',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                      }}
                    >
                      <Icon name="chevronRight" size={18} />
                    </button>
                  )}
                </div>
              ) : currentPage?.isActive ? (
                /* ACTIVE TRIP PAGE */
                <div style={{ padding: '24px' }}>
                  <p className="section-eyebrow">IN PROGRESS</p>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--black)', marginBottom: '4px' }}>
                    {currentPage.destination}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--grey)', marginBottom: '20px' }}>{currentPage.date}</p>

                  {/* Line items */}
                  <div style={{ marginBottom: '24px' }}>
                    {currentPage.stops.map(stop => (
                      <div key={stop.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 0',
                        borderBottom: '1px solid var(--light-grey)'
                      }}>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--black)' }}>{stop.vendorName}</p>
                          <p style={{ fontSize: '11px', color: 'var(--grey)' }}>{stop.item}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="num-font" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--black)' }}>
                            ${stop.price}
                          </span>
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '999px',
                            background: stop.status === 'paid' ? 'rgba(0,229,204,0.1)' : 'rgba(255,184,0,0.1)',
                            color: stop.status === 'paid' ? '#00C853' : 'var(--gold)'
                          }}>
                            {stop.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Crew split */}
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--black)', marginBottom: '12px' }}>Your Crew</p>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                    {currentPage.crew.map(member => (
                      <div key={member.id} style={{ textAlign: 'center', flexShrink: 0 }}>
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          background: member.isYou ? 'var(--rum)' : 'var(--light-grey)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 700,
                          color: member.isYou ? 'white' : 'var(--black)',
                          border: member.paid ? '2px solid #00C853' : '2px dashed var(--grey)'
                        }}>
                          {member.name[0]}
                        </div>
                        <p style={{ fontSize: '9px', fontWeight: 600, color: 'var(--black)', marginTop: '4px' }}>{member.name}</p>
                        <p className="num-font" style={{ fontSize: '10px', color: member.paid ? '#00C853' : 'var(--grey)' }}>
                          {member.paid ? 'Paid' : `$${member.amount}`}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <button className="btn btn-primary" style={{ width: '100%', marginBottom: '8px' }}>
                    Pay Your Share
                  </button>
                  <button 
                    className="btn" 
                    onClick={nudgeUnpaid}
                    style={{ 
                      width: '100%', 
                      background: nudged ? 'var(--rum)' : 'var(--light-grey)',
                      color: nudged ? 'white' : 'var(--grey)',
                      height: '44px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {nudged ? 'Nudged!' : 'Nudge Unpaid'}
                  </button>

                  {/* Page nav */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                    <button onClick={() => setPassportPage(passportPage - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey)' }}>
                      <Icon name="back" size={18} />
                    </button>
                    {passportPage < passportPages.length - 1 && (
                      <button onClick={() => setPassportPage(passportPage + 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey)' }}>
                        <Icon name="chevronRight" size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* SEALED TRIP PAGE */
                <div style={{ padding: '24px' }}>
                  <p className="section-eyebrow">SEALED</p>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--black)', marginBottom: '4px' }}>
                    {currentPage?.destination || 'Your First Trip'}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--grey)', marginBottom: '20px' }}>
                    {currentPage?.date || 'Starts here'}
                  </p>

                  {currentPage ? (
                    <>
                      {/* Stamp icons */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                        {currentPage.stops.map(stop => (
                          <div key={stop.id} style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: 'var(--rum)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0.85
                          }}>
                            <Icon name="check" size={20} style={{ color: 'white' }} />
                          </div>
                        ))}
                      </div>
                      <p className="num-font" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--black)' }}>
                        Total: ${currentPage.totalSpent}
                      </p>
                    </>
                  ) : (
                    /* Empty state invitation */
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        border: '2px dashed var(--grey)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px'
                      }}>
                        <Icon name="compass" size={32} style={{ color: 'var(--grey)' }} />
                      </div>
                      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--black)' }}>
                        Your first stop starts here
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--grey)', marginTop: '4px' }}>
                        Plan a trip and collect stamps
                      </p>
                    </div>
                  )}

                  {/* Page nav */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                    {passportPage > 0 && (
                      <button onClick={() => setPassportPage(passportPage - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey)' }}>
                        <Icon name="back" size={18} />
                      </button>
                    )}
                    {passportPage < passportPages.length - 1 && (
                      <button onClick={() => setPassportPage(passportPage + 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey)' }}>
                        <Icon name="chevronRight" size={18} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'scan' && (
          <div>
            {/* Scan view */}
            <div style={{ textAlign: 'center' }}>
              {/* Camera placeholder */}
              <div style={{
                width: '100%',
                height: '320px',
                background: '#1a1530',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                marginBottom: '16px'
              }}>
                {/* Frame guide */}
                <div style={{
                  width: '200px',
                  height: '200px',
                  border: '2px solid rgba(255,255,255,0.5)',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon name="camera" size={48} style={{ color: 'rgba(255,255,255,0.3)' }} />
                </div>

                {/* Flash toggle */}
                <button
                  onClick={() => setFlashOn(!flashOn)}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    width: '36px',
                    height: '36px',
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
                  <Icon name="sparkle" size={16} />
                </button>
              </div>

              <button className="btn btn-primary" style={{ width: '100%', marginBottom: '8px' }} onClick={simulateScan}>
                Simulate Scan
              </button>
              <button className="btn" style={{ 
                width: '100%', 
                background: 'none', 
                color: 'var(--grey)', 
                height: '40px',
                fontSize: '13px'
              }}>
                Enter code manually
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Checkout Sheet */}
      {checkoutOpen && (
        <div className="bottom-sheet-overlay open" onClick={() => setCheckoutOpen(false)} />
      )}
      <div className={`bottom-sheet ${checkoutOpen ? 'open' : ''}`}>
        {checkoutOpen && (
          <div style={{ padding: '20px' }}>
            <div style={{ width: '36px', height: '4px', background: 'var(--light-grey)', borderRadius: '2px', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--black)', marginBottom: '16px' }}>Checkout</h3>

            {/* Amount */}
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--grey)', marginBottom: '4px' }}>Amount</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid var(--light-grey)', background: 'var(--card-bg)', fontSize: '20px', fontWeight: 700, fontFamily: 'Space Mono, monospace', color: 'var(--black)', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                {keys.map(k => (
                  <button
                    key={k}
                    onClick={() => handleKeypad(k)}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      background: 'var(--light-grey)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '15px',
                      fontWeight: 600,
                      color: 'var(--black)',
                      fontFamily: 'inherit'
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment rail */}
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--grey)', marginBottom: '8px' }}>Paying via</p>
              <div style={{ display: 'flex', gap: '6px' }}>
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
            </div>

            {/* Points earned */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '12px', color: 'var(--grey)' }}>
                Points earned: <span className="num-font" style={{ color: 'var(--rum)', fontWeight: 700 }}>+{Math.floor(parseFloat(amount || '0'))}</span>
              </p>
            </div>

            <button className="btn btn-primary" style={{ width: '100%' }} onClick={processPayment}>
              Confirm Payment
            </button>
          </div>
        )}
      </div>

      <Dock />

      <style jsx>{`
        @keyframes stampLand {
          0% { transform: scale(2); opacity: 0; }
          50% { transform: scale(0.9); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </main>
  )
}