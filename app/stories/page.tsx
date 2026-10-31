// app/stories/page.tsx — full-screen stories for the selected region.
// Photos show for 5 s, videos for their length (up to 30 s). Each story
// viewed is marked seen on the account, which greys its ring on Home.
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import ReportButton from '@/components/ReportButton'
import { useRegion } from '@/components/RegionProvider'
import { useLang } from '@/lib/i18n-client'
import { authHeaders } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { useLowData } from '@/lib/low-data'
import { triggerHaptic } from '@/lib/haptics'

interface Story {
  id: string
  content: string
  type: string
  imageUrl: string
  videoUrl?: string | null
  seen?: boolean
  vendorId?: string | null
  vendor: {
    name: string
    isPremium: boolean
  } | null
  userId?: string | null
  user: {
    name: string
    avatarUrl: string | null
  } | null
}

interface StoryGroup {
  key: string
  name: string
  isPremium: boolean
  items: Story[]
}

const ITEM_DURATION_MS = 5000
const MAX_VIDEO_MS = 30000

export default function StoriesPage() {
  const router = useRouter()
  const { t } = useLang()
  const { city, town, ready } = useRegion()
  const { lowData } = useLowData()
  const [durationMs, setDurationMs] = useState(ITEM_DURATION_MS)
  const [muted, setMuted] = useState(true)
  const seenRef = useRef(new Set<string>())
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [groupIndex, setGroupIndex] = useState(0)
  const [itemIndex, setItemIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [dragX, setDragX] = useState(0)
  const dragStartX = useRef<number | null>(null)
  const dragStartY = useRef<number | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDraggingRef = useRef(false)

  useEffect(() => {
    if (ready) fetchStories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, city])

  const [loadFailed, setLoadFailed] = useState(false)

  const fetchStories = async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const response = await fetch(`/api/stories?city=${city}`, { headers: authHeaders() })
      if (!response.ok) throw new Error('stories')
      const data = await response.json()
      setStories(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error(error)
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }

  const groups = useMemo<StoryGroup[]>(() => {
    const map = new Map<string, StoryGroup>()
    for (const s of stories) {
      const key = s.vendorId || s.userId || s.id
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: s.vendor?.name || s.user?.name || 'ETA',
          isPremium: !!s.vendor?.isPremium,
          items: []
        })
      }
      map.get(key)!.items.push(s)
    }
    return Array.from(map.values())
  }, [stories])

  // ?start=<vendorId|userId> opens that ring's stories (Home rings, vendor pages).
  const [startKey, setStartKey] = useState<string | null>(null)
  useEffect(() => { setStartKey(new URLSearchParams(window.location.search).get('start')) }, [])
  useEffect(() => {
    if (!startKey || groups.length === 0) return
    const i = groups.findIndex(g => g.key === startKey)
    if (i >= 0) { setGroupIndex(i); setItemIndex(0) }
  }, [startKey, groups])

  const currentGroup = groups[groupIndex]
  const currentItem = currentGroup?.items[itemIndex]
  const playVideo = Boolean(currentItem?.videoUrl) && !lowData

  // Mark each story seen once, for the ring on Home.
  useEffect(() => {
    setDurationMs(ITEM_DURATION_MS)
    if (!currentItem || currentItem.seen || seenRef.current.has(currentItem.id) || !getCurrentUser()) return
    seenRef.current.add(currentItem.id)
    fetch(`/api/stories/${currentItem.id}/view`, { method: 'POST', headers: authHeaders() }).catch(() => {})
  }, [currentItem])

  const exit = () => {
    setExiting(true)
    setTimeout(() => (startKey && window.history.length > 1 ? router.back() : router.push('/')), 200)
  }

  const goToItem = (nextGroupIndex: number, nextItemIndex: number) => {
    if (nextGroupIndex < 0) return
    if (nextGroupIndex >= groups.length) {
      exit()
      return
    }
    const group = groups[nextGroupIndex]
    if (nextItemIndex < 0) {
      // walked off the front of a group -> previous group's last item
      goToItem(nextGroupIndex - 1, (groups[nextGroupIndex - 1]?.items.length || 1) - 1)
      return
    }
    if (nextItemIndex >= group.items.length) {
      goToItem(nextGroupIndex + 1, 0)
      return
    }
    setGroupIndex(nextGroupIndex)
    setItemIndex(nextItemIndex)
  }

  const advance = () => {
    triggerHaptic('light')
    goToItem(groupIndex, itemIndex + 1)
  }

  const rewind = () => {
    triggerHaptic('light')
    goToItem(groupIndex, itemIndex - 1)
  }

  // Auto-advance the current item's progress fill, pausable on hold.
  useEffect(() => {
    if (loading || !currentItem || paused || exiting) return
    const timer = setTimeout(advance, durationMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, itemIndex, paused, loading, exiting, durationMs])

  const handlePointerDown = (clientX: number, clientY: number) => {
    dragStartX.current = clientX
    dragStartY.current = clientY
    isDraggingRef.current = false
    holdTimer.current = setTimeout(() => {
      setPaused(true)
      triggerHaptic('selection')
    }, 180)
  }

  const handlePointerMove = (clientX: number) => {
    if (dragStartX.current === null) return
    const dx = clientX - dragStartX.current
    if (Math.abs(dx) > 8) {
      isDraggingRef.current = true
      if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null }
      setPaused(true)
      setDragX(dx)
    }
  }

  const handlePointerUp = (clientX: number) => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null }
    const startX = dragStartX.current
    dragStartX.current = null
    dragStartY.current = null

    if (isDraggingRef.current && startX !== null) {
      const dx = clientX - startX
      setDragX(0)
      isDraggingRef.current = false
      setPaused(false)
      if (Math.abs(dx) > 60) {
        // Horizontal swipe: move between story groups
        triggerHaptic('selection')
        if (dx < 0) goToItem(groupIndex + 1, 0)
        else goToItem(groupIndex - 1, 0)
      }
      return
    }

    isDraggingRef.current = false
    setPaused(false)
  }

  const handleTapZone = (side: 'left' | 'right') => {
    if (side === 'right') advance()
    else rewind()
  }

  if (loading) {
    return (
      <main style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000000' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--rum)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </main>
    )
  }

  if (groups.length === 0) {
    return (
      <main style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', background: '#000000' }}>
        <p style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', padding: '0 24px' }}>{loadFailed ? t('m.stories.failed') : t('m.stories.none', { town: town.name })}</p>
        {loadFailed && <button onClick={fetchStories} className="btn btn-secondary">{t('m.error.retry')}</button>}
        <button onClick={() => router.push('/')} className="btn btn-primary">{t('m.stories.backHome')}</button>
      </main>
    )
  }

  if (!currentGroup || !currentItem) return null

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: '#000000',
        overflow: 'hidden',
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'scale(0.95)' : 'scale(1)',
        transition: 'opacity 0.2s ease, transform 0.2s ease'
      }}
      onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
      onMouseMove={(e) => { if (dragStartX.current !== null) handlePointerMove(e.clientX) }}
      onMouseUp={(e) => handlePointerUp(e.clientX)}
      onTouchStart={(e) => handlePointerDown(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => handlePointerMove(e.touches[0].clientX)}
      onTouchEnd={(e) => handlePointerUp(e.changedTouches[0].clientX)}
    >
      {/* Story content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${currentItem.imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transform: `translateX(${dragX * 0.4}px)`,
          transition: dragX === 0 ? 'transform 0.25s var(--spring-standard, ease-out)' : 'none'
        }}
      >
        {playVideo && (
          <video
            key={currentItem.id}
            src={currentItem.videoUrl!}
            poster={currentItem.imageUrl}
            autoPlay
            muted={muted}
            playsInline
            ref={el => { if (el) { if (paused) el.pause(); else el.play().catch(() => {}) } }}
            onLoadedMetadata={e => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setDurationMs(Math.min(MAX_VIDEO_MS, Math.round(d * 1000))) }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,14,12,0.55) 0%, transparent 22%, transparent 65%, rgba(15,14,12,0.75) 100%)' }} />
      </div>

      {/* Tap zones (sit above content, below header/footer UI) */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 3 }}>
        <button aria-label={t('m.stories.prev')} style={{ flex: 1, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => !isDraggingRef.current && handleTapZone('left')} />
        <button aria-label={t('m.stories.next')} style={{ flex: 1, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => !isDraggingRef.current && handleTapZone('right')} />
      </div>

      {/* Progress bars - one segment per item in the current group */}
      <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 10px)', left: '10px', right: '10px', display: 'flex', gap: '4px', zIndex: 10 }}>
        {currentGroup.items.map((_, i) => (
          <div key={i} style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.3)', borderRadius: '999px', overflow: 'hidden' }}>
            {i < itemIndex && <div style={{ height: '100%', width: '100%', background: 'white' }} />}
            {i === itemIndex && (
              <div
                key={`${groupIndex}-${itemIndex}`}
                style={{
                  height: '100%',
                  background: 'white',
                  animation: `storyFill ${durationMs}ms linear forwards`,
                  animationPlayState: paused ? 'paused' : 'running'
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 24px)', left: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10 }}>
        <div
          className={`story-ring ${currentGroup.isPremium ? 'premium' : 'standard'}`}
          style={{ width: '36px', height: '36px', padding: '2px', flexShrink: 0 }}
        >
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'white' }}>
            {currentGroup.name.charAt(0)}
          </div>
        </div>
        <span style={{ fontWeight: 700, fontSize: '14px', color: 'white' }}>{currentGroup.name}</span>
        {currentGroup.isPremium && (
          <span style={{ fontSize: '9px', background: 'var(--gold)', color: '#0F0E0C', fontWeight: 800, padding: '2px 6px', borderRadius: '999px' }}>
            {t('m.stories.premium')}
          </span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
          {playVideo && (
            <button aria-label={muted ? t('m.stories.unmute') : t('m.stories.mute')} onClick={e => { e.stopPropagation(); setMuted(m => !m) }} style={{ width: '44px', height: '44px', background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="audio" size={16} />
            </button>
          )}
          <span onClick={() => setPaused(true)}><ReportButton targetType="STORY" targetId={currentItem.id} tone="light" /></span>
        </span>
        <button
          aria-label={t('m.stories.close')}
          style={{ width: '44px', height: '44px', background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { e.stopPropagation(); triggerHaptic('light'); exit() }}
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      {paused && (
        <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 24px)', left: '50%', transform: 'translateX(-50%)', marginTop: '48px', background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px', zIndex: 10 }}>
          {t('m.stories.paused')}
        </div>
      )}

      {/* Story caption */}
      <div style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 40px)', left: '16px', right: '16px', zIndex: 5 }}>
        <p style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>{currentItem.content}</p>
      </div>
    </main>
  )
}
