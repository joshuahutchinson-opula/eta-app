// lib/site-url.ts — the one source of absolute URLs (share links, emails,
// OAuth callbacks, og:image). Set NEXT_PUBLIC_SITE_URL to the public origin,
// e.g. https://eta.example.com (no trailing slash). It's inlined into the
// client bundle at build time, so set it before building on Railway.
//
// Fallbacks, for local dev only: Railway's own domain on the server, the
// page's origin in the browser.

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) return configured.replace(/\/+$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  return 'http://localhost:3000'
}

/** An absolute link to a path on the site ("/trip/abc" → "https://…/trip/abc"). */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`
}
