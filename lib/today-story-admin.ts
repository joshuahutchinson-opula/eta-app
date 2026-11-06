// lib/today-story-admin.ts — writing Home's Today story from the vendor app
// (app/api/vendor-app/today-stories). One story per region per day.
//   ETA admins: any region, any day, published straight away (or not).
//   Vendors:    a story about their own place (vendorId one of theirs, in
//               that vendor's region). It goes in unpublished; ETA reviews
//               it and publishes it, so the slot stays editorial.
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { canActForVendor, type AuthedUser } from '@/lib/auth-server'
import { CITY_CODES } from '@/lib/regions'
import { dateOnly, httpsUrl, id, text, z } from '@/lib/validate'

export const blockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: text(2000).min(1) }),
  z.object({ type: z.literal('image'), url: httpsUrl, caption: text(200).optional() }),
  z.object({ type: z.literal('quote'), text: text(400).min(1), by: text(60).optional() })
])

export const storySchema = z.object({
  city: z.enum(CITY_CODES as [string, ...string[]]),
  publishOn: dateOnly,
  eyebrow: text(24).nullable().optional(),
  title: text(90).min(5),
  dek: text(200).min(5),
  coverImage: httpsUrl,
  coverVideo: httpsUrl.nullable().optional(),
  body: z.array(blockSchema).min(1).max(30),
  vendorId: id.nullable().optional(),
  eventId: id.nullable().optional(),
  published: z.boolean().optional()
})
export type StoryInput = z.infer<typeof storySchema>

export class StoryError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

/** Throws a StoryError when the caller can't write this story. Returns whether it may publish. */
export async function checkStory(user: AuthedUser, s: Partial<StoryInput>, existing?: { vendorId: string | null; city: string }): Promise<{ canPublish: boolean }> {
  if (user.role === 'ADMIN') {
    await checkLinks(s)
    return { canPublish: true }
  }
  if (user.role !== 'VENDOR') throw new StoryError('Only vendors or ETA admins can do that', 403)
  const vendorId = s.vendorId !== undefined ? s.vendorId : existing?.vendorId
  if (!vendorId) throw new StoryError('vendorId: a vendor story is about one of your places', 400)
  if (!(await canActForVendor(user, vendorId))) throw new StoryError('Only the vendor or an ETA admin can do that', 403)
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { city: true } })
  const city = s.city ?? existing?.city
  if (!vendor || vendor.city !== city) throw new StoryError("city: must be your vendor's region", 400)
  await checkLinks(s)
  return { canPublish: false }
}

async function checkLinks(s: Partial<StoryInput>) {
  if (s.vendorId && !(await prisma.vendor.findUnique({ where: { id: s.vendorId }, select: { id: true } }))) throw new StoryError('vendorId: no such vendor', 400)
  if (s.eventId && !(await prisma.event.findUnique({ where: { id: s.eventId }, select: { id: true } }))) throw new StoryError('eventId: no such event', 400)
}

export function isTaken(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}
