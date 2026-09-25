// app/web/explore/discover/page.tsx — Explore › Discover: the full-screen dark map.
// Needs MAPBOX_ACCESS_TOKEN (a public, URL-restricted Mapbox token); without it
// the page says so instead of showing a stand-in.
import type { Metadata } from 'next'
import DiscoverMap, { type DiscoverExperience, type DiscoverSpot, type DiscoverVendor } from '@/components/web/DiscoverMap'
import ExploreTabs from '@/components/web/ExploreTabs'
import { prisma } from '@/lib/prisma'
import { EXPERIENCE_STOPS_INCLUDE } from '@/lib/experience-stops'
import { getServerLang } from '@/lib/i18n-server'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Discover Negril on the map',
  description: 'Vendors, experiences and photo spots on one map — and hidden gems that only reveal themselves when you’re close.'
}

export default async function DiscoverPage() {
  const lang = getServerLang()
  const token = process.env.MAPBOX_ACCESS_TOKEN ?? ''

  const [vendorRows, experienceRows, spotRows] = await Promise.all([
    prisma.vendor.findMany({
      where: { visibleInMarketplace: true, visibleOnMap: true, isTransport: false },
      select: { id: true, name: true, category: true, neighborhood: true, lat: true, lng: true, images: true, reviews: { select: { rating: true } } }
    }),
    prisma.experience.findMany({ include: EXPERIENCE_STOPS_INCLUDE }),
    prisma.photoSpot.findMany({ where: { gallery: { isEmpty: false } }, select: { id: true, name: true, bestTime: true, lat: true, lng: true, officialPhoto: true } })
  ])

  const vendors: DiscoverVendor[] = vendorRows.map(v => {
    const n = v.reviews.length
    return {
      id: v.id, name: v.name, category: v.category, neighborhood: v.neighborhood, lat: v.lat, lng: v.lng,
      image: v.images[0] ?? null,
      rating: n ? Math.round(v.reviews.reduce((a, r) => a + r.rating, 0) / n * 10) / 10 : null,
      reviewCount: n
    }
  })
  // An experience is pinned where its route starts.
  const experiences: DiscoverExperience[] = experienceRows.flatMap(e => {
    const first = e.stops[0]
    const place = first?.vendor ?? first?.photoSpot
    return place ? [{ id: e.id, name: e.name, tagline: e.tagline, price: e.price, lat: place.lat, lng: place.lng, image: e.imageUrl, stopCount: e.stops.length }] : []
  })
  const spots: DiscoverSpot[] = spotRows.map(s => ({ id: s.id, name: s.name, bestTime: s.bestTime, lat: s.lat, lng: s.lng, image: s.officialPhoto }))

  return (
    <div className="dm-page">
      <div className="w-container dm-head">
        <ExploreTabs active="discover" lang={lang} />
        <p className="w-muted dm-dek">{t(lang, 'discover.dek')}</p>
      </div>
      {token ? (
        <DiscoverMap token={token} vendors={vendors} experiences={experiences} spots={spots} />
      ) : (
        <div className="w-container">
          <div className="w-panel dm-setup" role="status">
            <h2 className="w-h2" style={{ marginTop: 0 }}>The Discover map isn’t switched on yet</h2>
            <p className="w-muted">It runs on Mapbox. Add a public Mapbox access token as <code>MAPBOX_ACCESS_TOKEN</code> in the server environment (Railway variables) and redeploy.</p>
          </div>
        </div>
      )}
    </div>
  )
}
