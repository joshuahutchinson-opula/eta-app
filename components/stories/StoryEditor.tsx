// components/stories/StoryEditor.tsx — after the camera: dress the photo or
// video up and share it, Instagram-style.
//   Aa        text: tap to type; three fonts, colours, a filled background
//   stickers  location, tag a vendor or an event, the time
//   draw      a simple pen (colours, three sizes, undo)
//   layers    drag to move, pinch to resize and turn; drop on the bin to
//             remove; tap a text to edit it
//   sound     videos keep their sound unless muted here
//   share     "Your story" or "Close friends" (only the friends they pick)
// Layers are saved as data (lib/story-overlays.ts) and drawn over the
// media by the viewer; the drawing goes up as a transparent PNG.
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/lib/icons'
import { OverlayLayer, placeStyle } from '@/components/stories/StoryOverlays'
import { useRegion } from '@/components/RegionProvider'
import { apiJson, uploadMedia } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'
import { sortByDistance, useUserLocation } from '@/lib/geo'
import { STORY_COLORS, STORY_FONTS, type StickerKind, type StoryFont, type StoryOverlay, type TextOverlay } from '@/lib/story-overlays'
import type { Captured } from '@/components/stories/StoryCamera'

interface Stroke { color: string; width: number; points: Array<[number, number]> }
const PEN_SIZES = [4, 9, 18]

export default function StoryEditor({ media, onBack, onPosted }: { media: Captured; onBack: () => void; onPosted: () => void }) {
  const { t, lang } = useLang()
  const errorText = useErrorText()
  const { city, town } = useRegion()
  const location = useUserLocation()
  const stage = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [overlays, setOverlays] = useState<StoryOverlay[]>([])
  const [editing, setEditing] = useState<{ index: number | null; draft: TextOverlay } | null>(null)
  const [mode, setMode] = useState<'idle' | 'draw' | 'stickers'>('idle')
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [pen, setPen] = useState<{ color: string; width: number }>({ color: '#FFFFFF', width: PEN_SIZES[1] })
  const [muted, setMuted] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)
  const [overBin, setOverBin] = useState(false)
  const [busy, setBusy] = useState<false | 'story' | 'close'>(false)
  const [error, setError] = useState<string | null>(null)
  const [friendsOpen, setFriendsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // ---------- Layers: drag, pinch, rotate, bin ----------
  const gesture = useRef<{ index: number; pointers: Map<number, { x: number; y: number }>; start: { x: number; y: number; scale: number; rotate: number }; p0: Array<{ x: number; y: number }>; moved: boolean } | null>(null)

  const rect = () => stage.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }

  const onLayerDown = (index: number) => (e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const o = overlays[index]
    const g = gesture.current && gesture.current.index === index ? gesture.current : { index, pointers: new Map(), start: { x: o.x, y: o.y, scale: o.scale, rotate: o.rotate }, p0: [], moved: false }
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    g.start = { x: o.x, y: o.y, scale: o.scale, rotate: o.rotate }
    g.p0 = Array.from(g.pointers.values()).map(p => ({ ...p }))
    gesture.current = g
  }

  const onLayerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g || !g.pointers.has(e.pointerId)) return
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = Array.from(g.pointers.values())
    const r = rect()
    let next: Partial<StoryOverlay>
    if (pts.length >= 2 && g.p0.length >= 2) {
      const d0 = Math.hypot(g.p0[1].x - g.p0[0].x, g.p0[1].y - g.p0[0].y) || 1
      const d1 = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
      const a0 = Math.atan2(g.p0[1].y - g.p0[0].y, g.p0[1].x - g.p0[0].x)
      const a1 = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x)
      const c0 = { x: (g.p0[0].x + g.p0[1].x) / 2, y: (g.p0[0].y + g.p0[1].y) / 2 }
      const c1 = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      next = {
        scale: Math.max(0.3, Math.min(5, g.start.scale * (d1 / d0))),
        rotate: g.start.rotate + ((a1 - a0) * 180) / Math.PI,
        x: Math.max(0, Math.min(1, g.start.x + (c1.x - c0.x) / r.width)),
        y: Math.max(0, Math.min(1, g.start.y + (c1.y - c0.y) / r.height))
      }
    } else {
      const dx = pts[0].x - g.p0[0].x
      const dy = pts[0].y - g.p0[0].y
      if (Math.hypot(dx, dy) > 4) g.moved = true
      next = { x: Math.max(0, Math.min(1, g.start.x + dx / r.width)), y: Math.max(0, Math.min(1, g.start.y + dy / r.height)) }
      setOverBin(pts[0].y > r.top + r.height - 110 && Math.abs(pts[0].x - (r.left + r.width / 2)) < 70)
    }
    if (g.moved || pts.length >= 2) setDragging(g.index)
    setOverlays(os => os.map((o, i) => (i === g.index ? ({ ...o, ...next } as StoryOverlay) : o)))
  }

  const onLayerUp = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g) return
    g.pointers.delete(e.pointerId)
    if (g.pointers.size > 0) { g.p0 = Array.from(g.pointers.values()); const o = overlays[g.index]; g.start = { x: o.x, y: o.y, scale: o.scale, rotate: o.rotate }; return }
    const index = g.index
    const tapped = !g.moved && dragging === null
    gesture.current = null
    setDragging(null)
    if (overBin) { triggerHaptic('medium'); setOverlays(os => os.filter((_, i) => i !== index)); setOverBin(false); return }
    setOverBin(false)
    const o = overlays[index]
    if (tapped && o?.type === 'text') setEditing({ index, draft: o })
  }

  // ---------- Text ----------
  const newText = () => {
    triggerHaptic('light')
    setMode('idle')
    setEditing({ index: null, draft: { type: 'text', text: '', font: 'classic', color: '#FFFFFF', background: false, x: 0.5, y: 0.42, scale: 1, rotate: 0 } })
  }
  const commitText = () => {
    if (!editing) return
    const text = editing.draft.text.trim()
    setOverlays(os => {
      if (editing.index === null) return text ? [...os, { ...editing.draft, text }] : os
      return text ? os.map((o, i) => (i === editing.index ? { ...editing.draft, text } : o)) : os.filter((_, i) => i !== editing.index)
    })
    setEditing(null)
  }

  // ---------- Stickers ----------
  const addSticker = (kind: StickerKind, label: string, refId?: string) => {
    triggerHaptic('light')
    setOverlays(os => [...os, { type: 'sticker', kind, label, ...(refId ? { refId } : {}), x: 0.5, y: 0.3 + (os.length % 4) * 0.08, scale: 1, rotate: kind === 'time' ? -4 : 0 }])
    setMode('idle')
  }

  // ---------- Drawing ----------
  const drawing = useRef<Stroke | null>(null)
  const redraw = useCallback((list: Stroke[]) => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const s of list) {
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.width
      ctx.beginPath()
      s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      if (s.points.length === 1) ctx.lineTo(s.points[0][0] + 0.1, s.points[0][1])
      ctx.stroke()
    }
  }, [])
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const r = c.getBoundingClientRect()
    c.width = Math.round(r.width * dpr)
    c.height = Math.round(r.height * dpr)
    redraw(strokes)
  }, [mounted]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { redraw(strokes) }, [strokes, redraw])

  const penDown = (e: React.PointerEvent) => {
    if (mode !== 'draw') return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const r = rect()
    drawing.current = { ...pen, points: [[e.clientX - r.left, e.clientY - r.top]] }
    redraw([...strokes, drawing.current])
  }
  const penMove = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const r = rect()
    drawing.current.points.push([e.clientX - r.left, e.clientY - r.top])
    redraw([...strokes, drawing.current])
  }
  const penUp = () => {
    if (!drawing.current) return
    const s = drawing.current
    drawing.current = null
    setStrokes(list => [...list, s])
  }

  // ---------- Video sound ----------
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = muted
    v.play().catch(() => { v.muted = true; setMuted(true) })
  }, [muted])

  // ---------- Share ----------
  const share = async (closeFriends: boolean) => {
    if (closeFriends) {
      const list = await apiJson<{ friends: string[] }>('/api/close-friends').catch(() => ({ friends: [] as string[] }))
      if (!list.friends.length) { setFriendsOpen(true); return }
    }
    setBusy(closeFriends ? 'close' : 'story')
    setError(null)
    try {
      const up = await uploadMedia(media.file, 'stories')
      let drawingUrl: string | undefined
      if (strokes.length && canvasRef.current) {
        const blob = await new Promise<Blob | null>(res => canvasRef.current!.toBlob(res, 'image/png'))
        if (blob) drawingUrl = (await uploadMedia(new File([blob], 'drawing.png', { type: 'image/png' }), 'stories')).url
      }
      const vendor = overlays.find(o => o.type === 'sticker' && o.kind === 'vendor' && o.refId)
      const event = overlays.find(o => o.type === 'sticker' && o.kind === 'event' && o.refId)
      await apiJson('/api/stories', {
        method: 'POST',
        body: {
          imageUrl: up.kind === 'video' ? up.poster ?? up.url : up.url,
          ...(up.kind === 'video' ? { videoUrl: up.url, muted } : {}),
          city,
          overlays,
          ...(drawingUrl ? { drawingUrl } : {}),
          closeFriends,
          ...(vendor && vendor.type === 'sticker' ? { placeVendorId: vendor.refId } : {}),
          ...(event && event.type === 'sticker' ? { eventId: event.refId } : {})
        }
      })
      triggerHaptic('medium')
      URL.revokeObjectURL(media.url)
      onPosted()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const avatar = getCurrentUser()?.avatarUrl ?? null
  if (!mounted) return null
  return createPortal(
    <div className="se" role="dialog" aria-modal="true" aria-label={t('m.se.title')}>
      <div ref={stage} className="se-stage" onPointerDown={penDown} onPointerMove={penMove} onPointerUp={penUp} onPointerCancel={penUp}
        onClick={e => { if (mode === 'idle' && e.target === e.currentTarget) newText() }}>
        {media.kind === 'video'
          ? <video ref={videoRef} src={media.url} className="se-media" loop playsInline autoPlay muted={muted} onClick={e => { if (mode === 'idle') { e.stopPropagation(); newText() } }} />
          : <img src={media.url} alt="" className="se-media" onClick={e => { if (mode === 'idle') { e.stopPropagation(); newText() } }} />}
        <canvas ref={canvasRef} className={`se-canvas ${mode === 'draw' ? 'live' : ''}`} />
        {overlays.map((o, i) => (editing?.index === i ? null : (
          <div key={i} className={`so-item se-layer ${dragging === i ? 'dragging' : ''} ${dragging === i && overBin ? 'binning' : ''}`} style={placeStyle(o)}
            onPointerDown={mode === 'idle' ? onLayerDown(i) : undefined} onPointerMove={onLayerMove} onPointerUp={onLayerUp} onPointerCancel={onLayerUp}>
            <OverlayLayer o={o} />
          </div>
        )))}
      </div>

      {/* Top: back, then the tools */}
      {!editing && mode !== 'draw' && (
        <div className="se-top">
          <button type="button" className="cam-btn" onClick={() => { URL.revokeObjectURL(media.url); onBack() }} aria-label={t('m.se.back')}><Icon name="chevronLeft" size={22} /></button>
          <div className="se-tools">
            {media.kind === 'video' && <button type="button" className={`cam-btn ${muted ? '' : 'on'}`} aria-pressed={!muted} onClick={() => setMuted(m => !m)} aria-label={muted ? t('m.se.soundOn') : t('m.se.soundOff')}><Icon name="audio" size={20} />{muted && <span className="se-slash" aria-hidden />}</button>}
            <button type="button" className="cam-btn" onClick={newText} aria-label={t('m.se.text')}><span className="se-aa">Aa</span></button>
            <button type="button" className="cam-btn" onClick={() => { triggerHaptic('light'); setMode('stickers') }} aria-label={t('m.se.stickers')}><Icon name="sparkle" size={20} /></button>
            <button type="button" className="cam-btn" onClick={() => { triggerHaptic('light'); setMode('draw') }} aria-label={t('m.se.draw')}><Icon name="journal" size={20} /></button>
          </div>
        </div>
      )}

      {/* Drawing tools */}
      {mode === 'draw' && (
        <div className="se-top">
          <button type="button" className="cam-btn" onClick={() => setStrokes(s => s.slice(0, -1))} disabled={!strokes.length} aria-label={t('m.se.undo')}><Icon name="back" size={20} /></button>
          <div className="se-sizes" role="radiogroup" aria-label={t('m.se.penSize')}>
            {PEN_SIZES.map(w => <button key={w} type="button" role="radio" aria-checked={pen.width === w} className={pen.width === w ? 'on' : ''} onClick={() => setPen(p => ({ ...p, width: w }))}><span style={{ width: w + 4, height: w + 4, background: pen.color }} /></button>)}
          </div>
          <button type="button" className="se-done" onClick={() => setMode('idle')}>{t('m.cal.done')}</button>
        </div>
      )}
      {mode === 'draw' && <Palette value={pen.color} onPick={c => setPen(p => ({ ...p, color: c }))} />}

      {/* The bin, while dragging a layer */}
      {dragging !== null && <div className={`se-bin ${overBin ? 'over' : ''}`} aria-hidden><Icon name="trash" size={22} /></div>}

      {/* Share */}
      {!editing && mode === 'idle' && dragging === null && (
        <div className="se-share">
          {error && <p role="alert" className="se-error">{error}</p>}
          <button type="button" className="se-share-btn" onClick={() => share(false)} disabled={busy !== false}>
            <span className="se-avatar">{avatar ? <img src={avatar} alt="" /> : <Icon name="user" size={14} />}</span>
            {busy === 'story' ? t('m.stories.posting') : t('m.se.yourStory')}
          </button>
          <button type="button" className="se-share-btn close" onClick={() => share(true)} disabled={busy !== false}>
            <span className="se-star"><Icon name="star" size={13} /></span>
            {busy === 'close' ? t('m.stories.posting') : t('m.se.closeFriends')}
          </button>
        </div>
      )}

      {editing && <TextEditor draft={editing.draft} onChange={d => setEditing(ed => (ed ? { ...ed, draft: d } : ed))} onDone={commitText} />}
      {mode === 'stickers' && <StickerSheet city={city} townName={town.name} location={location} lang={lang} onPick={addSticker} onClose={() => setMode('idle')} />}
      {friendsOpen && <CloseFriendsSheet onClose={saved => { setFriendsOpen(false); if (saved) share(true) }} />}
    </div>,
    document.body
  )
}

function Palette({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div className="se-palette" role="radiogroup" aria-label="Colour">
      {STORY_COLORS.map(c => <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} className={value === c ? 'on' : ''} style={{ background: c }} onClick={() => { triggerHaptic('selection'); onPick(c) }} />)}
    </div>
  )
}

function TextEditor({ draft, onChange, onDone }: { draft: TextOverlay; onChange: (d: TextOverlay) => void; onDone: () => void }) {
  const { t } = useLang()
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  const fontLabel: Record<StoryFont, string> = { classic: t('m.se.fontClassic'), mono: t('m.se.fontMono'), script: t('m.se.fontScript') }
  return (
    <div className="se-text-modal">
      <div className="se-top">
        <button type="button" className={`cam-btn ${draft.background ? 'on' : ''}`} aria-pressed={Boolean(draft.background)} onClick={() => onChange({ ...draft, background: !draft.background })} aria-label={t('m.se.textBg')}><span className="se-aa boxed">A</span></button>
        <div className="se-fonts" role="radiogroup" aria-label={t('m.se.font')}>
          {STORY_FONTS.map(f => <button key={f} type="button" role="radio" aria-checked={draft.font === f} className={draft.font === f ? 'on' : ''} onClick={() => onChange({ ...draft, font: f })}>{fontLabel[f]}</button>)}
        </div>
        <button type="button" className="se-done" onClick={onDone}>{t('m.cal.done')}</button>
      </div>
      <div className="se-text-input" onClick={() => ref.current?.focus()}>
        <div className="so-item" style={{ left: '50%', top: '42%', transform: 'translate(-50%, -50%)' }}>
          <OverlayLayer o={{ ...draft, text: draft.text || ' ' }} />
        </div>
        <textarea ref={ref} value={draft.text} maxLength={200} onChange={e => onChange({ ...draft, text: e.target.value })} aria-label={t('m.se.text')} className="se-textarea" />
      </div>
      <Palette value={draft.color} onPick={c => onChange({ ...draft, color: c })} />
    </div>
  )
}

function StickerSheet({ city, townName, location, lang, onPick, onClose }: { city: string; townName: string; location: { lat: number; lng: number } | null; lang: string; onPick: (k: StickerKind, label: string, refId?: string) => void; onClose: () => void }) {
  const { t } = useLang()
  const [tab, setTab] = useState<'main' | 'vendor' | 'event'>('main')
  const [q, setQ] = useState('')
  const [vendors, setVendors] = useState<Array<{ id: string; name: string; neighborhood?: string; lat?: number | null; lng?: number | null }>>([])
  const [events, setEvents] = useState<Array<{ id: string; title: string; venueName: string }>>([])
  useEffect(() => {
    fetch(`/api/vendors?city=${city}&limit=60`).then(r => (r.ok ? r.json() : [])).then(d => setVendors(Array.isArray(d) ? d : [])).catch(() => {})
    fetch(`/api/events?city=${city}&days=14&limit=30`).then(r => (r.ok ? r.json() : [])).then(d => setEvents(Array.isArray(d) ? d : [])).catch(() => {})
  }, [city])
  const near = useMemo(() => sortByDistance(vendors, location), [vendors, location])
  const nearest = near[0]
  const time = new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : lang, { hour: 'numeric', minute: '2-digit', timeZone: 'America/Jamaica' })
  const term = q.trim().toLowerCase()
  return (
    <>
      <div className="bottom-sheet-overlay open" onClick={onClose} style={{ zIndex: 1310 }} />
      <div className="bottom-sheet open se-sheet" role="dialog" aria-modal="true" aria-label={t('m.se.stickers')} style={{ zIndex: 1311 }}>
        <div className="sheet-grabber" />
        {tab === 'main' ? (
          <div className="se-sticker-grid">
            <button type="button" onClick={() => onPick('location', location && nearest && nearest.lat ? `${nearest.name}` : townName)}><span className="so-sticker location"><Icon name="mapPin" size={15} /><span>{t('m.se.location')}</span></span></button>
            <button type="button" onClick={() => setTab('vendor')}><span className="so-sticker vendor"><Icon name="marketplace" size={15} /><span>{t('m.se.vendor')}</span></span></button>
            <button type="button" onClick={() => setTab('event')}><span className="so-sticker event"><Icon name="ticket" size={15} /><span>{t('m.se.event')}</span></span></button>
            <button type="button" onClick={() => onPick('time', time)}><span className="so-sticker time"><Icon name="clock" size={15} /><span className="num-font">{time}</span></span></button>
          </div>
        ) : (
          <div className="se-pick">
            <div className="se-pick-head">
              <button type="button" className="icon-btn" onClick={() => { setTab('main'); setQ('') }} aria-label={t('m.se.back')}><Icon name="chevronLeft" size={16} /></button>
              <label className="plan-search" style={{ flex: 1 }}>
                <Icon name="search" size={16} style={{ color: 'var(--label-secondary)' }} />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder={tab === 'vendor' ? t('m.se.findVendor') : t('m.se.findEvent')} aria-label={tab === 'vendor' ? t('m.se.findVendor') : t('m.se.findEvent')} />
              </label>
            </div>
            <ul className="tp-list">
              {tab === 'vendor'
                ? near.filter(v => !term || v.name.toLowerCase().includes(term)).slice(0, 40).map(v => (
                  <li key={v.id}><button type="button" className="tp-row" onClick={() => onPick('vendor', v.name, v.id)}><span className="tp-photo"><Icon name="marketplace" size={16} /></span><span className="tp-text"><span className="tp-name">{v.name}</span>{v.neighborhood && <span className="tp-sub">{v.neighborhood}</span>}</span></button></li>
                ))
                : events.filter(ev => !term || ev.title.toLowerCase().includes(term)).map(ev => (
                  <li key={ev.id}><button type="button" className="tp-row" onClick={() => onPick('event', ev.title, ev.id)}><span className="tp-photo"><Icon name="ticket" size={16} /></span><span className="tp-text"><span className="tp-name">{ev.title}</span><span className="tp-sub">{ev.venueName}</span></span></button></li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </>
  )
}

/** Who sees "Close friends" stories: picked from people they've travelled with. */
export function CloseFriendsSheet({ onClose }: { onClose: (saved: boolean) => void }) {
  const { t } = useLang()
  const errorText = useErrorText()
  const [data, setData] = useState<{ friends: string[]; people: Array<{ id: string; name: string; avatarUrl: string | null }> } | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    apiJson<NonNullable<typeof data>>('/api/close-friends').then(d => { setData(d); setPicked(new Set(d.friends)) }).catch(e => setError(errorText(e)))
  }, [errorText])
  const save = async () => {
    setBusy(true)
    try { await apiJson('/api/close-friends', { method: 'PUT', body: { friendIds: Array.from(picked) } }); onClose(picked.size > 0) } catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }
  return (
    <>
      <div className="bottom-sheet-overlay open" onClick={() => onClose(false)} style={{ zIndex: 1310 }} />
      <div className="bottom-sheet open se-sheet" role="dialog" aria-modal="true" aria-label={t('m.se.closeFriends')} style={{ zIndex: 1311 }}>
        <div className="sheet-grabber" />
        <div style={{ padding: '0 20px 8px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--label-primary)' }}><span className="se-star" style={{ marginRight: 8 }}><Icon name="star" size={13} /></span>{t('m.se.closeFriends')}</h3>
          <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginTop: '4px' }}>{t('m.se.closeFriendsSub')}</p>
        </div>
        <ul className="tp-list">
          {data === null ? <li className="tp-empty">…</li> : data.people.length === 0 ? <li className="tp-empty">{t('m.se.noPeople')}</li> : data.people.map(p => {
            const on = picked.has(p.id)
            return (
              <li key={p.id}><button type="button" className={`tp-row ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setPicked(s => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n })}>
                <span className="tp-photo" style={{ borderRadius: '50%' }}>{p.avatarUrl ? <img src={p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.name.charAt(0)}</span>
                <span className="tp-text"><span className="tp-name">{p.name}</span></span>
                {on && <Icon name="check" size={18} style={{ color: 'var(--success)' }} />}
              </button></li>
            )
          })}
        </ul>
        {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', padding: '0 20px' }}>{error}</p>}
        <div style={{ padding: '10px 20px calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
          <button type="button" className="btn btn-primary press" style={{ width: '100%' }} onClick={save} disabled={busy || !data}>{busy ? '…' : t('m.se.saveList')}</button>
        </div>
      </div>
    </>
  )
}
