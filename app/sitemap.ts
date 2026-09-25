// app/sitemap.ts — public web pages, including every guide, best-of page,
// vendor, experience and photo spot, generated from the live database.
import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { GUIDES, BEST_OF } from '@/lib/editorial'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = headers()
  const host = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`
  const [vendors, experiences, spots] = await Promise.all([
    prisma.vendor.findMany({ where: { visibleInMarketplace: true, isTransport: false }, select: { id: true, updatedAt: true } }),
    prisma.experience.findMany({ select: { id: true, updatedAt: true } }),
    prisma.photoSpot.findMany({ select: { id: true } })
  ])
  const staticPaths = ['/web', '/web/explore', '/web/experiences', '/web/photo-spots', '/web/guides', '/web/best', '/web/for-vendors', '/web/get-the-app', '/web/plan']
  return [
    ...staticPaths.map(p => ({ url: `${host}${p}`, changeFrequency: 'daily' as const })),
    ...GUIDES.map(g => ({ url: `${host}/web/guides/${g.slug}`, changeFrequency: 'daily' as const })),
    ...BEST_OF.map(b => ({ url: `${host}/web/best/${b.slug}`, changeFrequency: 'daily' as const })),
    ...vendors.map(v => ({ url: `${host}/web/vendor/${v.id}`, lastModified: v.updatedAt })),
    ...experiences.map(e => ({ url: `${host}/web/experiences/${e.id}`, lastModified: e.updatedAt })),
    ...spots.map(s => ({ url: `${host}/web/photo-spots/${s.id}` }))
  ]
}
