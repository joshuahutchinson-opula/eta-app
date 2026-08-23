// app/pay/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  category: 'FOOD' | 'DRINKS' | 'ACTIVITY' | 'WELLNESS' | 'BEACH' | 'TRANSPORT'
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
  highlight?: string
  photoUrl?: string
  photoCaption?: string
  isMilestone?: boolean
}

const MOCK_TRIPS: TripPage[] = [
  {
    id: 'trip-1',
    destination: 'Full Moon Float',
    date: 'Aug 15, 2026',
    totalSpent: 185,
    isActive: true,
    isSealed: false,
    highlight: 'Best bite: Push Cart\'s jerk chicken',
    photoUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=300&fit=crop',
    photoCaption: 'Sunset at the cliffs',
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
    photoUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop',
    photoCaption: 'Golden hour dinner',
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
    isMilestone: true,
    stops: [
      { id: 's6', vendorName: 'Push Cart', item: 'Jerk Pork', price: 40, status: 'paid', category: 'FOOD' },
      { id: 's7', vendorName: 'Blue Mahoe', item: 'Coffee Flight', price: 35, status: 'paid', category: 'FOOD' },
    ],
    crew: [
      { id: 'c6', name: 'You', amount: 75, paid: true, isYou: true },
    ],
  },
]

const COLLECTION_VENDORS = [
  { name: 'Push Cart', category: 'FOOD', visited: true },
  { name: 'Coral Reef Bar', category: 'DRINKS', visited: true },
  { name: 'Cliffside Grill', category: 'FOOD', visited: true },
  { name: 'MoBay Watersports', category: 'ACTIVITY', visited: true },
  { name: 'Blue Mahoe', category: 'FOOD', visited: true },
  { name: 'Island Wellness', category: 'WELLNESS', visited: false },
  { name: 'Doctor\'s Cave', category: 'BEACH', visited: false },
  { name: 'Rasta Taxi', category: 'TRANSPORT', visited: false },
  { name: 'Coconut Man', category: 'FOOD', visited: false },
  { name: 'Negril Watersports', category: 'ACTIVITY', visited: false },
]

const MILESTONES = [
  { id: 'm1', title: 'First Trip', achieved: true, icon: 'compass' },
  { id: 'm2', title: '5 Trips', achieved: false, icon: 'sparkle' },
  { id: 'm3', title: 'Foodie', achieved: true, icon: 'food' },
  { id: 'm4', title: 'Water Baby', achieved: true, icon: 'activity' },
]

const REGION_STAMPS = [
  { name: 'Negril', code: 'NE', unlocked: true },
  { name: 'MoBay', code: 'MB', unlocked: true },
  { name: 'Ochi', code: 'OR', unlocked: false },
  { name: 'Kingston', code: 'KN', unlocked: false },
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
    case 'TRANSPORT': return 'route'
    default: return 'sparkle'
  }
}

function Leaf({ index, currentIndex, total, children, back, registerRef }: {
  index: number
  currentIndex: number
  total: number
  children: React.ReactNode
  back?: React.ReactNode
  registerRef: (index: number, el: HTMLDivElement | null) => void
}) {
  const turned = index < currentIndex
  return (
    <div
      ref={el => registerRef(index, el)}
      style={{
        position: 'absolute',
        inset: 0,
        transformStyle: 'preserve-3d',
        transformOrigin: 'left center',
        transition: 'transform 0.7s cubic-bezier(0.45, 0.05, 0.35, 1)',
        transform: turned ? 'rotateY(-176deg)' : 'rotateY(0deg)',
        zIndex: turned ? index + 1 : total - index + 10,
      }}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        borderRadius: '2px 10px 10px 2px',
        overflow: 'hidden'
      }}>
        {children}
      </div>
      <div style={{
        position: 'absolute',
        inset: 0,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'rotateY(180deg)',
        borderRadius: '2px 10px 10px 2px',
        overflow: 'hidden',
        background: '#F3ECDD'
      }}>
        {back}
      </div>
    </div>
  )
}

function PaperPage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(160deg, #FEFBF6 0%, #F3ECDD 100%)',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
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
        border: '1px solid rgba(255, 75, 43, 0.25)',
        borderRadius: '4px',
        pointerEvents: 'none'
      }} />
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '20px 16px' }}>
        {children}
      </div>
    </div>
  )
}

export default function PayPage() {
  const router = useRouter()
  const [view, setView] = useState<'passport' | 'scan'>('passport')
  const [pageIndex, setPageIndex] = useState(1)
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
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const bookRef = useRef<HTMLDivElement>(null)
  const leafRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const registerRef = (index: number, el: HTMLDivElement | null) => {
    if (el) leafRefs.current.set(index, el)
    else leafRefs.current.delete(index)
  }

  const totalLeaves = 1 + 1 + MOCK_TRIPS.length + 1 + 1

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

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return
    const dx = e.changedTouches[0].clientX - touchStartX
    if (Math.abs(dx) > 40) {
      if (dx > 0) turnPage('prev')
      else turnPage('next')
    }
    setTouchStartX(null)
  }

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

  const currentTripIndex = pageIndex - 2
  const isCover = pageIndex === 0
  const isBio = pageIndex === 1
  const isCollection = pageIndex === 2 + MOCK_TRIPS.length
  const isMilestone = pageIndex === 3 + MOCK_TRIPS.length
  const currentTrip = !isCover && !isBio && !isCollection && !isMilestone && currentTripIndex >= 0 && currentTripIndex < MOCK_TRIPS.length
    ? MOCK_TRIPS[currentTripIndex]
    : null

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--off-white)' }}>
      <div style={{ padding: '16px 16px 0', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Segmented control */}
        <div style={{ flexShrink: 0, display: 'flex', background: 'var(--light-grey)', borderRadius: '10px', padding: '2px', gap: '2px', marginBottom: '16px' }}>
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

        {/* Content area with Dock clearance */}
        <div style={{ flex: 1, minHeight: 0, paddingBottom: 90, display: 'flex', flexDirection: 'column' }}>
          {view === 'passport' && (
            <div
              ref={bookRef}
              className="passport-book"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              style={{ flex: 1 }}
            >
              {/* Spine */}
              <div className="passport-spine">
                <div className="passport-stitch" />
              </div>

              {/* Page edge */}
              <div className="passport-page-edge" />

              {/* Sheen overlay */}
              {sheenActive && <div className="passport-sheen" style={{ opacity: 1 }} />}

              {/* Stamp animation */}
              {stampAnimating && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none'
                }}>
                  <div style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    border: '4px solid var(--gold)',
                    background: 'rgba(255, 184, 0, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'stampLand 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                    boxShadow: '0 0 20px rgba(255,184,0,0.4), inset 0 0 10px rgba(255,184,0,0.2)'
                  }}>
                    <Icon name="sparkle" size={40} style={{ color: 'var(--gold)' }} />
                  </div>
                </div>
              )}

              {/* LEAF 0: COVER */}
              <Leaf index={0} currentIndex={pageIndex} total={totalLeaves} registerRef={registerRef} back={<div />}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(155deg, #9c2812 0%, #6e1a0c 55%, #4d1207 100%)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '32px 24px'
                }}>
                  {/* SVG grain filter */}
                  <svg width="0" height="0" style={{ position: 'absolute' }}>
                    <defs>
                      <filter id="leatherGrain">
                        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" result="n" />
                        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0" />
                      </filter>
                    </defs>
                  </svg>
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    filter: 'url(#leatherGrain)',
                    pointerEvents: 'none'
                  }} />

                  {/* Gold inset frame */}
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
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4), 0 0 24px rgba(255,184,0,0.25)'
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
                    textShadow: '0 1px 0 rgba(0,0,0,0.7), 0 0 20px rgba(255,184,0,0.35)',
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

                  {/* Region stamps */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '16px' }}>
                    {REGION_STAMPS.map(region => (
                      <div key={region.name} style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        border: region.unlocked ? '2px solid var(--gold)' : '2px dashed rgba(255,255,255,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '8px',
                        fontWeight: 700,
                        color: region.unlocked ? 'var(--gold)' : 'rgba(255,255,255,0.35)',
                        textTransform: 'uppercase',
                        fontFamily: 'Georgia, serif',
                        background: region.unlocked ? 'rgba(255,184,0,0.08)' : 'transparent'
                      }}>
                        {region.code}
                      </div>
                    ))}
                  </div>

                  {/* Passport number */}
                  <div style={{
                    fontFamily: 'Space Mono, monospace',
                    fontSize: '9px',
                    color: 'rgba(255, 255, 255, 0.35)',
                    letterSpacing: '2px',
                    marginTop: '8px'
                  }}>
                    PASSPORT No. ETA-2026-0042
                  </div>
                </div>
              </Leaf>

              {/* LEAF 1: BIO PAGE */}
              <Leaf index={1} currentIndex={pageIndex} total={totalLeaves} registerRef={registerRef} back={<div />}>
                <PaperPage>
                  <div style={{ textAlign: 'center', marginBottom: '16px' }}>
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
                    marginBottom: '16px',
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
                  <p className="caption-font" style={{
                    fontSize: '11px',
                    color: 'var(--grey)',
                    textAlign: 'center',
                    marginBottom: '16px'
                  }}>
                    $470 spent · 5 local vendors supported
                  </p>

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
                    border: '2px solid var(--gold)'
                  }}>
                    {[...Array(100)].map((_, i) => (
                      <div key={i} style={{
                        background: (i * 7 + i * i) % 3 === 0 ? '#0F0E0C' : 'transparent',
                        borderRadius: '1px'
                      }} />
                    ))}
                  </div>
                  <p className="caption-font" style={{
                    fontSize: '9px',
                    color: 'var(--grey)',
                    textAlign: 'center',
                    marginBottom: '16px'
                  }}>
                    Vendors scan this — they'll see you're a Gold Member
                  </p>

                  {/* Payment medallions */}
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
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

                  {/* Home currency */}
                  <p className="caption-font" style={{
                    fontSize: '10px',
                    color: 'var(--grey)',
                    textAlign: 'center',
                    marginBottom: '8px'
                  }}>
                    JMD · Split equally
                  </p>

                  {/* Points link */}
                  <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <span
                      onClick={() => router.push('/wallet')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        border: '1px dashed var(--rum)',
                        borderRadius: '999px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 700
                      }}
                    >
                      <Icon name="sparkle" size={14} style={{ color: 'var(--rum)' }} />
                      <span className="num-font" style={{ color: '#0F0E0C' }}>1,240 pts</span>
                    </span>
                  </div>

                  {/* MRZ line */}
                  <div style={{
                    fontFamily: 'Space Mono, monospace',
                    fontSize: '7px',
                    color: 'rgba(0,0,0,0.25)',
                    letterSpacing: '1px',
                    textAlign: 'center',
                    marginTop: 'auto'
                  }}>
                    P&lt;JAMHUTCHINSON&lt;&lt;JORDAN&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
                  </div>
                </PaperPage>
              </Leaf>

              {/* LEAF 2+: TRIP PAGES */}
              {MOCK_TRIPS.map((trip, index) => {
                const leafIndex = 2 + index
                return (
                  <Leaf key={trip.id} index={leafIndex} currentIndex={pageIndex} total={totalLeaves} registerRef={registerRef} back={<div />}>
                    <PaperPage>
                      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                        <p style={{
                          fontFamily: 'Georgia, serif',
                          fontSize: '9px',
                          letterSpacing: '2px',
                          color: trip.isActive ? 'var(--rum)' : 'var(--live)',
                          textTransform: 'uppercase',
                          marginBottom: '4px'
                        }}>
                          {trip.isActive ? 'In Progress' : 'Sealed'}
                        </p>
                        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '17px', fontWeight: 700, color: '#0F0E0C' }}>
                          {trip.destination}
                        </h3>
                        <p className="caption-font" style={{ fontSize: '10px', color: 'var(--grey)' }}>
                          {trip.date}
                        </p>
                      </div>

                      {/* Crew avatars */}
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '12px' }}>
                        {trip.crew.map(member => (
                          <div key={member.id} style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            background: member.isYou ? 'var(--rum)' : 'rgba(0,0,0,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '9px',
                            fontWeight: 700,
                            color: member.isYou ? 'white' : '#0F0E0C',
                            border: member.paid ? '1.5px solid var(--live)' : '1.5px dashed rgba(0,0,0,0.3)'
                          }}>
                            {member.name[0]}
                          </div>
                        ))}
                      </div>

                      {/* Photo polaroid */}
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                        {trip.photoUrl ? (
                          <div className="polaroid" style={{ width: '100px', transform: 'rotate(-3deg)' }}>
                            <div className="tape-strip" />
                            <img src={trip.photoUrl} alt={trip.photoCaption || trip.destination} style={{ width: '100%', height: '70px', objectFit: 'cover', borderRadius: '2px' }} />
                            <div className="polaroid-caption" style={{ fontSize: '8px' }}>{trip.photoCaption}</div>
                          </div>
                        ) : (
                          <div className="polaroid" style={{ width: '100px', transform: 'rotate(-3deg)', opacity: 0.5 }}>
                            <div className="tape-strip" />
                            <div style={{ width: '100%', height: '70px', borderRadius: '2px', border: '2px dashed rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Icon name="camera" size={18} style={{ color: 'rgba(0,0,0,0.3)' }} />
                            </div>
                            <div className="polaroid-caption" style={{ fontSize: '8px' }}>Add a photo</div>
                          </div>
                        )}
                      </div>

                      {/* Highlight */}
                      {trip.highlight && (
                        <p className="caption-font" style={{
                          fontSize: '10px',
                          color: 'var(--grey)',
                          textAlign: 'center',
                          marginBottom: '12px'
                        }}>
                          "{trip.highlight}"
                        </p>
                      )}

                      {/* Stamps */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '12px' }}>
                        {trip.stops.map(stop => (
                          <button
                            key={stop.id}
                            onClick={() => router.push(`/vendor/${stop.vendorName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`)}
                            className={`${getStampClass(stop.category)} ${trip.isMilestone ? 'milestone-stamp' : ''}`}
                            style={{
                              width: '38px',
                              height: '38px',
                              border: trip.isMilestone ? '3px solid var(--gold)' : '2px solid rgba(255, 75, 43, 0.5)',
                              background: trip.isMilestone ? 'rgba(255, 184, 0, 0.06)' : 'rgba(255, 75, 43, 0.04)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              flexShrink: 0
                            }}
                          >
                            <Icon name={getStampIcon(stop.category) as any} size={16} style={{ color: trip.isMilestone ? 'var(--gold)' : 'rgba(255, 75, 43, 0.6)' }} />
                          </button>
                        ))}
                      </div>

                      {/* Active trip details */}
                      {trip.isActive && (
                        <div>
                          <div style={{ marginBottom: '10px' }}>
                            {trip.stops.map(stop => (
                              <div key={stop.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 0',
                                borderBottom: '1px dashed rgba(0,0,0,0.08)'
                              }}>
                                <div>
                                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#0F0E0C', fontFamily: 'Georgia, serif' }}>{stop.vendorName}</p>
                                  <p style={{ fontSize: '8px', color: 'var(--grey)', fontStyle: 'italic' }}>{stop.item}</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className="num-font" style={{ fontSize: '9px', fontWeight: 700, color: '#0F0E0C' }}>${stop.price}</span>
                                  <span style={{
                                    fontSize: '6px',
                                    fontWeight: 700,
                                    padding: '2px 4px',
                                    border: '1px solid',
                                    borderColor: stop.status === 'paid' ? 'var(--live)' : stop.status === 'queued' ? 'var(--gold)' : 'rgba(255, 184, 0, 0.5)',
                                    borderRadius: '2px',
                                    transform: 'rotate(-5deg)',
                                    color: stop.status === 'paid' ? 'var(--live)' : stop.status === 'queued' ? 'var(--gold)' : 'rgba(200,140,0,0.7)',
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

                          <button className="btn btn-primary" style={{ width: '100%', height: '38px', marginBottom: '6px', fontSize: '12px' }}>
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
                              height: '34px',
                              fontSize: '11px',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {nudged ? 'Nudged!' : nudgeCooldown ? 'Nudge sent (60s)' : 'Nudge Unpaid'}
                          </button>
                        </div>
                      )}

                      {/* Total for sealed */}
                      {trip.isSealed && (
                        <p className="num-font" style={{ fontSize: '11px', fontWeight: 700, color: '#0F0E0C', textAlign: 'center', fontFamily: 'Georgia, serif' }}>
                          Total: ${trip.totalSpent}
                        </p>
                      )}
                    </PaperPage>
                  </Leaf>
                )
              })}

              {/* COLLECTION PAGE */}
              <Leaf index={2 + MOCK_TRIPS.length} currentIndex={pageIndex} total={totalLeaves} registerRef={registerRef} back={<div />}>
                <PaperPage>
                  <div style={{ textAlign: 'center', marginBottom: '12px' }}>
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
                    <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '17px', fontWeight: 700, color: '#0F0E0C' }}>
                      Negril Spots
                    </h3>
                    <p className="num-font" style={{ fontSize: '10px', color: 'var(--grey)' }}>
                      5/10 collected
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: '4px', borderRadius: '2px', background: 'var(--light-grey)', overflow: 'hidden', marginBottom: '12px' }}>
                    <div className="progress-fill" style={{ width: '50%', height: '100%', background: 'var(--rum)' }} />
                  </div>

                  {/* Vendor checklist */}
                  <div>
                    {COLLECTION_VENDORS.map(vendor => (
                      <div key={vendor.name} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 0',
                        borderBottom: '1px dashed rgba(0,0,0,0.06)',
                        opacity: vendor.visited ? 1 : 0.4
                      }}>
                        <div className={getStampClass(vendor.category)} style={{
                          width: '28px',
                          height: '28px',
                          border: vendor.visited ? '2px solid rgba(255, 75, 43, 0.5)' : '2px dashed rgba(0,0,0,0.2)',
                          background: vendor.visited ? 'rgba(255, 75, 43, 0.04)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Icon name={getStampIcon(vendor.category) as any} size={12} style={{ color: vendor.visited ? 'rgba(255, 75, 43, 0.5)' : 'rgba(0,0,0,0.2)' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '10px', fontWeight: 600, color: '#0F0E0C', fontFamily: 'Georgia, serif' }}>{vendor.name}</p>
                        </div>
                        {vendor.visited && (
                          <Icon name="check" size={12} style={{ color: 'var(--live)' }} />
                        )}
                      </div>
                    ))}
                  </div>
                </PaperPage>
              </Leaf>

              {/* MILESTONE PAGE */}
              <Leaf index={3 + MOCK_TRIPS.length} currentIndex={pageIndex} total={totalLeaves} registerRef={registerRef} back={<div />}>
                <PaperPage>
                  <div style={{ textAlign: 'center', marginBottom: '16px' }}>
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
                    <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '17px', fontWeight: 700, color: '#0F0E0C' }}>
                      Achievements
                    </h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {MILESTONES.map(m => (
                      <div key={m.id} className={m.achieved ? 'milestone-stamp' : ''} style={{
                        padding: '14px',
                        textAlign: 'center',
                        borderRadius: '50%',
                        width: '90px',
                        height: '90px',
                        margin: '0 auto',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: m.achieved ? 1 : 0.35,
                        border: m.achieved ? '4px solid var(--gold)' : '2px dashed rgba(0,0,0,0.2)',
                        boxShadow: m.achieved ? '0 0 12px rgba(255,184,0,0.3)' : 'none'
                      }}>
                        <Icon name={m.icon as any} size={22} style={{ color: m.achieved ? 'var(--gold)' : 'rgba(0,0,0,0.3)' }} />
                        <p style={{ fontSize: '7px', fontWeight: 700, color: m.achieved ? '#0F0E0C' : 'var(--grey)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          {m.title}
                        </p>
                      </div>
                    ))}
                  </div>
                </PaperPage>
              </Leaf>
            </div>
          )}

          {view === 'scan' && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{
                flex: 1,
                minHeight: 0,
                background: '#1a1530',
                borderRadius: 'var(--radius-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                marginBottom: '12px'
              }}>
                <div style={{
                  width: '200px',
                  height: '200px',
                  border: '2px solid rgba(255,255,255,0.5)',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: flashOn ? 'rgba(255,255,255,0.05)' : 'transparent',
                  transition: 'background 0.2s ease'
                }}>
                  <Icon name="camera" size={48} style={{ color: flashOn ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)' }} />
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
                  color: 'var(--live)',
                  fontSize: '10px',
                  fontWeight: 600
                }}>
                  Splitting with 2 others
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
                    borderRadius: 'var(--radius-card)',
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
          )}
        </div>
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
                style={{ width: '100%', padding: '14px', borderRadius: 'var(--radius-card)', border: '1px solid var(--light-grey)', background: 'var(--card-bg)', fontSize: '20px', fontWeight: 700, fontFamily: 'Space Mono, monospace', color: 'var(--black)', outline: 'none', marginBottom: '8px' }}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--live)', fontSize: '12px', fontWeight: 600 }}>
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
              {patois.ctaConfirm}
            </button>
          </div>
        )}
      </div>

      <Dock />
    </main>
  )
}