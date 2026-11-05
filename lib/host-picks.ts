// lib/host-picks.ts — "Host's picks": the collection a partner property
// curates for its guests (vendor app → app/api/vendor-app/partners/:id/picks),
// shown under "At your stay".
import { prisma } from '@/lib/prisma'

export interface HostPickView {
  id: string
  note: string | null
  kind: 'vendor' | 'experience' | 'event'
  target: { id: string; name: string; image: string | null; sub: string | null }
}

export async function hostPicksFor(propertyId: string): Promise<HostPickView[]> {
  const rows = await prisma.hostPick.findMany({
    where: { partnerPropertyId: propertyId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      vendor: { select: { id: true, name: true, images: true, category: true, neighborhood: true } },
      experience: { select: { id: true, name: true, imageUrl: true, tagline: true } },
      event: { select: { id: true, title: true, imageUrl: true, venueName: true, startAt: true, endAt: true } }
    }
  })
  const now = Date.now()
  const out: HostPickView[] = []
  for (const r of rows) {
    if (r.vendor) out.push({ id: r.id, note: r.note, kind: 'vendor', target: { id: r.vendor.id, name: r.vendor.name, image: r.vendor.images[0] ?? null, sub: r.vendor.neighborhood } })
    else if (r.experience) out.push({ id: r.id, note: r.note, kind: 'experience', target: { id: r.experience.id, name: r.experience.name, image: r.experience.imageUrl, sub: r.experience.tagline } })
    // Events drop off the list once they're over.
    else if (r.event && (r.event.endAt ?? new Date(r.event.startAt.getTime() + 6 * 3600000)).getTime() > now) {
      out.push({ id: r.id, note: r.note, kind: 'event', target: { id: r.event.id, name: r.event.title, image: r.event.imageUrl, sub: r.event.venueName } })
    }
  }
  return out
}
