// app/experiences/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import FloatingPill from '@/components/FloatingPill'
import ActiveTripBanner from '@/components/ActiveTripBanner'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'

interface BundleStop {
  type: 'activity' | 'food' | 'transport'
  name: string
  time: string
  img: string
  label?: string
}

interface Bundle {
  id: string
  title: string
  moodTags: string[]
  meta: string[]
  price: number
  pts: string
  hero: string
  stops: BundleStop[]
  socialProof: string
}

interface SurveyState {
  time: string | null
  crew: string[]
  mood: string[]
  budget: number
  occasion: string | null
}

const TIME_META: Record<string, { label: string; emoji: string }> = {
  '2hr': { label: '2 hrs', emoji: '⚡' },
  'half': { label: 'Half day', emoji: '🌤' },
  'full': { label: 'Full day', emoji: '☀️' },
  'night': { label: 'All night', emoji: '🌙' }
}

const OCCASION_META: Record<string, { label: string; emoji: string }> = {
  birthday: { label: 'Celebration', emoji: '🎉' },
  romantic: { label: 'Just us two', emoji: '❤️' },
  family: { label: 'Family day', emoji: '👨‍👩‍👧' },
  none: { label: 'Surprise me', emoji: '🙅' }
}

const AV_COLORS = ['#00E5CC', '#FFB800', '#9333EA', '#FF4B2B']

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) { h = name.charCodeAt(i) + ((h << 5) - h) }
  return AV_COLORS[Math.abs(h) % AV_COLORS.length]
}

const MOOD_VIDEOS: Record<string, string> = {
  party: 'https://www.w3schools.com/html/mov_bbb.mp4',
  water: 'https://www.w3schools.com/html/movie.mp4',
  food: 'https://www.w3schools.com/html/mov_bbb.mp4',
  rr: 'https://www.w3schools.com/html/movie.mp4'
}

export default function ExperiencesPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<'survey' | 'loading' | 'results' | 'detail' | 'active'>('survey')
  const [surveyStep, setSurveyStep] = useState(0)
  const [survey, setSurvey] = useState<SurveyState>({ time: null, crew: [], mood: [], budget: 2, occasion: null })
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null)
  const [activeStops, setActiveStops] = useState<BundleStop[]>([])
  const [currentStopIndex, setCurrentStopIndex] = useState(0)
  const [points, setPoints] = useState(640)
  const [etaSeconds, setEtaSeconds] = useState(12 * 60)
  const [groupMembers, setGroupMembers] = useState<Array<{ name: string; status: string }>>([])
  const [payments, setPayments] = useState<Array<{ name: string; amount: number; paid: boolean }>>([])
  const [crewInput, setCrewInput] = useState('')
  const [showChangePlan, setShowChangePlan] = useState(false)
  const [showRouteSheet, setShowRouteSheet] = useState(false)
  const [swapSelection, setSwapSelection] = useState<string | null>(null)
  const [adapting, setAdapting] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [selectAnim, setSelectAnim] = useState<string | null>(null)
  const [revealStagger, setRevealStagger] = useState(false)
  const [planningPoints, setPlanningPoints] = useState(0)
  const [darkMode, setDarkMode] = useState(false)

  const surveySteps = ['mood', 'time', 'crew', 'budget', 'occasion']

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    setDarkMode(savedTheme === 'dark')
    if (screen === 'active') {
      const etaTimer = setInterval(() => {
        setEtaSeconds(prev => prev > 60 ? prev - 15 : prev)
      }, 2500)
      return () => clearInterval(etaTimer)
    }
  }, [screen])

  useEffect(() => {
    if (screen === 'results') {
      setRevealStagger(true)
      const timer = setTimeout(() => setRevealStagger(false), 1200)
      return () => clearTimeout(timer)
    }
  }, [screen])

  const generateBundles = () => {
    const mockBundles: Bundle[] = [
      {
        id: 'sunrise',
        title: 'Out Til Sunrise',
        moodTags: ['party', 'food'],
        meta: ['4.5 hrs total', '2x points'],
        price: 186,
        pts: '2x pts',
        hero: 'https://images.unsplash.com/photo-1533106418989-88406c7cc8ca?w=800&h=500&fit=crop',
        stops: [
          { type: 'activity', name: "Rick's Café Cliff Jump", time: '5:30 – 6:15pm', img: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200&h=200&fit=crop' },
          { type: 'transport', name: '', time: '', img: '', label: 'Taxi · 12 min' },
          { type: 'food', name: 'Jerk Pit at Pork Pit', time: '6:30 – 7:15pm', img: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=200&h=200&fit=crop' },
          { type: 'transport', name: '', time: '', img: '', label: 'Walk · 6 min' },
          { type: 'activity', name: 'Full Moon Party', time: '8:00pm – late', img: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=200&h=200&fit=crop' }
        ],
        socialProof: '4 people booked this today'
      },
      {
        id: 'golden',
        title: 'Golden Hour Drift',
        moodTags: ['water', 'rr'],
        meta: ['3 hrs total', '2x points'],
        price: 142,
        pts: '2x pts',
        hero: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=500&fit=crop',
        stops: [
          { type: 'activity', name: 'Sunset Catamaran', time: '5:00 – 6:30pm', img: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=200&h=200&fit=crop' },
          { type: 'transport', name: '', time: '', img: '', label: 'Taxi · 8 min' },
          { type: 'food', name: 'Rooftop Small Plates', time: '6:45 – 8:00pm', img: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=200&h=200&fit=crop' }
        ],
        socialProof: '2 spots left at this price'
      },
      {
        id: 'water',
        title: 'Water Life Loop',
        moodTags: ['water', 'party'],
        meta: ['5 hrs total', 'Standard points'],
        price: 210,
        pts: '1x pts',
        hero: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&h=500&fit=crop',
        stops: [
          { type: 'activity', name: 'Blue Hole Falls', time: '11:00am – 1:00pm', img: 'https://images.unsplash.com/photo-1519111830404-c95d1a4d7332?w=200&h=200&fit=crop' },
          { type: 'transport', name: '', time: '', img: '', label: 'Van · 20 min' },
          { type: 'food', name: 'Beachside Fish Fry', time: '1:15 – 2:30pm', img: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=200&h=200&fit=crop' },
          { type: 'transport', name: '', time: '', img: '', label: 'Boat · 15 min' },
          { type: 'activity', name: 'Snorkel Reef Tour', time: '3:00 – 4:30pm', img: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200&h=200&fit=crop' }
        ],
        socialProof: '6 people booked this today'
      }
    ]
    setBundles(mockBundles)
  }

  const triggerSelectAnim = (id: string) => {
    setSelectAnim(id)
    setTimeout(() => setSelectAnim(null), 300)
  }

  const nextStep = () => {
    if (surveyStep >= surveySteps.length - 1) {
      setScreen('loading')
      setPlanningPoints(25)
      setTimeout(() => {
        generateBundles()
        setScreen('results')
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 1500)
      }, 1500)
      return
    }
    setSurveyStep(prev => prev + 1)
  }

  const backStep = () => {
    if (surveyStep > 0) setSurveyStep(prev => prev - 1)
  }

  const toggleMood = (moodId: string) => {
    setSurvey(prev => {
      const has = prev.mood.includes(moodId)
      if (has) return { ...prev, mood: prev.mood.filter(m => m !== moodId) }
      if (prev.mood.length >= 2) return prev
      triggerSelectAnim(moodId)
      return { ...prev, mood: [...prev.mood, moodId] }
    })
  }

  const openBundle = (bundle: Bundle) => {
    setSelectedBundle(bundle)
    setScreen('detail')
  }

  const confirmBundle = () => {
    if (!selectedBundle) return
    setActiveStops(JSON.parse(JSON.stringify(selectedBundle.stops)))
    setCurrentStopIndex(0)
    setPoints(640)
    setEtaSeconds(12 * 60)
    const crew = ['You', ...(survey.crew.length ? survey.crew : ['Jules', 'Ken', 'Priya'])]
    const per = Math.round(selectedBundle.price)
    setGroupMembers(crew.map((n, i) => ({ name: n, status: i === 0 ? 'arrived' : i === 1 ? 'enroute' : 'pending' })))
    setPayments(crew.map((n, i) => ({ name: n, amount: per, paid: i === 0 })))
    setScreen('active')
  }

  const realStops = () => activeStops.filter(s => s.type !== 'transport')

  const cycleStatus = (i: number) => {
    const order = ['pending', 'enroute', 'arrived']
    setGroupMembers(prev => {
      const next = [...prev]
      next[i].status = order[(order.indexOf(next[i].status) + 1) % order.length]
      return next
    })
  }

  const togglePaid = (i: number) => {
    setPayments(prev => {
      const next = [...prev]
      next[i].paid = !next[i].paid
      return next
    })
  }

  const applySwap = () => {
    setShowChangePlan(false)
    if (!swapSelection) return
    setAdapting(true)
    setTimeout(() => {
      setActiveStops(prev => {
        const next = [...prev]
        const real = next.filter(s => s.type !== 'transport')
        if (real[currentStopIndex]) real[currentStopIndex].name = swapSelection
        return next
      })
      setEtaSeconds(Math.floor(Math.random() * 10 + 6) * 60)
      setAdapting(false)
      setSwapSelection(null)
    }, 1300)
  }

  const statusLabel = (s: string) => s === 'arrived' ? 'Arrived' : s === 'enroute' ? 'En route' : 'Not started'

  const logoElement = (
    <div className="logo-container" onClick={() => router.push('/')}>
      {darkMode ? (
        <img src="/logo-dark.png" alt="ETA" />
      ) : (
        <img src="/logo.png" alt="ETA" />
      )}
    </div>
  )

  // ============ SURVEY ============
  if (screen === 'survey') {
    const moodOptions = [
      { id: 'party', name: 'Party Time', emoji: '🎶' },
      { id: 'water', name: 'Water Life', emoji: '🌊' },
      { id: 'food', name: 'Street Food Crawl', emoji: '🍢' },
      { id: 'rr', name: 'R&R', emoji: '🌴' }
    ]

    return (
      <main style={{ minHeight: '100vh', background: 'var(--off-white)', paddingBottom: '80px', overflowX: 'hidden' }}>
        {logoElement}
        <FloatingPill />
        <div style={{ padding: '16px 16px 16px' }}>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
            {surveySteps.map((_, i) => (
              <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i < surveyStep ? 'var(--rum)' : 'var(--light-grey)', transition: 'background 0.3s ease' }} />
            ))}
          </div>

          {surveyStep === 0 && (
            <>
              <p className="section-eyebrow" style={{ marginBottom: '8px' }}>STEP 1 OF 5</p>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--black)', marginBottom: '8px' }}>What&apos;s calling you?</h2>
              <p style={{ fontSize: '13px', color: 'var(--grey)', marginBottom: '16px' }}>Pick up to two.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {moodOptions.map(m => (
                  <div 
                    key={m.id} 
                    onClick={() => toggleMood(m.id)} 
                    className={`mood-video-tile ${survey.mood.includes(m.id) ? 'selected' : ''} ${selectAnim === m.id ? 'select-bounce' : ''}`}
                  >
                    <video
                      src={MOOD_VIDEOS[m.id]}
                      muted
                      loop
                      autoPlay
                      playsInline
                      preload="auto"
                    />
                    <div className="mood-video-tile-overlay" />
                    <div className="mood-video-tile-label">
                      {m.emoji} {m.name}
                    </div>
                    {survey.mood.includes(m.id) && (
                      <div style={{ position: 'absolute', top: '8px', right: '8px', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--rum)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="check" size={12} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" onClick={nextStep} disabled={survey.mood.length === 0} style={{ width: '100%', marginTop: '16px' }}>
                Fawud
              </button>
            </>
          )}

          {surveyStep === 1 && (
            <>
              <p className="section-eyebrow" style={{ marginBottom: '8px' }}>STEP 2 OF 5</p>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--black)', marginBottom: '16px' }}>How much time?</h2>
              {Object.entries(TIME_META).map(([id, meta]) => (
                <div 
                  key={id} 
                  onClick={() => { 
                    setSurvey(prev => ({ ...prev, time: id }))
                    triggerSelectAnim(id)
                    setTimeout(nextStep, 250)
                  }} 
                  className={selectAnim === id ? 'select-bounce' : ''}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '8px',
                    background: survey.time === id ? 'var(--rum)' : 'var(--card-bg)',
                    border: '1px solid var(--light-grey)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{meta.emoji}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: survey.time === id ? 'white' : 'var(--black)' }}>{meta.label}</span>
                </div>
              ))}
            </>
          )}

          {surveyStep === 2 && (
            <>
              <p className="section-eyebrow" style={{ marginBottom: '8px' }}>STEP 3 OF 5</p>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--black)', marginBottom: '16px' }}>Who&apos;s coming?</h2>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  value={crewInput}
                  onChange={(e) => setCrewInput(e.target.value)}
                  placeholder="Add a name"
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--light-grey)', background: 'var(--card-bg)', fontSize: '14px', fontFamily: 'inherit', color: 'var(--black)', outline: 'none' }}
                />
                <button onClick={() => { if (crewInput.trim()) { setSurvey(prev => ({ ...prev, crew: [...prev.crew, crewInput.trim()] })); setCrewInput(''); triggerSelectAnim('crew') } }} style={{ width: '48px', borderRadius: '12px', background: 'var(--rum)', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="plus" size={16} />
                </button>
              </div>
              {survey.crew.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {survey.crew.map((name, i) => (
                    <span key={i} style={{ padding: '6px 12px', borderRadius: '999px', background: 'var(--card-bg)', border: '1px solid var(--light-grey)', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#0F0E0C' }}>{name[0].toUpperCase()}</span>
                      {name}
                    </span>
                  ))}
                </div>
              )}
              <button className="btn btn-primary" onClick={nextStep} style={{ width: '100%' }}>Fawud</button>
            </>
          )}

          {surveyStep === 3 && (
            <>
              <p className="section-eyebrow" style={{ marginBottom: '8px' }}>STEP 4 OF 5</p>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--black)', marginBottom: '24px' }}>How yuh want to spend?</h2>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <span style={{ fontSize: '40px', fontWeight: 700, fontFamily: 'Space Mono, monospace', color: 'var(--rum)' }}>
                  {['$', '$$', '$$$', '$$$$'][survey.budget - 1]}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="4"
                value={survey.budget}
                onChange={(e) => setSurvey(prev => ({ ...prev, budget: parseInt(e.target.value) }))}
                style={{ width: '100%', height: '4px', borderRadius: '2px', background: 'var(--light-grey)', outline: 'none', WebkitAppearance: 'none', marginBottom: '8px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--grey)', fontWeight: 600, marginBottom: '24px' }}>
                <span>Local</span>
                <span>No limit</span>
              </div>
              <button className="btn btn-primary" onClick={nextStep} style={{ width: '100%' }}>Fawud</button>
            </>
          )}

          {surveyStep === 4 && (
            <>
              <p className="section-eyebrow" style={{ marginBottom: '8px' }}>STEP 5 OF 5</p>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--black)', marginBottom: '16px' }}>One more ting.</h2>
              {Object.entries(OCCASION_META).map(([id, meta]) => (
                <div 
                  key={id} 
                  onClick={() => { 
                    setSurvey(prev => ({ ...prev, occasion: id }))
                    triggerSelectAnim(id)
                    setTimeout(nextStep, 300)
                  }} 
                  className={selectAnim === id ? 'select-bounce' : ''}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '8px',
                    background: survey.occasion === id ? 'var(--rum)' : 'var(--card-bg)',
                    border: '1px solid var(--light-grey)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{meta.emoji}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: survey.occasion === id ? 'white' : 'var(--black)' }}>{meta.label}</span>
                </div>
              ))}
            </>
          )}
        </div>
        <Dock />
      </main>
    )
  }

  // ============ LOADING ============
  if (screen === 'loading') {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--off-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', paddingBottom: '80px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--light-grey)', borderTopColor: 'var(--rum)', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--black)' }}>Wi a look fi di best spot</p>
        <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    )
  }

  // ============ RESULTS ============
  if (screen === 'results') {
    const bestMatch = bundles[0]
    const others = bundles.slice(1)

    return (
      <main style={{ minHeight: '100vh', background: 'var(--off-white)', paddingBottom: '80px', overflowX: 'hidden' }}>
        {logoElement}
        <FloatingPill />

        {showConfetti && (
          <>
            {[...Array(20)].map((_, i) => (
              <div key={i} className="confetti-piece" style={{ left: `${Math.random() * 100}%`, top: '-10px', background: ['#FF4B2B', '#FFB800', '#00E5CC', '#9333EA'][i % 4], animationDelay: `${Math.random() * 0.3}s` }} />
            ))}
          </>
        )}

        <div style={{ padding: '16px 16px 16px' }}>
          <div style={{ marginBottom: '24px' }}>
            <p className="section-eyebrow">CURATED FOR YOU</p>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--black)', marginTop: '2px' }}>Yuh vibe, bundled.</h2>
            <p style={{ fontSize: '13px', color: 'var(--rum)', fontWeight: 600, marginTop: '4px' }}>
              +{planningPoints} pts for planning your trip
            </p>
          </div>

          {bestMatch && (
            <div 
              onClick={() => openBundle(bestMatch)} 
              className="card" 
              style={{ 
                position: 'relative', 
                height: '280px', 
                cursor: 'pointer',
                marginBottom: '16px',
                opacity: revealStagger ? 0 : 1,
                transform: revealStagger ? 'translateY(20px)' : 'translateY(0)',
                transition: 'opacity 0.4s ease, transform 0.4s ease'
              }}
            >
              <img src={bestMatch.hero} alt={bestMatch.title} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,14,12,0.1) 0%, rgba(15,14,12,0.5) 50%, rgba(15,14,12,0.9) 100%)' }} />
              <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'var(--rum)', color: 'white', fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '999px' }}>
                BEST MATCH
              </div>
              <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '20px', color: 'white' }}>
                <h3 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>{bestMatch.title}</h3>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
                  {bestMatch.meta.join(' · ')}
                </p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>
                  {bestMatch.socialProof}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="num-font" style={{ fontSize: '18px', fontWeight: 700 }}>${bestMatch.price}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Explore <Icon name="chevronRight" size={12} />
                  </span>
                </div>
              </div>
            </div>
          )}

          {others.map((bundle, index) => (
            <div 
              key={bundle.id} 
              onClick={() => openBundle(bundle)} 
              className="card" 
              style={{ 
                position: 'relative', 
                height: '180px', 
                cursor: 'pointer',
                marginBottom: '12px',
                opacity: revealStagger ? 0 : 1,
                transform: revealStagger ? 'translateY(20px)' : 'translateY(0)',
                transition: `opacity 0.4s ease ${0.15 * (index + 1)}s, transform 0.4s ease ${0.15 * (index + 1)}s`
              }}
            >
              <img src={bundle.hero} alt={bundle.title} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,14,12,0.1) 0%, rgba(15,14,12,0.7) 100%)' }} />
              <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '16px', color: 'white' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '2px' }}>{bundle.title}</h3>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>{bundle.socialProof}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="num-font" style={{ fontSize: '14px', fontWeight: 700 }}>${bundle.price}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Explore <Icon name="chevronRight" size={10} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Dock />
      </main>
    )
  }

  // ============ DETAIL ============
  if (screen === 'detail' && selectedBundle) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--off-white)', paddingBottom: '80px', overflowX: 'hidden' }}>
        {logoElement}
        <FloatingPill />
        <div style={{ height: '200px', position: 'relative', overflow: 'hidden', marginBottom: '16px' }}>
          <img src={selectedBundle.hero} alt={selectedBundle.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,14,12,0.2) 0%, transparent 30%, rgba(15,14,12,0.9) 100%)' }} />
          <button onClick={() => setScreen('results')} style={{ position: 'absolute', top: '60px', left: '16px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(15,14,12,0.5)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Icon name="back" size={14} />
          </button>
          <h2 style={{ position: 'absolute', bottom: '16px', left: '16px', fontSize: '20px', fontWeight: 700, color: 'white' }}>{selectedBundle.title}</h2>
        </div>

        <div style={{ padding: '0 16px' }}>
          <div className="section-header">
            <div className="section-heading">
              <span className="section-eyebrow">YOUR ROUTE</span>
              <span className="section-title">Timeline</span>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            {selectedBundle.stops.map((stop, i) => (
              stop.type === 'transport' ? (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0 8px 16px', fontSize: '12px', color: 'var(--grey)' }}>
                  <Icon name="chevronRight" size={12} />
                  {stop.label}
                </div>
              ) : (
                <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', padding: '12px' }}>
                  <img src={stop.img} alt={stop.name} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--black)' }}>{stop.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--grey)' }}>{stop.time}</p>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--rum)', cursor: 'pointer' }} onClick={() => setShowChangePlan(true)}>Change</span>
                </div>
              )
            ))}
          </div>

          <div className="section-header">
            <div className="section-heading">
              <span className="section-eyebrow">SPLIT PAYMENT</span>
              <span className="section-title">Who Pays What</span>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            {['You', ...(survey.crew.length ? survey.crew : ['Jules', 'Ken', 'Priya'])].map((name, i) => (
              <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#0F0E0C' }}>{name[0].toUpperCase()}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--black)' }}>{name}</span>
                </div>
                <span className="num-font" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--black)' }}>${Math.round(selectedBundle.price)}</span>
              </div>
            ))}
          </div>

          <button className="btn btn-primary" onClick={confirmBundle} style={{ width: '100%' }}>Dun — book dis</button>
        </div>
        <Dock />
      </main>
    )
  }

  // ============ ACTIVE ============
  if (screen === 'active') {
    const realStopsList = realStops()
    const nextStop = realStopsList[currentStopIndex]
    const paidCount = payments.filter(p => p.paid).length
    const totalPaid = payments.reduce((a, p) => a + p.amount, 0)
    const etaMin = Math.floor(etaSeconds / 60)

    return (
      <main style={{ minHeight: '100vh', background: '#1a1530', paddingBottom: '0', overflow: 'hidden', position: 'relative' }}>
        <ActiveTripBanner 
          tripName={selectedBundle?.title || 'Your Experience'}
          etaMinutes={etaMin}
          nextStopName={nextStop?.name || 'Complete'}
        />

        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a1530 0%, #0F0E0C 100%)' }}>
          <svg viewBox="0 0 500 900" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%' }}>
            <rect width="500" height="900" fill="url(#mapGrad)" />
            <defs>
              <linearGradient id="mapGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1a1530" />
                <stop offset="100%" stopColor="#0F0E0C" />
              </linearGradient>
            </defs>
            {[...Array(10)].map((_, i) => <line key={i} x1={i * 50} y1="0" x2={i * 50} y2="900" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />)}
            {[...Array(18)].map((_, i) => <line key={i} x1="0" y1={i * 50} x2="500" y2={i * 50} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />)}
            <path d="M 80 620 Q 180 480 260 500 T 400 260" fill="none" stroke="#00E5CC" strokeWidth="3" strokeDasharray="6 6" opacity="0.8" />
            <circle cx="400" cy="260" r="8" fill="#FFB800" />
            <circle cx="80" cy="620" r="9" fill="#FF4B2B" />
          </svg>
        </div>

        <div style={{ position: 'absolute', top: '0', left: '0', right: '0', zIndex: 20, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setScreen('results')} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(15,14,12,0.5)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Icon name="back" size={14} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15,14,12,0.5)', padding: '8px 12px', borderRadius: '999px' }}>
            <Icon name="sparkle" size={12} style={{ color: '#FFB800' }} />
            <span className="num-font" style={{ fontWeight: 700, fontSize: '13px', color: '#FFB800' }}>{points}</span>
          </div>
        </div>

        <div style={{ position: 'absolute', left: '0', right: '0', bottom: '0', zIndex: 10, background: '#14120E', borderRadius: '20px 20px 0 0', boxShadow: '0 -4px 20px rgba(0,0,0,0.5)', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(245,239,230,0.6)' }}>Next Stop</p>
              <p style={{ fontSize: '16px', fontWeight: 700, color: '#F5EFE6', marginTop: '2px' }}>{nextStop?.name || 'Complete'}</p>
            </div>
            <span className="num-font" style={{ fontSize: '20px', fontWeight: 700, color: '#00E5CC' }}>{etaMin} min</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', marginBottom: '16px' }}>
              {realStopsList.map((stop, i) => (
                <div key={i} style={{ flexShrink: 0, padding: '8px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', background: i < currentStopIndex ? 'rgba(0,229,204,0.1)' : i === currentStopIndex ? 'rgba(255,75,43,0.15)' : 'rgba(255,255,255,0.06)', color: i < currentStopIndex ? '#00E5CC' : i === currentStopIndex ? '#FF4B2B' : 'rgba(245,239,230,0.5)' }}>
                  {stop.name}
                </div>
              ))}
            </div>

            <p style={{ fontSize: '13px', fontWeight: 700, color: '#F5EFE6', marginBottom: '8px' }}>Your crew</p>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {groupMembers.map((member, i) => (
                <div key={i} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={() => cycleStatus(i)}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: avatarColor(member.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#0F0E0C', border: member.status === 'arrived' ? '2px solid #00E5CC' : '2px solid transparent' }}>
                    {member.name[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(245,239,230,0.7)' }}>{member.name}</span>
                  <span style={{ fontSize: '9px', color: 'rgba(245,239,230,0.5)' }}>{statusLabel(member.status)}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '13px', fontWeight: 700, color: '#F5EFE6', marginBottom: '8px' }}>Split payment</p>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="num-font" style={{ fontSize: '16px', fontWeight: 700, color: '#F5EFE6' }}>${totalPaid}</span>
                <span className="num-font" style={{ fontSize: '11px', color: 'rgba(245,239,230,0.6)' }}>{paidCount} of {payments.length} paid</span>
              </div>
              {payments.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: avatarColor(p.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#0F0E0C' }}>{p.name[0].toUpperCase()}</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#F5EFE6' }}>{p.name}</span>
                  </div>
                  <span onClick={() => togglePaid(i)} style={{ fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '999px', cursor: 'pointer', background: p.paid ? 'rgba(0,229,204,0.15)' : 'rgba(255,75,43,0.15)', color: p.paid ? '#00E5CC' : '#FF4B2B' }}>
                    {p.paid ? 'Paid' : `$${p.amount}`}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowChangePlan(true)} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#F5EFE6', fontFamily: 'inherit', fontSize: '11px', fontWeight: 600 }}>
                Change plan
              </button>
              <button onClick={() => setShowRouteSheet(true)} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#F5EFE6', fontFamily: 'inherit', fontSize: '11px', fontWeight: 600 }}>
                Full route
              </button>
            </div>
          </div>
        </div>

        {adapting && (
          <div style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: 'rgba(15,14,12,0.95)', padding: '12px 16px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#00E5CC', animation: 'spin 0.7s linear infinite' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#F5EFE6' }}>Updating plan...</span>
          </div>
        )}

        {showChangePlan && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowChangePlan(false)}>
            <div style={{ width: '100%', maxWidth: '520px', background: '#161410', borderRadius: '20px 20px 0 0', padding: '20px' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#F5EFE6', marginBottom: '12px' }}>Change your plan</h3>
              {['Sunset Catamaran', 'Blue Hole Falls', 'Jerk Pit Crawl'].map(name => (
                <div key={name} onClick={() => setSwapSelection(name)} style={{ padding: '12px', borderRadius: '12px', cursor: 'pointer', marginBottom: '8px', background: swapSelection === name ? 'rgba(255,75,43,0.1)' : 'rgba(255,255,255,0.06)', border: swapSelection === name ? '1px solid #FF4B2B' : '1px solid rgba(255,255,255,0.1)' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#F5EFE6' }}>{name}</p>
                </div>
              ))}
              <button className="btn btn-primary" onClick={applySwap} style={{ width: '100%', marginTop: '8px' }}>Fawud</button>
            </div>
          </div>
        )}

        {showRouteSheet && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowRouteSheet(false)}>
            <div style={{ width: '100%', maxWidth: '520px', maxHeight: '80vh', overflowY: 'auto', background: '#161410', borderRadius: '20px 20px 0 0', padding: '20px' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#F5EFE6', marginBottom: '12px' }}>Full route</h3>
              {activeStops.map((stop, i) => (
                stop.type === 'transport' ? (
                  <div key={i} style={{ padding: '6px 0 6px 16px', fontSize: '11px', color: 'rgba(245,239,230,0.5)' }}>{stop.label}</div>
                ) : (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '12px', marginBottom: '4px', background: 'rgba(255,255,255,0.06)' }}>
                    <img src={stop.img} alt={stop.name} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#F5EFE6' }}>{stop.name}</p>
                      <p style={{ fontSize: '10px', color: 'rgba(245,239,230,0.5)' }}>{stop.time}</p>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    )
  }

  return null
}