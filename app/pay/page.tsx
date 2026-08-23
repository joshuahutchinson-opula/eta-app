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

interface PassportPage {
  id: string
  destination: string
  date: string
  totalSpent: number
  stops: TripStop[]
  crew: CrewMember[]
  isActive: boolean
  isSealed: boolean
}

const MOCK_TRIPS: PassportPage[] = [
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
    setCheckoutOpen(true)
  }

  const processPayment = () => {
    setCheckoutOpen(false)
    setStampAnimating(true)
    setTimeout(() => {
      setStampAnimating(false)
      setAmount('')
    }, 1200)
  }

  const nudgeUnpaid = () => {
    setNudged(true)
    setTimeout(() => setNudged(false), 2000)
  }

  const passportPages: PassportPage[] = MOCK_TRIPS
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
            {/* PASSPORT BOOK */}
            <div style={{ position: 'relative', minHeight: '520px' }}>
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
                    width: '90px',
                    height: '90px',
                    borderRadius: '50%',
                    background: 'rgba(255, 75, 43, 0.85)',
                    border: '3px solid rgba(15, 14, 12, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: 'rotate(-12deg)',
                    animation: 'stampLand 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 0 8px rgba(0,0,0,0.2)'
                  }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'white', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      Stamped
                    </span>
                  </div>
                </div>
              )}

              {isCover ? (
                /* PASSPORT COVER - Dark rum leather */
                <div style={{
                  minHeight: '520px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #8B1A0A 0%, #C9301A 30%, #6B1508 60%, #8B1A0A 100%)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.3)',
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '32px 24px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  {/* Leather texture overlay */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(0,0,0,0.3) 0%, transparent 50%), repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 2px, transparent 2px, transparent 4px)',
                    pointerEvents: 'none'
                  }} />

                  {/* Embossed crest */}
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    border: '3px solid rgba(255, 184, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '20px',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4), 0 2px 4px rgba(255,255,255,0.1)'
                  }}>
                    <Icon name="sparkle" size={36} style={{ color: '#FFB800' }} />
                  </div>

                  {/* Gold foil title */}
                  <h1 style={{
                    fontFamily: 'Georgia, serif',
                    fontSize: '28px',
                    fontWeight: 700,
                    letterSpacing: '4px',
                    color: '#FFB800',
                    textShadow: '0 2px 4px rgba(0,0,0,0.5), 0 0 20px rgba(255,184,0,0.3)',
                    marginBottom: '8px'
                  }}>
                    ETA
                  </h1>
                  <p style={{
                    fontFamily: 'Georgia, serif',
                    fontSize: '11px',
                    letterSpacing: '3px',
                    color: 'rgba(255, 184, 0, 0.8)',
                    textTransform: 'uppercase',
                    marginBottom: '24px'
                  }}>
                    Experience Travel Adventure
                  </p>

                  {/* Passport number */}
                  <div style={{
                    fontFamily: 'Space Mono, monospace',
                    fontSize: '10px',
                    color: 'rgba(255, 255, 255, 0.5)',
                    letterSpacing: '2px',
                    marginTop: '8px'
                  }}>
                    PASSPORT No. ETA-2026-0042
                  </div>

                  {/* Page turn */}
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
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,184,0,0.4)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFB800'
                      }}
                    >
                      <Icon name="chevronRight" size={18} />
                    </button>
                  )}
                </div>
              ) : (
                /* PASSPORT INTERIOR - Cream paper */
                <div style={{
                  minHeight: '520px',
                  borderRadius: '12px',
                  background: '#FBF5EC',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.05)',
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '24px 20px'
                }}>
                  {/* Paper texture */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.02) 0px, rgba(0,0,0,0.02) 1px, transparent 1px, transparent 3px), radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.5) 0%, rgba(0,0,0,0.03) 100%)',
                    pointerEvents: 'none'
                  }} />

                  {/* Red rum page border lines */}
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    right: '12px',
                    bottom: '12px',
                    border: '1px solid rgba(255, 75, 43, 0.3)',
                    borderRadius: '4px',
                    pointerEvents: 'none'
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    left: '16px',
                    right: '16px',
                    bottom: '16px',
                    border: '1px solid rgba(255, 75, 43, 0.15)',
                    borderRadius: '3px',
                    pointerEvents: 'none'
                  }} />

                  <div style={{ position: 'relative', zIndex: 1 }}>
                    {currentPage?.isActive ? (
                      /* ACTIVE TRIP - In progress */
                      <div>
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                          <p style={{
                            fontFamily: 'Georgia, serif',
                            fontSize: '10px',
                            letterSpacing: '2px',
                            color: 'var(--rum)',
                            textTransform: 'uppercase',
                            marginBottom: '4px'
                          }}>
                            In Progress
                          </p>
                          <h3 style={{
                            fontFamily: 'Georgia, serif',
                            fontSize: '20px',
                            fontWeight: 700,
                            color: '#0F0E0C',
                            marginBottom: '2px'
                          }}>
                            {currentPage.destination}
                          </h3>
                          <p style={{
                            fontFamily: 'Georgia, serif',
                            fontSize: '11px',
                            fontStyle: 'italic',
                            color: '#717171'
                          }}>
                            {currentPage.date}
                          </p>
                        </div>

                        {/* Line items */}
                        <div style={{ marginBottom: '20px' }}>
                          {currentPage.stops.map(stop => (
                            <div key={stop.id} style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 0',
                              borderBottom: '1px dashed rgba(0,0,0,0.1)'
                            }}>
                              <div>
                                <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F0E0C', fontFamily: 'Georgia, serif' }}>{stop.vendorName}</p>
                                <p style={{ fontSize: '10px', color: '#717171', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{stop.item}</p>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="num-font" style={{ fontSize: '12px', fontWeight: 700, color: '#0F0E0C' }}>
                                  ${stop.price}
                                </span>
                                {/* Ink stamp style */}
                                <span style={{
                                  fontSize: '8px',
                                  fontWeight: 700,
                                  padding: '3px 6px',
                                  border: '2px solid',
                                  borderColor: stop.status === 'paid' ? 'rgba(0,200,83,0.5)' : 'rgba(255,184,0,0.5)',
                                  borderRadius: '3px',
                                  transform: 'rotate(-6deg)',
                                  color: stop.status === 'paid' ? 'rgba(0,150,60,0.7)' : 'rgba(200,140,0,0.7)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '1px',
                                  fontFamily: 'Georgia, serif'
                                }}>
                                  {stop.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Crew split */}
                        <p style={{
                          fontFamily: 'Georgia, serif',
                          fontSize: '11px',
                          letterSpacing: '1px',
                          color: '#717171',
                          textTransform: 'uppercase',
                          marginBottom: '10px'
                        }}>
                          Crew
                        </p>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                          {currentPage.crew.map(member => (
                            <div key={member.id} style={{ textAlign: 'center', flexShrink: 0 }}>
                              <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: member.isYou ? 'var(--rum)' : 'rgba(0,0,0,0.08)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '13px',
                                fontWeight: 700,
                                color: member.isYou ? 'white' : '#0F0E0C',
                                border: member.paid ? '2px solid rgba(0,150,60,0.6)' : '2px dashed rgba(0,0,0,0.3)'
                              }}>
                                {member.name[0]}
                              </div>
                              <p style={{ fontSize: '8px', fontWeight: 600, color: '#0F0E0C', marginTop: '4px', fontFamily: 'Georgia, serif' }}>{member.name}</p>
                              <p className="num-font" style={{ fontSize: '9px', color: member.paid ? 'rgba(0,150,60,0.7)' : '#717171' }}>
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
                            background: nudged ? 'var(--rum)' : 'rgba(0,0,0,0.06)',
                            color: nudged ? 'white' : '#717171',
                            height: '44px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {nudged ? 'Nudged!' : 'Nudge Unpaid'}
                        </button>
                      </div>
                    ) : (
                      /* SEALED TRIP - Stamped page */
                      <div>
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                          <p style={{
                            fontFamily: 'Georgia, serif',
                            fontSize: '10px',
                            letterSpacing: '2px',
                            color: 'rgba(0,150,60,0.6)',
                            textTransform: 'uppercase',
                            marginBottom: '4px'
                          }}>
                            Sealed
                          </p>
                          <h3 style={{
                            fontFamily: 'Georgia, serif',
                            fontSize: '20px',
                            fontWeight: 700,
                            color: '#0F0E0C',
                            marginBottom: '2px'
                          }}>
                            {currentPage?.destination || 'Your First Trip'}
                          </h3>
                          <p style={{
                            fontFamily: 'Georgia, serif',
                            fontSize: '11px',
                            fontStyle: 'italic',
                            color: '#717171'
                          }}>
                            {currentPage?.date || 'Starts here'}
                          </p>
                        </div>

                        {currentPage ? (
                          <>
                            {/* Stamp icons - rotated ink style */}
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', justifyContent: 'center' }}>
                              {currentPage.stops.map((stop, i) => (
                                <div key={stop.id} style={{
                                  width: '50px',
                                  height: '50px',
                                  borderRadius: '50%',
                                  border: '3px solid rgba(255, 75, 43, 0.6)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transform: `rotate(${-6 + (i * 4)}deg)`,
                                  background: 'rgba(255, 75, 43, 0.05)',
                                  boxShadow: 'inset 0 0 6px rgba(255,75,43,0.2)'
                                }}>
                                  <span style={{ fontSize: '7px', fontWeight: 800, color: 'rgba(255, 75, 43, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'Georgia, serif' }}>
                                    {stop.vendorName.slice(0, 3)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <p className="num-font" style={{ fontSize: '13px', fontWeight: 700, color: '#0F0E0C', textAlign: 'center', fontFamily: 'Georgia, serif' }}>
                              Total: ${currentPage.totalSpent}
                            </p>
                          </>
                        ) : (
                          /* Empty state invitation */
                          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <div style={{
                              width: '80px',
                              height: '80px',
                              borderRadius: '50%',
                              border: '2px dashed rgba(255, 75, 43, 0.4)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              margin: '0 auto 16px',
                              background: 'rgba(255, 75, 43, 0.03)'
                            }}>
                              <Icon name="compass" size={32} style={{ color: 'rgba(255, 75, 43, 0.5)' }} />
                            </div>
                            <p style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: 600, color: '#0F0E0C' }}>
                              Your first stop starts here
                            </p>
                            <p style={{ fontFamily: 'Georgia, serif', fontSize: '12px', fontStyle: 'italic', color: '#717171', marginTop: '4px' }}>
                              Plan a trip and collect stamps
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Page nav */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', position: 'relative', zIndex: 1 }}>
                      {passportPage > 0 && (
                        <button onClick={() => setPassportPage(passportPage - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#717171' }}>
                          <Icon name="back" size={18} />
                        </button>
                      )}
                      {passportPage < passportPages.length - 1 && (
                        <button onClick={() => setPassportPage(passportPage + 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#717171' }}>
                          <Icon name="chevronRight" size={18} />
                        </button>
                      )}
                    </div>
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

            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--grey)', marginBottom: '4px' }}>Amount</p>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--light-grey)', background: 'var(--card-bg)', fontSize: '20px', fontWeight: 700, fontFamily: 'Space Mono, monospace', color: 'var(--black)', outline: 'none', marginBottom: '8px' }}
              />
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
          0% { transform: scale(2) rotate(-12deg); opacity: 0; }
          50% { transform: scale(0.9) rotate(-12deg); opacity: 1; }
          100% { transform: scale(1) rotate(-12deg); opacity: 1; }
        }
      `}</style>
    </main>
  )
}