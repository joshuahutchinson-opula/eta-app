// app/robots.ts — only the public web app is indexable; the mobile app
// screens, API and shared trip links stay out of search.
import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  const h = headers()
  const host = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`
  return {
    rules: [{ userAgent: '*', allow: '/web', disallow: ['/api', '/web/plan/', '/trip/'] }],
    sitemap: `${host}/sitemap.xml`
  }
}
