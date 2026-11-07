// app/stories/page.tsx — stories for the selected region, Instagram-style,
// with the look of the old Vibe feed: full screen, one person (or vendor)
// per screen.
//   swipe up / down       next / previous person
//   tap right / left      next / previous story
//   hold                  pause
//   progress bars         one per story, at the top
//   reply / react         a message or a quick emoji (vendors see theirs in
//                         the vendor app)
//   swipe up on the tag   (or tap it) opens the tagged vendor or event
// Photos show for 5 s, videos for their length (up to 30 s) with their
// sound unless posted muted. Each story seen is marked on the account,
// which greys its ring on Home. Vendor-approved Instagram mentions play
// inside the vendor's ring. ?start=<vendorId|userId> opens that person.
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import ReportButton from '@/components/ReportButton'
import StoryOverlays from '@/components/stories/StoryOverlays'
import { useRegion } from '@/components/RegionProvider'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { apiJson, authHeaders } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { useLowData } from '@/lib/low-data'
import { triggerHaptic } from '@/lib/haptics'
import { useReducedMotion } from '@/lib/motion'
import { REACTIONS, type StoryOverlay } from '@/lib/story-overlays'

interface Story {
  id: string
  content: string
  imageUrl: string
  videoUrl?: string | null
  seen?: boolean
  vendorId?: string | null
  vendor: { name: string; isPremium: boolean; images?: string[] } | null
  userId?: string | null
  user: { name: string; avatarUrl: string | null } | null
  source?: 'eta' | 'instagram'
  igUsername?: string
  action?: { kind: 'vendor' | 'event'; id: string; name: string } | null
  overlays?: StoryOverlay[]
  drawingUrl?: string | null
  closeFriends?: boolean
  muted?: boolean
  createdAt: string
}

interface Group { key: string; name: string; avatar: string | null; isPremium: boolean; mine: boolean; items: Story[] }

const PHOTO_MS = 5000
const MAX_VIDEO_MS = 30000
const HOLD_MS = 200

export default function StoriesPage() {
  const router = useRouter()
  const { t } = useLang()
  const { city, town, ready } = useRegion()
  const [stories, setStories] = useState<Story[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [active, setActive] = useState(0)
  const feed = useRef<HTMLDivElement>(null)
  const startKey = useRef<string | null>(null)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const res = await fetch(`/api/stories?city=${city}`, { headers: authHeaders() })
      if (!res.ok) throw new Error('stories')
      const data = await res.json()
      setStories(Array.isArray(data) ? data : [])
    } catch {
      setFailed(true)
      setStories([])
    }
  }, [city])

  useEffect(() => { startKey.current = new URLSearchParams(window.location.search).get('start') }, [])
  useEffect(() => { if (ready) load() }, [ready, load])

  const groups = useMemo<Group[]>(() => {
    const me = getCurrentUser()?.id
    const map = new Map<string, Group>()
    // Oldest first inside a person, like Instagram.
    for (const s of [...(stories ?? [])].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))) {
      const key = s.vendorId || s.userId || s.id
      if (!map.has(key)) map.set(key, { key, name: s.vendor?.name || s.user?.name || 'ETA', avatar: s.vendor?.images?.[0] ?? s.user?.avatarUrl ?? null, isPremium: Boolean(s.vendor?.isPremium), mine: Boolean(me && s.userId === me), items: [] })
      map.get(key)!.items.push(s)
    }
    // People with something unseen first.
    return Array.from(map.values()).sort((a, b) => Number(b.items.some(i => !i.seen)) - Number(a.items.some(i => !i.seen)))
  }, [stories])

  // Open on the ring that was tapped.
  useEffect(() => {
    if (!groups.length || !startKey.current) return
    const i = groups.findIndex(g => g.key === startKey.current)
    startKey.current = null
    if (i > 0) requestAnimationFrame(() => { feed.current?.children[i]?.scrollIntoView({ behavior: 'auto' }); setActive(i) })
  }, [groups])

  // Which person is on screen.
  useEffect(() => {
    const el = feed.current
    if (!el) return
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting && e.intersectionRatio > 0.6) setActive(Number((e.target as HTMLElement).dataset.index))
    }, { root: el, threshold: [0.6] })
    Array.from(el.children).forEach(c => io.observe(c))
    return () => io.disconnect()
  }, [groups.length])

  const exit = useCallback(() => { if (window.history.length > 1) router.back(); else router.push('/') }, [router])
  const goTo = useCallback((i: number) => {
    if (i < 0) return
    if (i >= groups.length) { exit(); return }
    feed.current?.children[i]?.scrollIntoView({ behavior: 'smooth' })
  }, [groups.length, exit])

  if (stories === null) {
    return <main className="vibe-feed" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}><div className="sv-spinner" aria-label="…" /></main>
  }
  if (!groups.length) {
    return (
      <main className="vibe-feed" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', zIndex: 500 }}>
        <p style={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', padding: '0 24px' }}>{failed ? t('m.stories.failed') : t('m.stories.none', { town: town.name })}</p>
        {failed && <button onClick={load} className="btn btn-secondary">{t('m.error.retry')}</button>}
        <button onClick={() => router.push('/')} className="btn btn-primary">{t('m.stories.backHome')}</button>
      </main>
    )
  }

  return (
    <main ref={feed} className="vibe-feed sv-feed" style={{ zIndex: 500 }} aria-label={t('m.sv.title')}>
      {groups.map((g, i) => (
        <GroupSlide key={g.key} index={i} group={g} active={i === active} onNextGroup={() => goTo(i + 1)} onPrevGroup={() => goTo(i - 1)} onClose={exit} />
      ))}
    </main>
  )
}

function GroupSlide({ group, index, active, onNextGroup, onPrevGroup, onClose }: { group: Group; index: number; active: boolean; onNextGroup: () => void; onPrevGroup: () => void; onClose: () => void }) {
  const { t, lang } = useLang()
  const errorText = useErrorText()
  const router = useRouter()
  const reduce = useReducedMotion()
  const { lowData } = useLowData()
  const firstUnseen = Math.max(0, group.items.findIndex(s => !s.seen))
  const [item, setItem] = useState(firstUnseen)
  const [paused, setPaused] = useState(false)
  const [duration, setDuration] = useState(PHOTO_MS)
  const [soundBlocked, setSoundBlocked] = useState(false)
  const [userMuted, setUserMuted] = useState(false)
  const [reply, setReply] = useState('')
  const [typing, setTyping] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [burst, setBurst] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const swipe = useRef<number | null>(null)
  const seen = useRef(new Set<string>())
  const story = group.items[item]
  const hasVideo = Boolean(story?.videoUrl) && !lowData
  const stopped = !active || paused || typing

  // Back to its first unseen story whenever this person scrolls into view.
  useEffect(() => { if (active) { setItem(Math.max(0, group.items.findIndex(s => !s.seen && !seen.current.has(s.id)))); setDuration(PHOTO_MS) } }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mark seen (drives the grey ring on Home).
  useEffect(() => {
    if (!active || !story || story.seen || story.source === 'instagram' || seen.current.has(story.id) || !getCurrentUser()) return
    seen.current.add(story.id)
    fetch(`/api/stories/${story.id}/view`, { method: 'POST', headers: authHeaders() }).catch(() => {})
  }, [active, story])

  const next = useCallback(() => {
    triggerHaptic('light')
    setDuration(PHOTO_MS)
    if (item + 1 < group.items.length) setItem(item + 1)
    else onNextGroup()
  }, [item, group.items.length, onNextGroup])
  const prev = () => {
    triggerHaptic('light')
    setDuration(PHOTO_MS)
    if (item > 0) setItem(item - 1)
    else onPrevGroup()
  }

  // Photos advance on a timer; videos when they end (or at 30 s).
  useEffect(() => {
    if (stopped || !story) return
    const timer = setTimeout(next, duration)
    return () => clearTimeout(timer)
  }, [stopped, story, duration, next])

  // Play / pause, with sound unless it was posted muted.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (stopped) { v.pause(); return }
    v.muted = Boolean(story?.muted) || userMuted
    v.play().catch(() => { v.muted = true; setSoundBlocked(true); v.play().catch(() => {}) })
  }, [stopped, story, userMuted])

  const down = () => {
    held.current = false
    hold.current = setTimeout(() => { held.current = true; setPaused(true); triggerHaptic('selection') }, HOLD_MS)
  }
  const up = (side: 'left' | 'right') => {
    if (hold.current) { clearTimeout(hold.current); hold.current = null }
    if (held.current) { held.current = false; setPaused(false); return }
    if (side === 'right') next(); else prev()
  }

  const send = async (payload: { text?: string; emoji?: string }) => {
    if (!story) return
    if (!getCurrentUser()) { router.push(`/login?next=${encodeURIComponent('/stories')}`); return }
    try {
      await apiJson(`/api/stories/${story.id}/reply`, { method: 'POST', body: payload })
      triggerHaptic('medium')
      if (payload.emoji) { setBurst(payload.emoji); setTimeout(() => setBurst(null), 900) }
      setReply('')
      setTyping(false)
      setSent(t('m.sv.sent'))
      setTimeout(() => setSent(null), 1600)
    } catch (e) {
      setSent(errorText(e))
    }
  }

  const openAction = () => {
    if (!story?.action) return
    triggerHaptic('medium')
    router.push(story.action.kind === 'event' ? `/events/${story.action.id}` : `/vendor/${story.action.id}`)
  }

  if (!story) return <section className="vibe-slide" data-index={index} />
  const when = (() => {
    const mins = Math.max(1, Math.round((Date.now() - Date.parse(story.createdAt)) / 60000))
    return mins < 60 ? t('m.sv.minAgo', { n: mins }) : t('m.sv.hAgo', { n: Math.round(mins / 60) })
  })()
  const canReply = story.source !== 'instagram' && !group.mine

  return (
    <section className="vibe-slide sv-slide" data-index={index} aria-label={group.name}>
      <img className="vibe-poster" src={story.imageUrl} alt="" />
      {hasVideo && (
        <video
          ref={videoRef}
          key={story.id}
          src={story.videoUrl!}
          poster={story.imageUrl}
          playsInline
          preload="auto"
          onLoadedMetadata={e => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setDuration(Math.min(MAX_VIDEO_MS, Math.round(d * 1000))) }}
        />
      )}
      <StoryOverlays overlays={story.overlays ?? []} drawingUrl={story.drawingUrl} />
      <div className="vibe-shade" />

      {/* Tap zones: left a third back, the rest forward; hold anywhere to pause */}
      <div className="sv-taps">
        <button type="button" aria-label={t('m.stories.prev')} onPointerDown={down} onPointerUp={() => up('left')} onPointerCancel={() => { if (hold.current) clearTimeout(hold.current); setPaused(false) }} onContextMenu={e => e.preventDefault()} />
        <button type="button" aria-label={t('m.stories.next')} onPointerDown={down} onPointerUp={() => up('right')} onPointerCancel={() => { if (hold.current) clearTimeout(hold.current); setPaused(false) }} onContextMenu={e => e.preventDefault()} />
      </div>

      {/* Progress bars */}
      <div className="sv-bars">
        {group.items.map((s, i) => (
          <span key={s.id}>
            {i < item && <i style={{ width: '100%' }} />}
            {i === item && <i key={`${story.id}-${active}`} style={{ animation: active ? `storyFill ${duration}ms linear forwards` : 'none', animationPlayState: stopped ? 'paused' : 'running', width: reduce && !active ? 0 : undefined }} />}
          </span>
        ))}
      </div>

      {/* Who, when, and the controls */}
      <header className="sv-head">
        <span className="sv-avatar">{group.avatar ? <img src={group.avatar} alt="" /> : group.name.charAt(0)}</span>
        <span className="sv-name">{group.name}</span>
        {group.isPremium && <span className="sv-bon">B.O.N</span>}
        {story.closeFriends && <span className="sv-close-friends"><Icon name="star" size={10} /> {t('m.se.closeFriends')}</span>}
        <span className="sv-when num-font">{when}</span>
        <span className="sv-head-actions">
          {hasVideo && !story.muted && (
            <button type="button" className="sv-icon" onClick={() => { setSoundBlocked(false); setUserMuted(m => (soundBlocked ? false : !m)) }} aria-label={userMuted || soundBlocked ? t('m.stories.unmute') : t('m.stories.mute')}>
              <Icon name="audio" size={16} />{(userMuted || soundBlocked) && <span className="se-slash" aria-hidden />}
            </button>
          )}
          {story.source !== 'instagram' && <span onClick={() => setPaused(true)}><ReportButton targetType="STORY" targetId={story.id} tone="light" /></span>}
          <button type="button" className="sv-icon" onClick={() => { triggerHaptic('light'); onClose() }} aria-label={t('m.stories.close')}><Icon name="close" size={18} /></button>
        </span>
      </header>
      {soundBlocked && active && <button type="button" className="sv-sound" onClick={() => { setSoundBlocked(false); setUserMuted(false) }}><Icon name="audio" size={14} /> {t('m.sv.tapSound')}</button>}
      {paused && <p className="sv-paused">{t('m.stories.paused')}</p>}
      {burst && !reduce && <span className="sv-burst" aria-hidden>{burst}</span>}

      <footer className="sv-foot">
        {story.source === 'instagram' && story.igUsername && <p className="sv-ig"><Icon name="instagram" size={14} /> @{story.igUsername}</p>}
        {story.content && <p className="sv-caption">{story.content}</p>}
        {story.action && (
          <button
            type="button"
            className="sv-action"
            onClick={openAction}
            onTouchStart={e => { swipe.current = e.touches[0].clientY; e.stopPropagation() }}
            onTouchEnd={e => { if (swipe.current !== null && swipe.current - e.changedTouches[0].clientY > 40) openAction(); swipe.current = null }}
          >
            <Icon name="chevronDown" size={14} style={{ transform: 'rotate(180deg)' }} />
            <Icon name={story.action.kind === 'event' ? 'ticket' : 'navigate'} size={15} />
            <span>{story.action.kind === 'event' ? t('m.story.bookThis') : t('m.story.goHere')} · {story.action.name}</span>
          </button>
        )}
        {canReply && (
          <>
            <div className="sv-reactions" role="group" aria-label={t('m.sv.react')}>
              {REACTIONS.map(e => <button key={e} type="button" onClick={() => send({ emoji: e })} aria-label={t('m.sv.reactWith', { emoji: e })}>{e}</button>)}
            </div>
            <form className="sv-reply" onSubmit={ev => { ev.preventDefault(); if (reply.trim()) send({ text: reply.trim() }) }}>
              <input value={reply} onChange={e => setReply(e.target.value)} onFocus={() => setTyping(true)} onBlur={() => { if (!reply) setTyping(false) }} maxLength={500} placeholder={t('m.sv.replyTo', { name: group.name })} aria-label={t('m.sv.replyTo', { name: group.name })} lang={lang} />
              <button type="submit" disabled={!reply.trim()} aria-label={t('m.sv.send')}><Icon name="send" size={18} /></button>
            </form>
          </>
        )}
        {sent && <p className="sv-sent" role="status">{sent}</p>}
      </footer>
    </section>
  )
}
