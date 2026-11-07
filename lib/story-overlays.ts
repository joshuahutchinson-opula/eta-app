// lib/story-overlays.ts — the layers the story editor puts over a photo or
// video (components/stories/StoryEditor) and the viewer draws back
// (components/stories/StoryOverlays). Positions are the layer's centre as a
// fraction of the screen (0–1), so they land in the same place on any phone.
import { z } from 'zod'

export const STORY_FONTS = ['classic', 'mono', 'script'] as const
export type StoryFont = (typeof STORY_FONTS)[number]
export const FONT_FAMILY: Record<StoryFont, string> = {
  classic: "'Inter', -apple-system, sans-serif",
  mono: "'Space Mono', monospace",
  script: "'Pacifico', cursive"
}
export const STORY_COLORS = ['#FFFFFF', '#0F0E0C', '#B82010', '#FFB800', '#34C759', '#1C7ED6', '#E0457B'] as const

export const STICKER_KINDS = ['location', 'vendor', 'event', 'time'] as const
export type StickerKind = (typeof STICKER_KINDS)[number]

const place = { x: z.number().min(0).max(1), y: z.number().min(0).max(1), scale: z.number().min(0.3).max(5), rotate: z.number().min(-360).max(360) }

export const overlaySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().trim().min(1).max(200), font: z.enum(STORY_FONTS), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/), background: z.boolean().optional(), ...place }),
  z.object({ type: z.literal('sticker'), kind: z.enum(STICKER_KINDS), label: z.string().trim().min(1).max(80), refId: z.string().max(64).optional(), ...place })
])
export const overlaysSchema = z.array(overlaySchema).max(30)

export type StoryOverlay = z.infer<typeof overlaySchema>
export type TextOverlay = Extract<StoryOverlay, { type: 'text' }>
export type StickerOverlay = Extract<StoryOverlay, { type: 'sticker' }>

/** Reads overlays from the database without trusting their shape. */
export function parseOverlays(value: unknown): StoryOverlay[] {
  const r = overlaysSchema.safeParse(value)
  return r.success ? r.data : []
}

export const STICKER_ICON: Record<StickerKind, string> = { location: 'mapPin', vendor: 'marketplace', event: 'ticket', time: 'clock' }

/** Quick emoji reactions in the viewer. */
export const REACTIONS = ['😍', '🔥', '😂', '👏', '🙌', '🇯🇲'] as const
