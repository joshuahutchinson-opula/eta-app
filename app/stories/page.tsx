// app/stories/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { triggerHaptic } from '@/lib/haptics'

interface Story {
  id: string
  content: string
  type: string
  imageUrl: string
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

export default function StoriesPage() {
  const router = useRouter()
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
    fetchStories()
  }, [])

  const fetchStories = async () => {
    try {
      const response = await fetch('/api/stories')
      const data = await response.json()
      setStories(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error(error)
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

  const currentGroup = groups[groupIndex]
  const currentItem = currentGroup?.items[itemIndex]

  const exit = () => {
    setExiting(true)
    setTimeout(() => router.push('/'), 200)
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
    const timer = setTimeout(advance, ITEM_DURATION_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, itemIndex, paused, loading, exiting])

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
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>Nuh nuh stories</p>
        <button onClick={() => router.push('/')} className="btn btn-primary">Back Home</button>
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
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,14,12,0.55) 0%, transparent 22%, transparent 65%, rgba(15,14,12,0.75) 100%)' }} />
      </div>

      {/* Tap zones (sit above content, below header/footer UI) */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 3 }}>
        <div style={{ flex: 1 }} onClick={() => !isDraggingRef.current && handleTapZone('left')} />
        <div style={{ flex: 1 }} onClick={() => !isDraggingRef.current && handleTapZone('right')} />
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
                  animation: `storyFill ${ITEM_DURATION_MS}ms linear forwards`,
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
            PREMIUM
          </span>
        )}
        <button
          style={{ marginLeft: 'auto', width: '36px', height: '36px', background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { e.stopPropagation(); triggerHaptic('light'); exit() }}
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      {paused && (
        <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 24px)', left: '50%', transform: 'translateX(-50%)', marginTop: '48px', background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px', zIndex: 10 }}>
          Paused
        </div>
      )}

      {/* Story caption */}
      <div style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 40px)', left: '16px', right: '16px', zIndex: 5 }}>
        <p style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>{currentItem.content}</p>
      </div>
    </main>
  )
}
