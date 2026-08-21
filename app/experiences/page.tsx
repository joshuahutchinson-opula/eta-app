// app/experiences/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import TopBar from '@/components/TopBar'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'

// Types
interface Experience {
  id: string
  name: string
  tagline: string
  price: number
  imageUrl: string
  videoUrl?: string | null
  city: string
  startLocation: string
  travelTime: number
  travelMode: string
  stopCount?: number
  totalDuration?: number
  travelIncluded?: boolean
  stops?: Array<{ id: string; name: string; type: string }>
  vendor?: { name: string; isPremium?: boolean }
  moods?: Array<{ id: string; name: string; icon: string }>
}

interface Mood {
  id: string
  name: string
  icon: string
  description: string
  coverImage: string
}

interface SurveyState {
  time: string | null
  crew: string[]
  mood: string[]
  budget: number
  occasion: string | null
}

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
}

const MOOD_ICONS: Record<string, string> = {
  'R&R': 'wellness',
  'Just The Two Of Us': 'heart',
  'Party Time': 'moon',
  'Sunset Chaser': 'sun',
  'Water Life': 'activity',
  'Street Food Crawl': 'food',
  'Hangover Cures': 'drink',
  'Solo Missions': 'user',
  'Family Day': 'users',
  'Rum & Bass': 'drink'
}

const MOOD_EMOJIS: Record<string, string> = {
  'party': '🎶',
  'water': '🌊',
  'food': '🍢',
  'rr': '🌴'
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

const AV_COLORS = ['--sea', '--gold', '--purple', '--rum-bright']

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) { h = name.charCodeAt(i) + ((h << 5) - h) }
  const idx = Math.abs(h) % AV_COLORS.length
  return `var(${AV_COLORS[idx]})`
}

export default function ExperiencesPage() {
  const [screen, setScreen] = useState<'survey' | 'loading' | 'results' | 'detail' | 'active'>('survey')
  const [surveyStep, setSurveyStep] = useState(0)
  const [survey, setSurvey] = useState<SurveyState>({ time: null, crew: [], mood: [], budget: 2, occasion: null })
  const [moods, setMoods] = useState<Mood[]>([])
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null)
  const [activeStops, setActiveStops] = useState<BundleStop[]>([])
  const [currentStopIndex, setCurrentStopIndex] = useState(0)
  const [points, setPoints] = useState(640)
  const [etaSeconds, setEtaSeconds] = useState(12 * 60)
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal')
  const [groupMembers, setGroupMembers] = useState<Array<{ name: string; status: string }>>([])
  const [payments, setPayments] = useState<Array<{ name: string; amount: number; paid: boolean }>>([])
  const [loadingText, setLoadingText] = useState('Wi a look fi di best spot')
  const [crewInput, setCrewInput] = useState('')
  const [detailInviteInput, setDetailInviteInput] = useState('')
  const [activeInviteInput, setActiveInviteInput] = useState('')
  const [showChangePlan, setShowChangePlan] = useState(false)
  const [showInviteSheet, setShowInviteSheet] = useState(false)
  const [showRouteSheet, setShowRouteSheet] = useState(false)
  const [swapSelection, setSwapSelection] = useState<string | null>(null)
  const [adapting, setAdapting] = useState(false)

  const surveySteps = ['mood', 'time', 'crew', 'budget', 'occasion']

  useEffect(() => {
    fetchMoodsAndExperiences()
  }, [])

  useEffect(() => {
    if (screen === 'active') {
      const etaTimer = setInterval(() => {
        setEtaSeconds(prev => {
          if (prev > 60) return prev - 15
          return prev
        })
      }, 2500)
      const ptsTimer = setInterval(() => {
        setPoints(prev => prev + Math.floor(Math.random() * 3) + 1)
      }, 3500)
      return () => { clearInterval(etaTimer); clearInterval(ptsTimer) }
    }
  }, [screen])

  const fetchMoodsAndExperiences = async () => {
    try {
      const [moodsRes, expRes] = await Promise.allSettled([
        fetch('/api/moods'),
        fetch('/api/experiences')
      ])
      if (moodsRes.status === 'fulfilled' && moodsRes.value.ok) {
        const data = await moodsRes.value.json()
        setMoods(Array.isArray(data) ? data : [])
      }
      if (expRes.status === 'fulfilled' && expRes.value.ok) {
        const data = await expRes.value.json()
        setExperiences(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const generateBundles = () => {
    const mockBundles: Bundle[] = [
      {
        id: 'sunrise',
        title: 'Out Til Sunrise',
        moodTags: ['party', 'food'],
        meta: ['4.5 hrs total', 'Crew of 4', '2x points active'],
        price: 186,
        pts: '2x pts',
        hero: 'https://images.unsplash.com/photo-1533106418989-88406c7cc8ca?w=800&h=500&fit=crop',
        stops: [
          { type: 'activity', name: "Rick's Café Cliff Jump", time: '5:30 – 6:15pm', img: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200&h=200&fit=crop' },
          { type: 'transport', name: '', time: '', img: '', label: 'Taxi · 12 min' },
          { type: 'food', name: 'Jerk Pit at Pork Pit', time: '6:30 – 7:15pm', img: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=200&h=200&fit=crop' },
          { type: 'transport', name: '', time: '', img: '', label: 'Walk · 6 min' },
          { type: 'activity', name: 'Full Moon Party', time: '8:00pm – late', img: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=200&h=200&fit=crop' }
        ]
      },
      {
        id: 'golden',
        title: 'Golden Hour Drift',
        moodTags: ['water', 'rr'],
        meta: ['3 hrs total', 'Crew of 4', '2x points · golden hour'],
        price: 142,
        pts: '2x pts',
        hero: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=500&fit=crop',
        stops: [
          { type: 'activity', name: 'Sunset Catamaran', time: '5:00 – 6:30pm', img: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=200&h=200&fit=crop' },
          { type: 'transport', name: '', time: '', img: '', label: 'Taxi · 8 min' },
          { type: 'food', name: 'Rooftop Small Plates', time: '6:45 – 8:00pm', img: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=200&h=200&fit=crop' }
        ]
      },
      {
        id: 'water',
        title: 'Water Life Loop',
        moodTags: ['water', 'party'],
        meta: ['5 hrs total', 'Crew of 4', 'Standard points'],
        price: 210,
        pts: '1x pts',
        hero: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&h=500&fit=crop',
        stops: [
          { type: 'activity', name: 'Blue Hole Falls', time: '11:00am – 1:00pm', img: 'https://images.unsplash.com/photo-1519111830404-c95d1a4d7332?w=200&h=200&fit=crop' },
          { type: 'transport', name: '', time: '', img: '', label: 'Van · 20 min' },
          { type: 'food', name: 'Beachside Fish Fry', time: '1:15 – 2:30pm', img: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=200&h=200&fit=crop' },
          { type: 'transport', name: '', time: '', img: '', label: 'Boat · 15 min' },
          { type: 'activity', name: 'Snorkel Reef Tour', time: '3:00 – 4:30pm', img: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200&h=200&fit=crop' }
        ]
      }
    ]
    setBundles(mockBundles)
  }

  const nextStep = () => {
    if (surveyStep >= surveySteps.length - 1) {
      runCuration()
      return
    }
    setSurveyStep(prev => prev + 1)
  }

  const backStep = () => {
    if (surveyStep > 0) setSurveyStep(prev => prev - 1)
  }

  const runCuration = () => {
    setScreen('loading')
    const messages = ['Wi a look fi di best spot', 'Wi a check who deh dey now', 'Wi a maths di points', 'Wull on, almost dun']
    let msgIdx = 0
    const msgTimer = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length
      setLoadingText(messages[msgIdx])
    }, 480)

    setTimeout(() => {
      clearInterval(msgTimer)
      generateBundles()
      setScreen('results')
    }, 1900)
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
        if (real[currentStopIndex]) {
          real[currentStopIndex].name = swapSelection
        }
        return next
      })
      setEtaSeconds(Math.floor(Math.random() * 10 + 6) * 60)
      setPoints(prev => prev + 15)
      setAdapting(false)
      setSwapSelection(null)
    }, 1300)
  }

  const addActiveInvite = () => {
    const val = activeInviteInput.trim()
    if (!val) return
    setGroupMembers(prev => [...prev, { name: val, status: 'pending' }])
    setPayments(prev => [...prev, { name: val, amount: 0, paid: false }])
    setActiveInviteInput('')
  }

  const addCrewMember = () => {
    const val = crewInput.trim()
    if (!val) return
    setSurvey(prev => ({ ...prev, crew: [...prev.crew, val] }))
    setCrewInput('')
  }

  const addDetailInvite = () => {
    const val = detailInviteInput.trim()
    if (!val) return
    setSurvey(prev => ({ ...prev, crew: [...prev.crew, val] }))
    setDetailInviteInput('')
  }

  const toggleMood = (moodId: string, moodName: string) => {
    setSurvey(prev => {
      const has = prev.mood.includes(moodId)
      if (has) return { ...prev, mood: prev.mood.filter(m => m !== moodId) }
      if (prev.mood.length >= 2) return prev
      return { ...prev, mood: [...prev.mood, moodId] }
    })
  }

  const statusLabel = (s: string) => s === 'arrived' ? 'Arrived' : s === 'enroute' ? 'En route' : 'Not started'

  // ============ SURVEY RENDER ============
  const renderSurveyContent = () => {
    const key = surveySteps[surveyStep]

    if (key === 'mood') {
      const moodOptions = [
        { id: 'party', name: 'Party Time', emoji: '🎶', img: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=300&h=380&fit=crop' },
        { id: 'water', name: 'Water Life', emoji: '🌊', img: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=300&h=380&fit=crop' },
        { id: 'food', name: 'Street Food Crawl', emoji: '🍢', img: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=300&h=380&fit=crop' },
        { id: 'rr', name: 'R&R', emoji: '🌴', img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&h=380&fit=crop' }
      ]
      return (
        <div>
          <div className="section-eyebrow">1 of 5</div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', color: 'var(--black)' }}>What&apos;s calling you today?</h2>
          <p style={{ fontSize: '14px', color: 'var(--grey)', marginBottom: '20px' }}>Pick up to two — this sets the whole tone.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            {moodOptions.map(m => (
              <div key={m.id} onClick={() => toggleMood(m.id, m.name)} style={{
                borderRadius: '16px',
                overflow: 'hidden',
                position: 'relative',
                height: '180px',
                cursor: 'pointer',
                border: survey.mood.includes(m.id) ? '3px solid var(--rum)' : '2px solid var(--light-grey)',
                transition: 'all 0.2s ease'
              }}>
                <img src={m.img} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.85))' }} />
                <div style={{ position: 'absolute', top: '10px', left: '10px', fontSize: '20px' }}>{m.emoji}</div>
                {survey.mood.includes(m.id) && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--rum)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="check" size={12} />
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: '12px', left: '12px', right: '12px', fontSize: '15px', fontWeight: 700, color: 'white' }}>{m.name}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" onClick={nextStep} disabled={survey.mood.length === 0} style={{ width: '100%' }}>Fawud</button>
        </div>
      )
    }

    if (key === 'time') {
      return (
        <div>
          <div className="section-eyebrow">2 of 5</div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', color: 'var(--black)' }}>How much time yuh have?</h2>
          <p style={{ fontSize: '14px', color: 'var(--grey)', marginBottom: '20px' }}>This shapes how big a bundle we build.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {Object.entries(TIME_META).map(([id, meta]) => (
              <div key={id} onClick={() => { setSurvey(prev => ({ ...prev, time: id })); setTimeout(nextStep, 200) }} style={{
                padding: '16px',
                borderRadius: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                border: survey.time === id ? '2px solid var(--rum)' : '2px solid var(--light-grey)',
                background: survey.time === id ? 'rgba(255,75,43,0.08)' : 'var(--card-bg)',
                transition: 'all 0.15s ease'
              }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--light-grey)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{meta.emoji}</div>
                <div>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--black)' }}>{meta.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (key === 'crew') {
      return (
        <div>
          <div className="section-eyebrow">3 of 5</div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', color: 'var(--black)' }}>Who&apos;s coming?</h2>
          <p style={{ fontSize: '14px', color: 'var(--grey)', marginBottom: '20px' }}>Add your crew now — we&apos;ll build the split as we go.</p>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <input
              value={crewInput}
              onChange={(e) => setCrewInput(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter') addCrewMember() }}
              placeholder="Add a name"
              style={{ flex: 1, padding: '14px', borderRadius: '14px', border: '1px solid var(--light-grey)', background: 'var(--card-bg)', fontSize: '14px', fontFamily: 'inherit', color: 'var(--black)', outline: 'none' }}
            />
            <button onClick={addCrewMember} style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--rum)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <Icon name="plus" size={18} />
            </button>
          </div>
          {survey.crew.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {survey.crew.map((name, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px 6px 6px', borderRadius: '100px', background: 'var(--card-bg)', border: '1px solid var(--light-grey)' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, color: '#0F0E0C' }}>
                    {name[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--black)' }}>{name}</span>
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-primary" onClick={nextStep} style={{ width: '100%' }}>Fawud</button>
        </div>
      )
    }

    if (key === 'budget') {
      const captions = ['Keep it local and cheap', 'Mid-range — mix of local and premium', 'Treat yourself, premium spots', 'No limit — top tier everything']
      return (
        <div>
          <div className="section-eyebrow">4 of 5</div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', color: 'var(--black)' }}>How yuh want to spend?</h2>
          <p style={{ fontSize: '14px', color: 'var(--grey)', marginBottom: '30px' }}>Per person, for the whole bundle.</p>
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '48px', fontWeight: 900, fontFamily: 'Space Mono, monospace', color: 'var(--gold)' }}>
              {['$', '$$', '$$$', '$$$$'][survey.budget - 1]}
            </span>
          </div>
          <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--grey)', marginBottom: '30px' }}>{captions[survey.budget - 1]}</p>
          <input
            type="range"
            min="1"
            max="4"
            value={survey.budget}
            onChange={(e) => setSurvey(prev => ({ ...prev, budget: parseInt(e.target.value) }))}
            style={{ width: '100%', height: '6px', borderRadius: '100px', background: 'linear-gradient(90deg, var(--gold), var(--rum-bright))', outline: 'none', WebkitAppearance: 'none', marginBottom: '10px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--grey)', fontWeight: 600, marginBottom: '30px' }}>
            <span>Local</span>
            <span>No limit</span>
          </div>
          <button className="btn btn-primary" onClick={nextStep} style={{ width: '100%' }}>Fawud</button>
        </div>
      )
    }

    if (key === 'occasion') {
      return (
        <div>
          <div className="section-eyebrow">5 of 5</div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', color: 'var(--black)' }}>One more ting.</h2>
          <p style={{ fontSize: '14px', color: 'var(--grey)', marginBottom: '20px' }}>Anything we should build around?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {Object.entries(OCCASION_META).map(([id, meta]) => (
              <div key={id} onClick={() => { setSurvey(prev => ({ ...prev, occasion: id })); setTimeout(nextStep, 300) }} style={{
                padding: '16px',
                borderRadius: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                border: survey.occasion === id ? '2px solid var(--rum)' : '2px solid var(--light-grey)',
                background: survey.occasion === id ? 'rgba(255,75,43,0.08)' : 'var(--card-bg)',
                transition: 'all 0.15s ease'
              }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--light-grey)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{meta.emoji}</div>
                <div>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--black)' }}>{meta.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return null
  }

  // ============ MAIN RENDER ============
  if (screen === 'survey') {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--off-white)', paddingBottom: '80px', overflowX: 'hidden' }}>
        <TopBar />
        <div style={{ padding: '16px' }}>
          {/* Progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <button onClick={backStep} style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--card-bg)', border: '1px solid var(--light-grey)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="back" size={14} />
            </button>
            <div style={{ flex: 1, height: '4px', borderRadius: '100px', background: 'var(--light-grey)', display: 'flex', gap: '4px', overflow: 'hidden' }}>
              {surveySteps.map((_, i) => (
                <div key={i} style={{ flex: 1, borderRadius: '100px', background: i < surveyStep ? 'linear-gradient(90deg, var(--rum), var(--gold))' : 'rgba(255,255,255,0.3)', transition: 'all 0.3s ease' }} />
              ))}
            </div>
          </div>

          {/* Receipt chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px', minHeight: '32px' }}>
            {survey.mood.length === 0 && !survey.time && survey.crew.length === 0 && !survey.occasion && (
              <span style={{ fontSize: '12px', color: 'var(--grey)', fontStyle: 'italic' }}>Your trip builds here as you go →</span>
            )}
            {survey.mood.map(m => (
              <span key={m} style={{ padding: '6px 12px', borderRadius: '100px', background: 'var(--card-bg)', border: '1px solid var(--light-grey)', fontSize: '11px', fontWeight: 600 }}>
                {MOOD_EMOJIS[m] || '🌴'} {m}
              </span>
            ))}
            {survey.time && (
              <span style={{ padding: '6px 12px', borderRadius: '100px', background: 'var(--card-bg)', border: '1px solid var(--light-grey)', fontSize: '11px', fontWeight: 600 }}>
                {TIME_META[survey.time].emoji} {TIME_META[survey.time].label}
              </span>
            )}
            {survey.crew.length > 0 && (
              <span style={{ padding: '6px 12px', borderRadius: '100px', background: 'var(--card-bg)', border: '1px solid var(--light-grey)', fontSize: '11px', fontWeight: 600 }}>
                👥 {survey.crew.length + 1} people
              </span>
            )}
            {survey.occasion && (
              <span style={{ padding: '6px 12px', borderRadius: '100px', background: 'var(--card-bg)', border: '1px solid var(--light-grey)', fontSize: '11px', fontWeight: 600 }}>
                {OCCASION_META[survey.occasion].emoji} {OCCASION_META[survey.occasion].label}
              </span>
            )}
          </div>

          {renderSurveyContent()}
        </div>
        <Dock />
      </main>
    )
  }

  if (screen === 'loading') {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--off-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', paddingBottom: '80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '20px' }}>
          {['🌴', '🚕', '🍢'].map((emoji, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <div style={{ width: '20px', height: '2px', background: 'var(--light-grey)' }} />}
              <div style={{ width: '54px', height: '54px', borderRadius: '16px', background: 'var(--card-bg)', border: '1px solid var(--light-grey)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', animation: `pulse 1.5s ease-in-out ${i * 0.3}s infinite` }}>
                {emoji}
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--black)' }}>{loadingText}</p>
        <p style={{ fontSize: '13px', color: 'var(--grey)' }}>Building it around your crew</p>
      </main>
    )
  }

  if (screen === 'results') {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--off-white)', paddingBottom: '80px', overflowX: 'hidden' }}>
        <TopBar />
        <div style={{ padding: '16px' }}>
          <div style={{ marginBottom: '20px' }}>
            <div className="section-eyebrow">Curated for you</div>
            <h2 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--black)' }}>Yuh vibe, bundled.</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {bundles.map((bundle, i) => (
              <div key={bundle.id} onClick={() => openBundle(bundle)} className="featured-card" style={{ position: 'relative', height: '280px', cursor: 'pointer', overflow: 'hidden' }}>
                <img src={bundle.hero} alt={bundle.title} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,14,12,0.15) 0%, rgba(15,14,12,0.55) 45%, rgba(15,14,12,0.97) 100%)' }} />
                {i === 0 && (
                  <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 2, background: 'var(--rum)', color: 'white', fontSize: '10px', fontWeight: 800, letterSpacing: '1px', padding: '6px 11px', borderRadius: '100px' }}>
                    BEST MATCH
                  </div>
                )}
                <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 2, display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(0,0,0,0.5)', color: 'var(--gold)', fontSize: '11px', fontWeight: 800, padding: '6px 11px', borderRadius: '100px' }}>
                  <Icon name="sparkle" size={11} />
                  {bundle.pts}
                </div>
                <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '18px', color: 'white' }}>
                  <h3 style={{ fontSize: '21px', fontWeight: 800, marginBottom: '4px' }}>{bundle.title}</h3>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '14px' }}>
                    Built for your crew of {survey.crew.length + 1}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '14px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                    {bundle.stops.filter(s => s.type !== 'transport').map((stop, si) => (
                      <div key={si} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        {si > 0 && <Icon name="chevronRight" size={10} style={{ color: 'rgba(255,255,255,0.4)' }} />}
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
                          <img src={stop.img} alt={stop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '19px', fontWeight: 800, fontFamily: 'Space Mono, monospace' }}>
                      ${bundle.price} <small style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter', fontWeight: 600 }}>per person</small>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'white', color: 'var(--black)', fontSize: '12px', fontWeight: 800, padding: '8px 14px', borderRadius: '100px' }}>
                      Explore <Icon name="chevronRight" size={10} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Dock />
      </main>
    )
  }

  if (screen === 'detail' && selectedBundle) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--off-white)', paddingBottom: '80px', overflowX: 'hidden' }}>
        <div style={{ height: '220px', position: 'relative', overflow: 'hidden', marginBottom: '20px' }}>
          <img src={selectedBundle.hero} alt={selectedBundle.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,14,12,0.2) 0%, transparent 30%, rgba(15,14,12,0.95) 100%)' }} />
          <button onClick={() => setScreen('results')} style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 2, width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(15,14,12,0.5)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Icon name="back" size={14} />
          </button>
          <h2 style={{ position: 'absolute', bottom: '18px', left: '20px', right: '20px', fontSize: '24px', fontWeight: 800, color: 'white' }}>{selectedBundle.title}</h2>
        </div>

        <div style={{ padding: '0 16px' }}>
          <div className="section-heading-card" style={{ marginBottom: '16px' }}>
            <div className="section-heading">
              <span className="section-eyebrow">Your Route</span>
              <div className="section-title-row">
                <span className="section-accent-bar" />
                <span className="section-title">Timeline</span>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            {selectedBundle.stops.map((stop, i) => (
              stop.type === 'transport' ? (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0 6px 24px', fontSize: '12px', color: 'var(--grey)' }}>
                  <Icon name="chevronRight" size={12} />
                  {stop.label}
                </div>
              ) : (
                <div key={i} className="card" style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <img src={stop.img} alt={stop.name} style={{ width: '52px', height: '52px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--black)' }}>{stop.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--grey)' }}>{stop.time}</p>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--sea)', cursor: 'pointer' }} onClick={() => setShowChangePlan(true)}>Change</span>
                </div>
              )
            ))}
          </div>

          <div className="section-heading-card" style={{ marginBottom: '16px' }}>
            <div className="section-heading">
              <span className="section-eyebrow">Split Payment</span>
              <div className="section-title-row">
                <span className="section-accent-bar" />
                <span className="section-title">Who Pays What</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
              {['equal', 'custom'].map(mode => (
                <button key={mode} onClick={() => setSplitMode(mode as 'equal' | 'custom')} style={{ flex: 1, padding: '8px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: 'none', background: splitMode === mode ? 'var(--black)' : 'var(--light-grey)', color: splitMode === mode ? 'white' : 'var(--grey)', fontFamily: 'inherit' }}>
                  {mode === 'equal' ? 'Split equally' : 'Custom'}
                </button>
              ))}
            </div>
            {['You', ...(survey.crew.length ? survey.crew : ['Jules', 'Ken', 'Priya'])].map((name, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: i > 0 ? '1px solid var(--light-grey)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: '#0F0E0C' }}>{name[0].toUpperCase()}</div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--black)' }}>{name}</span>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'Space Mono, monospace', color: 'var(--black)' }}>${Math.round(selectedBundle.price)}</span>
              </div>
            ))}
          </div>

          <div className="section-heading-card" style={{ marginBottom: '16px' }}>
            <div className="section-heading">
              <span className="section-eyebrow">Invite</span>
              <div className="section-title-row">
                <span className="section-accent-bar" />
                <span className="section-title">Add Crew</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input
              value={detailInviteInput}
              onChange={(e) => setDetailInviteInput(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter') addDetailInvite() }}
              placeholder="Invite by name or number"
              style={{ flex: 1, padding: '14px', borderRadius: '14px', border: '1px solid var(--light-grey)', background: 'var(--card-bg)', fontSize: '14px', fontFamily: 'inherit', color: 'var(--black)', outline: 'none' }}
            />
            <button onClick={addDetailInvite} style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--rum)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <Icon name="plus" size={18} />
            </button>
          </div>

          <button className="btn btn-primary" onClick={confirmBundle} style={{ width: '100%' }}>Dun — book dis</button>
        </div>
        <Dock />
      </main>
    )
  }

  if (screen === 'active') {
    const realStopsList = realStops()
    const nextStop = realStopsList[currentStopIndex]
    const paidCount = payments.filter(p => p.paid).length
    const totalPaid = payments.reduce((a, p) => a + p.amount, 0)
    const etaMin = Math.floor(etaSeconds / 60)

    return (
      <main style={{ minHeight: '100vh', background: '#1a1530', paddingBottom: '0', overflow: 'hidden', position: 'relative' }}>
        {/* Map placeholder */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a1530 0%, #0F0E0C 100%)' }}>
          <svg viewBox="0 0 500 900" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%' }}>
            <rect width="500" height="900" fill="url(#mapGrad)" />
            <defs>
              <linearGradient id="mapGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1a1530" />
                <stop offset="100%" stopColor="#0F0E0C" />
              </linearGradient>
            </defs>
            {[...Array(10)].map((_, i) => (
              <line key={i} x1={i * 50} y1="0" x2={i * 50} y2="900" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            ))}
            {[...Array(18)].map((_, i) => (
              <line key={i} x1="0" y1={i * 50} x2="500" y2={i * 50} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            ))}
            <path d="M 80 620 Q 180 480 260 500 T 400 260" fill="none" stroke="#00E5CC" strokeWidth="3" strokeDasharray="6 6" opacity="0.8" />
            <circle cx="400" cy="260" r="8" fill="#FFB800" />
            <circle cx="400" cy="260" r="16" fill="none" stroke="#FFB800" strokeWidth="1.5" opacity="0.5" />
            <circle cx="80" cy="620" r="9" fill="#FF6B3D" />
          </svg>
        </div>

        {/* Top bar */}
        <div style={{ position: 'absolute', top: '0', left: '0', right: '0', zIndex: 20, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setScreen('results')} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(15,14,12,0.55)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Icon name="back" size={14} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15,14,12,0.55)', border: '1px solid rgba(255,255,255,0.15)', padding: '9px 14px', borderRadius: '100px' }}>
            <Icon name="sparkle" size={14} style={{ color: 'var(--gold)' }} />
            <span style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: '14px', color: 'var(--gold)' }}>{points}</span>
          </div>
        </div>

        {/* Bottom sheet */}
        <div style={{ position: 'absolute', left: '0', right: '0', bottom: '0', zIndex: 10, background: '#14120E', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '28px 28px 0 0', boxShadow: '0 -12px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
          <div style={{ padding: '12px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(245,239,230,0.6)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="live-dot" /> NEXT STOP
              </p>
              <p style={{ fontSize: '17px', fontWeight: 800, color: '#F5EFE6', marginTop: '3px' }}>{nextStop?.name || 'Complete'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '24px', fontWeight: 900, fontFamily: 'Space Mono, monospace', color: 'var(--sea)' }}>{etaMin}<small style={{ fontSize: '10px', fontFamily: 'Inter', color: 'rgba(245,239,230,0.6)' }}> min</small></span>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 30px', WebkitOverflowScrolling: 'touch' }}>
            {/* Stop strip */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', marginBottom: '22px' }}>
              {realStopsList.map((stop, i) => (
                <div key={i} style={{ flexShrink: 0, padding: '9px 14px', borderRadius: '100px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,0.15)', background: i < currentStopIndex ? 'rgba(0,229,204,0.1)' : i === currentStopIndex ? 'rgba(255,75,43,0.18)' : 'rgba(255,255,255,0.06)', color: i < currentStopIndex ? 'var(--sea)' : i === currentStopIndex ? 'var(--rum-bright)' : 'rgba(245,239,230,0.5)' }}>
                  {i < currentStopIndex && <Icon name="check" size={11} />}
                  {stop.name}
                </div>
              ))}
            </div>

            {/* Crew */}
            <p style={{ fontSize: '14px', fontWeight: 800, color: '#F5EFE6', marginBottom: '12px' }}>Your crew</p>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '22px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {groupMembers.map((member, i) => (
                <div key={i} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={() => cycleStatus(i)}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '50%', padding: '2px', background: member.status === 'arrived' ? 'var(--sea)' : member.status === 'enroute' ? 'var(--gold)' : 'rgba(255,255,255,0.12)' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: avatarColor(member.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 800, color: '#0F0E0C', border: '2px solid #14120E' }}>
                      {member.name[0].toUpperCase()}
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(245,239,230,0.7)' }}>{member.name}</span>
                  <span style={{ fontSize: '9px', color: 'rgba(245,239,230,0.5)' }}>{statusLabel(member.status)}</span>
                </div>
              ))}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={() => setShowInviteSheet(true)}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="plus" size={18} style={{ color: 'rgba(245,239,230,0.5)' }} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(245,239,230,0.7)' }}>Add</span>
              </div>
            </div>

            {/* Payments */}
            <p style={{ fontSize: '14px', fontWeight: 800, color: '#F5EFE6', marginBottom: '12px' }}>Split payment</p>
            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '18px', marginBottom: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'Space Mono, monospace', color: '#F5EFE6' }}>${totalPaid}</span>
                <span style={{ fontSize: '11px', color: 'rgba(245,239,230,0.6)' }}>{paidCount} of {payments.length} paid</span>
              </div>
              {payments.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: avatarColor(p.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: '#0F0E0C' }}>{p.name[0].toUpperCase()}</div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#F5EFE6' }}>{p.name}</span>
                  </div>
                  <span onClick={() => togglePaid(i)} style={{ fontSize: '11px', fontWeight: 800, padding: '5px 11px', borderRadius: '100px', cursor: 'pointer', background: p.paid ? 'rgba(0,229,204,0.15)' : 'rgba(255,75,43,0.15)', color: p.paid ? 'var(--sea)' : 'var(--rum-bright)' }}>
                    {p.paid ? 'Paid' : `$${p.amount} due`}
                  </span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowChangePlan(true)} style={{ flex: 1, padding: '14px', borderRadius: '16px', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#F5EFE6', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <Icon name="shuffle" size={18} />
                <span style={{ fontSize: '11px', fontWeight: 700 }}>Change plan</span>
              </button>
              <button onClick={() => setShowInviteSheet(true)} style={{ flex: 1, padding: '14px', borderRadius: '16px', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#F5EFE6', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <Icon name="share" size={18} />
                <span style={{ fontSize: '11px', fontWeight: 700 }}>Invite</span>
              </button>
              <button onClick={() => setShowRouteSheet(true)} style={{ flex: 1, padding: '14px', borderRadius: '16px', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#F5EFE6', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <Icon name="mapPin" size={18} />
                <span style={{ fontSize: '11px', fontWeight: 700 }}>Full route</span>
              </button>
            </div>
          </div>
        </div>

        {/* Adapting toast */}
        {adapting && (
          <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: 'rgba(15,14,12,0.94)', border: '1px solid rgba(255,255,255,0.15)', padding: '12px 20px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--sea)', animation: 'spin 0.7s linear infinite' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#F5EFE6' }}>Wi a fix di plan — updating route and ETA</span>
          </div>
        )}

        {/* Change plan sheet */}
        {showChangePlan && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowChangePlan(false)}>
            <div style={{ width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', background: '#161410', border: '1px solid rgba(255,255,255,0.15)', borderTopLeftRadius: '28px', borderTopRightRadius: '28px', padding: '22px 20px 34px' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ width: '36px', height: '4px', borderRadius: '100px', background: 'rgba(255,255,255,0.2)', margin: '0 auto 18px' }} />
              <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#F5EFE6', marginBottom: '4px' }}>Change your plan</h3>
              <p style={{ fontSize: '13px', color: 'rgba(245,239,230,0.6)', marginBottom: '20px' }}>Swap your next stop.</p>
              {['Sunset Catamaran', 'Blue Hole Falls', 'Jerk Pit Crawl'].map((name) => (
                <div key={name} onClick={() => setSwapSelection(name)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '16px', cursor: 'pointer', marginBottom: '10px', border: swapSelection === name ? '1px solid var(--rum-bright)' : '1px solid rgba(255,255,255,0.15)', background: swapSelection === name ? 'rgba(255,75,43,0.08)' : 'transparent' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="activity" size={20} style={{ color: '#F5EFE6' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#F5EFE6' }}>{name}</p>
                    <p style={{ fontSize: '11px', color: 'rgba(245,239,230,0.5)' }}>Swap option</p>
                  </div>
                </div>
              ))}
              <button className="btn btn-primary" onClick={applySwap} style={{ width: '100%', marginTop: '10px' }}>Fawud</button>
            </div>
          </div>
        )}

        {/* Invite sheet */}
        {showInviteSheet && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowInviteSheet(false)}>
            <div style={{ width: '100%', maxWidth: '520px', background: '#161410', border: '1px solid rgba(255,255,255,0.15)', borderTopLeftRadius: '28px', borderTopRightRadius: '28px', padding: '22px 20px 34px' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ width: '36px', height: '4px', borderRadius: '100px', background: 'rgba(255,255,255,0.2)', margin: '0 auto 18px' }} />
              <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#F5EFE6', marginBottom: '4px' }}>Invite someone in</h3>
              <p style={{ fontSize: '13px', color: 'rgba(245,239,230,0.6)', marginBottom: '20px' }}>They&apos;ll see the live plan and can join the split.</p>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <input
                  value={activeInviteInput}
                  onChange={(e) => setActiveInviteInput(e.target.value)}
                  onKeyPress={(e) => { if (e.key === 'Enter') addActiveInvite() }}
                  placeholder="Name or number"
                  style={{ flex: 1, padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', fontSize: '14px', fontFamily: 'inherit', color: '#F5EFE6', outline: 'none' }}
                />
                <button onClick={addActiveInvite} style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--rum)', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="plus" size={18} />
                </button>
              </div>
              <button className="btn btn-primary" onClick={() => setShowInviteSheet(false)} style={{ width: '100%' }}>Done</button>
            </div>
          </div>
        )}

        {/* Route sheet */}
        {showRouteSheet && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowRouteSheet(false)}>
            <div style={{ width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', background: '#161410', border: '1px solid rgba(255,255,255,0.15)', borderTopLeftRadius: '28px', borderTopRightRadius: '28px', padding: '22px 20px 34px' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ width: '36px', height: '4px', borderRadius: '100px', background: 'rgba(255,255,255,0.2)', margin: '0 auto 18px' }} />
              <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#F5EFE6', marginBottom: '4px' }}>Full route</h3>
              <p style={{ fontSize: '13px', color: 'rgba(245,239,230,0.6)', marginBottom: '20px' }}>Everything ahead of you today.</p>
              {activeStops.map((stop, i) => (
                stop.type === 'transport' ? (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0 6px 24px', fontSize: '12px', color: 'rgba(245,239,230,0.5)' }}>
                    <Icon name="chevronRight" size={12} />
                    {stop.label}
                  </div>
                ) : (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '16px', marginBottom: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}>
                    <img src={stop.img} alt={stop.name} style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover' }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#F5EFE6' }}>{stop.name}</p>
                      <p style={{ fontSize: '11px', color: 'rgba(245,239,230,0.5)' }}>{stop.time}</p>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    )
  }

  return null
}