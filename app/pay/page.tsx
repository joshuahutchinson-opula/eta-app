// app/pay/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'

type PaymentStatus = 'paid' | 'pending' | 'failed' | 'queued' | 'refunded'
type Rail = 'JAM-DEX' | 'Lynk' | 'Stripe'

interface TripStop {
  id: string
  vendorName: string
  item: string
  price: number
  status: PaymentStatus
  category: string
}

interface CrewMember {
  id: string
  name: string
  amount: number
  paid: boolean
  isYou: boolean
}

interface TripPhoto {
  url: string | null
  caption: string
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
  highlight?: string
  photo?: TripPhoto | null
}

const MOCK_TRIPS: PassportPage[] = [
  {
    id: 'trip-1',
    destination: 'Full Moon Float',
    date: 'Aug 15, 2026',
    totalSpent: 185,
    isActive: true,
    isSealed: false,
    highlight: 'Best bite: Push Cart\'s jerk chicken',
    photo: {
      url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=300&fit=crop',
      caption: 'Sunset at the cliffs'
    },
    stops: [
      { id: 's1', vendorName: 'Push Cart', item: 'Jerk Chicken Plate', price: 45, status: 'paid', category: 'FOOD' },
      { id: 's2', vendorName: 'Coral Reef Bar', item: 'Rum Punch Flight', price: 30, status: 'paid', category: 'DRINKS' },
      { id: 's3', vendorName: 'MoBay Watersports', item: 'Catamaran Cruise', price: 110, status: 'pending', category: 'ACTIVITY' },
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
    highlight: 'Lobster was unreal',
    photo: {
      url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop',
      caption: 'Golden hour dinner'
    },
    stops: [
      { id: 's4', vendorName: 'Cliffside Grill', item: 'Lobster Dinner', price: 140, status: 'paid', category: 'FOOD' },
      { id: 's5', vendorName: 'Coral Reef Bar', item: 'Cocktails', price: 70, status: 'paid', category: 'DRINKS' },
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
    highlight: 'The pepper sauce is no joke',
    stops: [
      { id: 's6', vendorName: 'Push Cart', item: 'Jerk Pork', price: 40, status: 'paid', category: 'FOOD' },
      { id: 's7', vendorName: 'Blue Mahoe', item: 'Coffee Flight', price: 35, status: 'paid', category: 'FOOD' },
    ],
    crew: [
      { id: 'c6', name: 'You', amount: 75, paid: true, isYou: true },
    ],
  },
]

const COLLECTION_LIST = [
  { name: 'Push Cart', category: 'FOOD', visited: true },
  { name: 'Coral Reef Bar', category: 'DRINKS', visited: true },
  { name: 'Cliffside Grill', category: 'FOOD', visited: true },
  { name: 'MoBay Watersports', category: 'ACTIVITY', visited: true },
  { name: 'Blue Mahoe', category: 'FOOD', visited: true },
  { name: 'Island Wellness', category: 'WELLNESS', visited: false },
  { name: 'Doctor\'s Cave', category: 'BEACH', visited: false },
  { name: 'Rasta Taxi', category: 'TRANSPORT', visited: false },
]

const MILESTONES = [
  { id: 'm1', title: 'First Trip', achieved: true, icon: 'compass' },
  { id: 'm2', title: '5 Trips', achieved: false, icon: 'sparkle' },
  { id: 'm3', title: 'Foodie', achieved: true, icon: 'food' },
  { id: 'm4', title: 'Water Baby', achieved: true, icon: 'activity' },
]

function getStampClass(category: string): string {
  switch (category) {
    case 'FOOD': return 'stamp-food'
    case 'DRINKS': return 'stamp-drinks'
    case 'ACTIVITY': return 'stamp-activity'
    case 'WELLNESS': return 'stamp-wellness'
    case 'BEACH': return 'stamp-beach'
    case 'TRANSPORT': return 'stamp-transport'
    default: return 'stamp-food'
  }
}

function getStampIcon(category: string): string {
  switch (category) {
    case 'FOOD': return 'food'
    case 'DRINKS': return 'drink'
    case 'ACTIVITY': return 'activity'
    case 'WELLNESS': return 'wellness'
    case 'BEACH': return 'sun'
    case 'TRANSPORT': return 'compass'
    default: return 'sparkle'
  }
}

export default function PayPage() {
  const router = useRouter()
  const [view, setView] = useState<'passport' | 'scan'>('passport')
  const [pageIndex, setPageIndex] = useState(1) // Start on bio page, not cover
  const [turning, setTurning] = useState(false)
  const [sheenActive, setSheenActive] = useState(false)
  const [amount, setAmount] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [stampAnimating, setStampAnimating] = useState(false)
  const [rail, setRail] = useState<Rail>('JAM-DEX')
  const [autoRouting, setAutoRouting] = useState(true)
  const [nudged, setNudged] = useState(false)
  const [nudgeCooldown, setNudgeCooldown] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const [manualCode, setManualCode] = useState(false)
  const [manualInput, setManualInput] = useState('')

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

  const totalLeaves = 1 + 1 + MOCK_TRIPS.length + 1 + 1 // Cover + Bio + Trips + Collection + Milestones

  const turnPage = (direction: 'next' | 'prev') => {
    if (turning) return
    const target = direction === 'next' ? pageIndex + 1 : pageIndex - 1
    if (target < 0 || target > totalLeaves) return
    setTurning(true)
    setSheenActive(true)
    setTimeout(() => {
      setPageIndex(target)
      setTurning(false)
      setSheenActive(false)
    }, 350)
  }

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
    if (nudgeCooldown) return
    setNudged(true)
    setNudgeCooldown(true)
    setTimeout(() => setNudged(false), 2000)
    setTimeout(() => setNudgeCooldown(false), 60000)
  }

  const handleSwipe = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    const startX = touch.clientX
    const handleMove = (ev: TouchEvent) => {
      const dx = ev.touches[0].clientX - startX
      if (dx > 50) turnPage('prev')
      if (dx < -50) turnPage('next')
      document.removeEventListener('touchmove', handleMove)
    }
    document.addEventListener('touchmove', handleMove, { once: true })
  }

  const currentTripIndex = pageIndex - 2 // After cover(0) and bio(1)
  const isCover = pageIndex === 0
  const isBio = pageIndex === 1
  const isCollection = pageIndex === 2 + MOCK_TRIPS.length
  const isMilestone = pageIndex === 3 + MOCK_TRIPS.length
  const currentTrip = !isCover && !isBio && !isCollection && !isMilestone && currentTripIndex >= 0 && currentTripIndex < MOCK_TRIPS.length
    ? MOCK_TRIPS[currentTripIndex]
    : null

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
          <div className="passport-book" onTouchStart={handleSwipe}>
            {/* Spine */}
            <div className="passport-spine">
              <div className="passport-stitch" />
            </div>

            {/* Page edge */}
            <div className="passport-page-edge" />

            {/* Sheen */}
            {sheenActive && <div className="passport-sheen" />}

            {/* Stamp animation */}
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
                  border: '4px solid var(--gold)',
                  background: 'rgba(255, 184, 0, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: 'rotate(-12deg)',
                  animation: 'stampLand 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                  boxShadow: '0 0 12px rgba(255,184,0,0.4), inset 0 0 8px rgba(255,184,0,0.2)'
                }}>
                  <Icon name="sparkle" size={36} style={{ color: 'var(--gold)' }} />
                </div>
              </div>
            )}

            {/* COVER */}
            <div className={`passport-leaf ${pageIndex === 0 ? '' : 'turned'}`} style={{ zIndex: pageIndex === 0 ? 10 : 1 }}>
              <div className="passport-face front">
                <div style={{
                  minHeight: '520px',
                  background: 'linear-gradient(155deg, #9c2812, #6e1a0c 55%, #4d1207)',
                  borderRadius: 'var(--radius-card)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '32px 24px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  {/* Grain texture */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(0,0,0,0.3) 0%, transparent 50%), repeating-linear-gradient(45deg, rgba(255,255,255,0.01) 0px, rgba(255,255,255,0.01) 2px, transparent 2px, transparent 4px)',
                    pointerEvents: 'none'
                  }} />

                  {/* Inset frame */}
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    left: '16px',
                    right: '16px',
                    bottom: '16px',
                    border: '1px solid rgba(255, 184, 0, 0.4)',
                    borderRadius: '8px',
                    pointerEvents: 'none'
                  }} />

                  {/* Gold crest */}
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    border: '3px solid var(--gold)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '20px',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4), 0 0 20px rgba(255,184,0,0.2)'
                  }}>
                    <Icon name="sparkle" size={36} style={{ color: 'var(--gold)' }} />
                  </div>

                  {/* ETA wordmark */}
                  <h1 style={{
                    fontFamily: 'Georgia, serif',
                    fontSize: '32px',
                    fontWeight: 700,
                    letterSpacing: '6px',
                    color: 'var(--gold)',
                    textShadow: '0 1px 0 rgba(0,0,0,0.6), 0 0 20px rgba(255,184,0,0.3)',
                    marginBottom: '8px'
                  }}>
                    ETA
                  </h1>
                  <p style={{
                    fontFamily: 'Georgia, serif',
                    fontSize: '10px',
                    letterSpacing: '3px',
                    color: 'rgba(255, 184, 0, 0.7)',
                    textTransform: 'uppercase',
                    marginBottom: '16px'
                  }}>
                    Experience Travel Adventure
                  </p>

                  {/* Member since */}
                  <p style={{
                    fontFamily: 'Georgia, serif',
                    fontSize: '10px',
                    fontStyle: 'italic',
                    color: 'rgba(255, 255, 255, 0.4)',
                    marginBottom: '24px'
                  }}>
                    Member since January 2025
                  </p>

                  {/* Region stamps border */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '16px' }}>
                    {['Negril', 'Montego Bay', 'Ocho Rios'].map(region => (
                      <div key={region} style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        border: region === 'Negril' ? '2px solid var(--gold)' : '2px dashed rgba(255,255,255,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '7px',
                        fontWeight: 700,
                        color: region === 'Negril' ? 'var(--gold)' : 'rgba(255,255,255,0.3)',
                        textTransform: 'uppercase',
                        fontFamily: 'Georgia, serif'
                      }}>
                        {region.slice(0, 2)}
                      </div>
                    ))}
                  </div>

                  {/* Passport number */}
                  <div style={{
                    fontFamily: 'Space Mono, monospace',
                    fontSize: '9px',
                    color: 'rgba(255, 255, 255, 0.3)',
                    letterSpacing: '2px',
                    marginTop: '8px'
                  }}>
                    PASSPORT No. ETA-2026-0042
                  </div>
                </div>
              </div>
              <div className="passport-face back">
                <div style={{ minHeight: '520px', background: '#FBF5EC', borderRadius: 'var(--radius-card)' }} />
              </div>
            </div>

            {/* BIO PAGE */}
            <div className={`passport-leaf ${pageIndex <= 1 ? '' : 'turned'}`} style={{ zIndex: pageIndex <= 1 ? 5 : 1 }}>
              <div className="passport-face front">
                <div style={{
                  minHeight: '520px',
                  background: '#FBF5EC',
                  borderRadius: 'var(--radius-card)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '24px 20px'
                }}>
                  {/* Paper texture */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.02) 0px, rgba(0,0,0,0.02) 1px, transparent 1px, transparent 3px)',
                    pointerEvents: 'none'
                  }} />

                  {/* Red rum border */}
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

                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                      {/* Photo */}
                      <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 8px',
                        overflow: 'hidden'
                      }}>
                        <Icon name="user" size={28} style={{ color: 'var(--grey)' }} />
                      </div>
                      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#0F0E0C' }}>
                        Jordan Hutchinson
                      </h2>
                      <div style={{
                        display: 'inline-block',
                        marginTop: '6px',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        background: 'var(--rum)',
                        color: 'white',
                        fontSize: '9px',
                        fontWeight: 700,
                        letterSpacing: '1px',
                        textTransform: 'uppercase'
                      }}>
                        Gold Member
                      </div>
                    </div>

                    {/* Lifetime stats */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-around',
                      textAlign: 'center',
                      marginBottom: '20px',
                      padding: '12px 0',
                      borderTop: '1px dashed rgba(0,0,0,0.1)',
                      borderBottom: '1px dashed rgba(0,0,0,0.1)'
                    }}>
                      <div>
                        <p className="num-font" style={{ fontSize: '18px', fontWeight: 700, color: '#0F0E0C' }}>3</p>
                        <p style={{ fontSize: '8px', color: 'var(--grey)', textTransform: 'uppercase', letterSpacing: '1px' }}>Trips</p>
                      </div>
                      <div>
                        <p className="num-font" style={{ fontSize: '18px', fontWeight: 700, color: '#0F0E0C' }}>5</p>
                        <p style={{ fontSize: '8px', color: 'var(--grey)', textTransform: 'uppercase', letterSpacing: '1px' }}>Vendors</p>
                      </div>
                      <div>
                        <p className="num-font" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--rum)' }}>$470</p>
                        <p style={{ fontSize: '8px', color: 'var(--grey)', textTransform: 'uppercase', letterSpacing: '1px' }}>Spent</p>
                      </div>
                    </div>

                    {/* Mission line */}
                    <p style={{
                      fontFamily: 'Georgia, serif',
                      fontStyle: 'italic',
                      fontSize: '11px',
                      color: 'var(--grey)',
                      textAlign: 'center',
                      marginBottom: '20px'
                    }}>
                      $470 spent · 5 local vendors supported
                    </p>

                    {/* Payment medallions */}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
                      {['JAM-DEX', 'Lynk', 'Stripe'].map(method => (
                        <div key={method} style={{
                          padding: '6px 10px',
                          borderRadius: '999px',
                          background: 'rgba(0,0,0,0.05)',
                          fontSize: '9px',
                          fontWeight: 600,
                          color: 'var(--grey)'
                        }}>
                          {method}
                        </div>
                      ))}
                    </div>

                    {/* Dummy QR */}
                    <div style={{
                      width: '120px',
                      height: '120px',
                      margin: '0 auto 8px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(10, 1fr)',
                      gap: '1px',
                      padding: '10px',
                      background: 'white',
                      borderRadius: '8px',
                      boxShadow: 'var(--card-shadow)',
                      border: '1px solid var(--light-grey)'
                    }}>
                      {[...Array(100)].map((_, i) => (
                        <div key={i} style={{
                          background: (i * 7 + i * i) % 3 === 0 ? '#0F0E0C' : 'transparent',
                          borderRadius: '1px'
                        }} />
                      ))}
                    </div>
                    <p style={{
                      fontFamily: 'Georgia, serif',
                      fontStyle: 'italic',
                      fontSize: '9px',
                      color: 'var(--grey)',
                      textAlign: 'center'
                    }}>
                      Vendors scan this — they'll see you're a Gold Member
                    </p>

                    {/* MRZ line */}
                    <div style={{
                      fontFamily: 'Space Mono, monospace',
                      fontSize: '7px',
                      color: 'rgba(0,0,0,0.3)',
                      letterSpacing: '1px',
                      textAlign: 'center',
                      marginTop: '16px'
                    }}>
                      P&lt;JAMHUTCHINSON&lt;&lt;JORDAN&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
                    </div>
                  </div>
                </div>
              </div>
              <div className="passport-face back">
                <div style={{ minHeight: '520px', background: '#FBF5EC', borderRadius: 'var(--radius-card)' }} />
              </div>
            </div>

            {/* TRIP PAGES */}
            {MOCK_TRIPS.map((trip, index) => {
              const leafIndex = 2 + index
              const isActiveLeaf = pageIndex === leafIndex
              return (
                <div 
                  key={trip.id} 
                  className={`passport-leaf ${pageIndex <= leafIndex ? '' : 'turned'}`} 
                  style={{ zIndex: pageIndex <= leafIndex ? 3 : 1 }}
                >
                  <div className="passport-face front">
                    <div style={{
                      minHeight: '520px',
                      background: '#FBF5EC',
                      borderRadius: 'var(--radius-card)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      position: 'relative',
                      overflow: 'hidden',
                      padding: '24px 20px'
                    }}>
                      {/* Paper texture */}
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.02) 0px, rgba(0,0,0,0.02) 1px, transparent 1px, transparent 3px)',
                        pointerEvents: 'none'
                      }} />

                      {/* Red rum border */}
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

                      <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                          <p style={{
                            fontFamily: 'Georgia, serif',
                            fontSize: '9px',
                            letterSpacing: '2px',
                            color: trip.isActive ? 'var(--rum)' : 'rgba(0,150,60,0.6)',
                            textTransform: 'uppercase',
                            marginBottom: '4px'
                          }}>
                            {trip.isActive ? 'In Progress' : 'Sealed'}
                          </p>
                          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#0F0E0C' }}>
                            {trip.destination}
                          </h3>
                          <p className="caption-font" style={{ fontSize: '10px', color: 'var(--grey)' }}>
                            {trip.date}
                          </p>
                        </div>

                        {/* Crew avatars */}
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '16px' }}>
                          {trip.crew.map(member => (
                            <div key={member.id} style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: member.isYou ? 'var(--rum)' : 'rgba(0,0,0,0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 700,
                              color: member.isYou ? 'white' : '#0F0E0C'
                            }}>
                              {member.name[0]}
                            </div>
                          ))}
                        </div>

                        {/* Trip photo polaroid */}
                        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                          {trip.photo?.url ? (
                            <div className="polaroid" style={{ width: '120px', transform: 'rotate(-3deg)' }}>
                              <div className="tape-strip" />
                              <img src={trip.photo.url} alt={trip.photo.caption} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '2px' }} />
                              <div className="polaroid-caption" style={{ fontSize: '9px' }}>{trip.photo.caption}</div>
                            </div>
                          ) : (
                            <div className="polaroid" style={{ width: '120px', transform: 'rotate(-3deg)', opacity: 0.5 }}>
                              <div className="tape-strip" />
                              <div style={{ width: '100%', height: '80px', borderRadius: '2px', border: '2px dashed rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon name="camera" size={20} style={{ color: 'rgba(0,0,0,0.3)' }} />
                              </div>
                              <div className="polaroid-caption" style={{ fontSize: '9px' }}>Add a photo</div>
                            </div>
                          )}
                        </div>

                        {/* Highlight */}
                        {trip.highlight && (
                          <p className="caption-font" style={{
                            fontSize: '11px',
                            color: 'var(--grey)',
                            textAlign: 'center',
                            marginBottom: '16px',
                            fontStyle: 'italic'
                          }}>
                            "{trip.highlight}"
                          </p>
                        )}

                        {/* Stamps */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '16px' }}>
                          {trip.stops.map(stop => (
                            <button
                              key={stop.id}
                              className={getStampClass(stop.category)}
                              onClick={() => router.push(`/vendor/${stop.vendorName.toLowerCase().replace(/[^a-z]/g, '-')}`)}
                              style={{
                                width: '44px',
                                height: '44px',
                                border: '2px solid rgba(255, 75, 43, 0.5)',
                                background: 'rgba(255, 75, 43, 0.04)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              <Icon name={getStampIcon(stop.category) as any} size={18} style={{ color: 'rgba(255, 75, 43, 0.6)' }} />
                            </button>
                          ))}
                        </div>

                        {/* Active trip details */}
                        {trip.isActive && (
                          <div>
                            <div style={{ marginBottom: '12px' }}>
                              {trip.stops.map(stop => (
                                <div key={stop.id} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 0',
                                  borderBottom: '1px dashed rgba(0,0,0,0.08)'
                                }}>
                                  <div>
                                    <p style={{ fontSize: '11px', fontWeight: 600, color: '#0F0E0C', fontFamily: 'Georgia, serif' }}>{stop.vendorName}</p>
                                    <p style={{ fontSize: '9px', color: 'var(--grey)', fontStyle: 'italic' }}>{stop.item}</p>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="num-font" style={{ fontSize: '10px', fontWeight: 700, color: '#0F0E0C' }}>${stop.price}</span>
                                    <span style={{
                                      fontSize: '7px',
                                      fontWeight: 700,
                                      padding: '2px 5px',
                                      border: '1.5px solid',
                                      borderColor: stop.status === 'paid' ? 'rgba(0,200,83,0.5)' : stop.status === 'queued' ? 'rgba(255,184,0,0.5)' : 'rgba(0,229,204,0.5)',
                                      borderRadius: '2px',
                                      transform: 'rotate(-5deg)',
                                      color: stop.status === 'paid' ? 'rgba(0,150,60,0.7)' : stop.status === 'queued' ? 'rgba(200,140,0,0.7)' : '#00E5CC',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.5px',
                                      fontFamily: 'Georgia, serif'
                                    }}>
                                      {stop.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Crew split */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                              {trip.crew.map(member => (
                                <div key={member.id} style={{ textAlign: 'center', flexShrink: 0 }}>
                                  <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    background: member.isYou ? 'var(--rum)' : 'rgba(0,0,0,0.08)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: member.isYou ? 'white' : '#0F0E0C',
                                    border: member.paid ? '2px solid rgba(0,150,60,0.6)' : '2px dashed rgba(0,0,0,0.3)'
                                  }}>
                                    {member.name[0]}
                                  </div>
                                  <p style={{ fontSize: '7px', fontWeight: 600, color: '#0F0E0C', marginTop: '2px', fontFamily: 'Georgia, serif' }}>{member.name}</p>
                                  <p className="num-font" style={{ fontSize: '8px', color: member.paid ? 'rgba(0,150,60,0.7)' : 'var(--grey)' }}>
                                    {member.paid ? 'Paid' : `$${member.amount}`}
                                  </p>
                                </div>
                              ))}
                            </div>

                            <button className="btn btn-primary" style={{ width: '100%', height: '40px', marginBottom: '6px', fontSize: '13px' }}>
                              Pay Your Share
                            </button>
                            <button 
                              className="btn" 
                              onClick={nudgeUnpaid}
                              disabled={nudgeCooldown}
                              style={{ 
                                width: '100%', 
                                background: nudged ? 'var(--rum)' : 'rgba(0,0,0,0.05)',
                                color: nudged ? 'white' : nudgeCooldown ? 'rgba(0,0,0,0.3)' : 'var(--grey)',
                                height: '36px',
                                fontSize: '12px',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              {nudged ? 'Nudged!' : nudgeCooldown ? 'Nudge sent' : 'Nudge Unpaid'}
                            </button>
                          </div>
                        )}

                        {/* Total for sealed trips */}
                        {trip.isSealed && (
                          <p className="num-font" style={{ fontSize: '12px', fontWeight: 700, color: '#0F0E0C', textAlign: 'center', fontFamily: 'Georgia, serif' }}>
                            Total: ${trip.totalSpent}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="passport-face back">
                    <div style={{ minHeight: '520px', background: '#FBF5EC', borderRadius: 'var(--radius-card)' }} />
                  </div>
                </div>
              )
            })}

            {/* COLLECTION PAGE */}
            <div className={`passport-leaf ${pageIndex <= 2 + MOCK_TRIPS.length ? '' : 'turned'}`} style={{ zIndex: pageIndex <= 2 + MOCK_TRIPS.length ? 2 : 1 }}>
              <div className="passport-face front">
                <div style={{
                  minHeight: '520px',
                  background: '#FBF5EC',
                  borderRadius: 'var(--radius-card)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '24px 20px'
                }}>
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.02) 0px, rgba(0,0,0,0.02) 1px, transparent 1px, transparent 3px)',
                    pointerEvents: 'none'
                  }} />
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

                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                      <p style={{
                        fontFamily: 'Georgia, serif',
                        fontSize: '9px',
                        letterSpacing: '2px',
                        color: 'var(--rum)',
                        textTransform: 'uppercase',
                        marginBottom: '4px'
                      }}>
                        Collection
                      </p>
                      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#0F0E0C' }}>
                        Negril Spots
                      </h3>
                      <p className="num-font" style={{ fontSize: '11px', color: 'var(--grey)' }}>
                        5/8 collected
                      </p>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      {COLLECTION_LIST.map(item => (
                        <div key={item.name} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 0',
                          borderBottom: '1px dashed rgba(0,0,0,0.08)',
                          opacity: item.visited ? 1 : 0.4
                        }}>
                          <div className={getStampClass(item.category)} style={{
                            width: '32px',
                            height: '32px',
                            border: item.visited ? '2px solid rgba(255, 75, 43, 0.6)' : '2px dashed rgba(0,0,0,0.2)',
                            background: item.visited ? 'rgba(255, 75, 43, 0.05)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Icon name={getStampIcon(item.category) as any} size={14} style={{ color: item.visited ? 'rgba(255, 75, 43, 0.6)' : 'rgba(0,0,0,0.2)' }} />
                          </div>
                          <div>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: '#0F0E0C', fontFamily: 'Georgia, serif' }}>{item.name}</p>
                            <p style={{ fontSize: '9px', color: 'var(--grey)' }}>{item.category}</p>
                          </div>
                          {item.visited && (
                            <Icon name="check" size={14} style={{ color: 'rgba(0,150,60,0.6)', marginLeft: 'auto' }} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="passport-face back">
                <div style={{ minHeight: '520px', background: '#FBF5EC', borderRadius: 'var(--radius-card)' }} />
              </div>
            </div>

            {/* MILESTONE PAGE */}
            <div className={`passport-leaf ${pageIndex <= 3 + MOCK_TRIPS.length ? '' : 'turned'}`} style={{ zIndex: pageIndex <= 3 + MOCK_TRIPS.length ? 1 : 1 }}>
              <div className="passport-face front">
                <div style={{
                  minHeight: '520px',
                  background: '#FBF5EC',
                  borderRadius: 'var(--radius-card)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '24px 20px'
                }}>
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.02) 0px, rgba(0,0,0,0.02) 1px, transparent 1px, transparent 3px)',
                    pointerEvents: 'none'
                  }} />
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

                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                      <p style={{
                        fontFamily: 'Georgia, serif',
                        fontSize: '9px',
                        letterSpacing: '2px',
                        color: 'var(--gold)',
                        textTransform: 'uppercase',
                        marginBottom: '4px'
                      }}>
                        Milestones
                      </p>
                      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#0F0E0C' }}>
                        Achievements
                      </h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {MILESTONES.map(m => (
                        <div key={m.id} className={m.achieved ? 'milestone-stamp' : ''} style={{
                          padding: '16px',
                          textAlign: 'center',
                          borderRadius: '50%',
                          width: '100px',
                          height: '100px',
                          margin: '0 auto',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: m.achieved ? 1 : 0.4,
                          border: m.achieved ? '4px solid var(--gold)' : '2px dashed rgba(0,0,0,0.2)'
                        }}>
                          <Icon name={m.icon as any} size={24} style={{ color: m.achieved ? 'var(--gold)' : 'rgba(0,0,0,0.3)' }} />
                          <p style={{ fontSize: '8px', fontWeight: 700, color: m.achieved ? '#0F0E0C' : 'var(--grey)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            {m.title}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="passport-face back">
                <div style={{ minHeight: '520px', background: '#FBF5EC', borderRadius: 'var(--radius-card)' }} />
              </div>
            </div>

            {/* Navigation arrows */}
            <div style={{ position: 'absolute', bottom: '-48px', left: '0', right: '0', display: 'flex', justifyContent: 'space-between', zIndex: 30 }}>
              <button 
                onClick={() => turnPage('prev')} 
                disabled={pageIndex === 0}
                style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '50%', 
                  background: pageIndex === 0 ? 'var(--light-grey)' : 'var(--rum)', 
                  border: 'none', 
                  cursor: pageIndex === 0 ? 'default' : 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: pageIndex === 0 ? 'var(--grey)' : 'white' 
                }}
              >
                <Icon name="back" size={18} />
              </button>
              <button 
                onClick={() => turnPage('next')} 
                disabled={pageIndex === totalLeaves}
                style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '50%', 
                  background: pageIndex === totalLeaves ? 'var(--light-grey)' : 'var(--rum)', 
                  border: 'none', 
                  cursor: pageIndex === totalLeaves ? 'default' : 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: pageIndex === totalLeaves ? 'var(--grey)' : 'white' 
                }}
              >
                <Icon name="chevronRight" size={18} />
              </button>
            </div>
          </div>
        )}

        {view === 'scan' && (
          <div>
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

                {/* Splitting badge */}
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  background: 'rgba(0,0,0,0.6)',
                  color: '#00E5CC',
                  fontSize: '10px',
                  fontWeight: 600
                }}>
                  Splitting with 2 others
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
              <button className="btn" onClick={() => setManualCode(!manualCode)} style={{ 
                width: '100%', 
                background: 'none', 
                color: 'var(--grey)', 
                height: '40px',
                fontSize: '13px'
              }}>
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
                    borderRadius: '12px',
                    border: '1px solid var(--light-grey)',
                    background: 'var(--card-bg)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    color: 'var(--black)',
                    outline: 'none',
                    marginTop: '8px'
                  }}
                />
              )}
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
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--grey)', marginBottom: '8px' }}>
                {autoRouting ? 'Auto-routing' : 'Paying via'}
              </p>
              {autoRouting ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00E5CC', fontSize: '12px', fontWeight: 600 }}>
                  <Icon name="sparkle" size={14} />
                  JAM-DEX → Lynk → Stripe
                  <button onClick={() => setAutoRouting(false)} style={{ background: 'none', border: 'none', color: 'var(--rum)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, marginLeft: 'auto' }}>
                    Override
                  </button>
                </div>
              ) : (
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
              )}
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
    </main>
  )
}