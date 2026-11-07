// components/stories/StoryOverlays.tsx — draws a story's text, stickers and
// drawing over its photo or video (the viewer), and the same layer look
// for the editor (OverlayLayer). Positions are fractions of the screen.
'use client'

import Icon from '@/lib/icons'
import { FONT_FAMILY, STICKER_ICON, type StoryOverlay } from '@/lib/story-overlays'

export function OverlayLayer({ o }: { o: StoryOverlay }) {
  if (o.type === 'text') {
    const dark = o.color === '#0F0E0C'
    return (
      <span className="so-text" style={{
        fontFamily: FONT_FAMILY[o.font],
        color: o.background ? (dark ? '#FFFFFF' : '#0F0E0C') : o.color,
        background: o.background ? o.color : 'transparent',
        fontWeight: o.font === 'classic' ? 800 : o.font === 'mono' ? 700 : 400
      }}>{o.text}</span>
    )
  }
  return (
    <span className={`so-sticker ${o.kind}`}>
      <Icon name={STICKER_ICON[o.kind]} size={15} />
      <span>{o.label}</span>
    </span>
  )
}

export function placeStyle(o: { x: number; y: number; scale: number; rotate: number }): React.CSSProperties {
  return { left: `${o.x * 100}%`, top: `${o.y * 100}%`, transform: `translate(-50%, -50%) rotate(${o.rotate}deg) scale(${o.scale})` }
}

export default function StoryOverlays({ overlays, drawingUrl }: { overlays: StoryOverlay[]; drawingUrl?: string | null }) {
  if (!overlays.length && !drawingUrl) return null
  return (
    <div className="so-root" aria-hidden={false}>
      {drawingUrl && <img src={drawingUrl} alt="" className="so-drawing" />}
      {overlays.map((o, i) => (
        <div key={i} className="so-item" style={placeStyle(o)} role={o.type === 'text' ? 'note' : undefined}>
          <OverlayLayer o={o} />
        </div>
      ))}
    </div>
  )
}
