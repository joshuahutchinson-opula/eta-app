// lib/moment-picks.ts — validation and the shape returned for ETA admins'
// hand-picked moments (MomentPick; app/api/vendor-app/moment-picks).
import { CITY_CODES } from '@/lib/regions'
import { MOMENT_MODES } from '@/lib/moments'
import { id, text, z } from '@/lib/validate'

export const pickSchema = z.object({
  city: z.enum(CITY_CODES as [string, ...string[]]),
  experienceId: id.nullable().optional(),
  eventId: id.nullable().optional(),
  daypart: z.enum(MOMENT_MODES as [string, ...string[]]).nullable().optional(),
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  note: text(80).nullable().optional(),
  active: z.boolean().optional()
})

export const PICK_INCLUDE = {
  experience: { select: { id: true, name: true, city: true, imageUrl: true } },
  event: { select: { id: true, title: true, city: true, startAt: true, imageUrl: true } }
} as const
