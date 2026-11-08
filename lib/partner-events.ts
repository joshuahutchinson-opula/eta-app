// lib/partner-events.ts — validation and defaults for events a partner
// property posts from the vendor app (app/api/vendor-app/partners/:id/events).
import { prisma } from '@/lib/prisma'
import { httpsUrl, id, text, z } from '@/lib/validate'

export const partnerEventSchema = z.object({
  title: text(120).min(1),
  description: text(2000),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }).nullable().optional(),
  venueName: text(120).optional(),
  imageUrl: httpsUrl.nullable().optional(),
  videoUrl: httpsUrl.nullable().optional(),
  // More promo media for the event page's hero: videos play first, then photos.
  videos: z.array(httpsUrl).max(6).optional(),
  photos: z.array(httpsUrl).max(12).optional(),
  price: z.number().finite().min(0).max(10000).nullable().optional(),
  isFree: z.boolean().optional(),
  ticketUrl: httpsUrl.nullable().optional(),
  vendorId: id.nullable().optional()
})

export type PartnerEventInput = z.infer<typeof partnerEventSchema>

export class PartnerEventError extends Error {}

/** Prisma data for a create (all defaults filled) or an update (only what was sent). */
export async function partnerEventData(propertyId: string, input: Partial<PartnerEventInput>, create: boolean) {
  const property = await prisma.partnerProperty.findUniqueOrThrow({ where: { id: propertyId }, select: { name: true, city: true, lat: true, lng: true } })
  const startAt = input.startAt ? new Date(input.startAt) : undefined
  const endAt = input.endAt === undefined ? undefined : input.endAt ? new Date(input.endAt) : null
  if (startAt && endAt && endAt <= startAt) throw new PartnerEventError('endAt: must be after startAt')
  if (input.vendorId) {
    const linked = await prisma.vendor.findFirst({ where: { id: input.vendorId, partnerPropertyId: propertyId }, select: { id: true } })
    if (!linked) throw new PartnerEventError('vendorId: must be one of the property’s linked vendors')
  }
  const data: Record<string, unknown> = {}
  if (input.title !== undefined) data.title = input.title
  if (input.description !== undefined) data.description = input.description
  if (startAt) data.startAt = startAt
  if (endAt !== undefined) data.endAt = endAt
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl
  if (input.videoUrl !== undefined) data.videoUrl = input.videoUrl
  if (input.videos !== undefined) data.videos = Array.from(new Set(input.videos))
  if (input.photos !== undefined) data.photos = Array.from(new Set(input.photos))
  if (input.ticketUrl !== undefined) data.ticketUrl = input.ticketUrl
  if (input.vendorId !== undefined) data.vendorId = input.vendorId
  if (input.price !== undefined) data.price = input.price
  if (input.isFree !== undefined) data.isFree = input.isFree
  if (input.venueName !== undefined) data.venueName = input.venueName || property.name
  if (create) {
    Object.assign(data, {
      venueName: data.venueName ?? property.name,
      promoterName: property.name,
      city: property.city,
      lat: property.lat,
      lng: property.lng,
      isFree: data.isFree ?? (data.price === undefined || data.price === null || data.price === 0),
      partnerPropertyId: propertyId
    })
  }
  return data
}
