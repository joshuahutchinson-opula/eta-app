// GET /api/trips/[slug]/recap-image — 1080×1350 shareable recap card (PNG),
// also used as the recap page's og:image so shared links unfurl as the card.
// Runs on the Edge runtime (the Node build of next/og can't load its font
// on Windows in Next 14.1), so it reads the recap from the Node JSON route.
import { ImageResponse } from 'next/og'
import type { TripRecap } from '@/lib/recap'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const res = await fetch(new URL(`/api/trips/${encodeURIComponent(params.slug)}/recap`, request.url), { cache: 'no-store' })
  if (!res.ok) return new Response('Not found', { status: 404 })
  const recap: TripRecap = await res.json()
  const { trip } = recap
  const photos = [...recap.moments.map(m => m.url), ...recap.stopPhotos].slice(0, 4)
  const date = new Date(trip.booking?.date ?? recap.completedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#14120E', color: '#FBF8F4', padding: 64, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: '#FF4B2B', letterSpacing: 2 }}>ETA</div>
          <div style={{ fontSize: 26, color: 'rgba(251,248,244,0.6)' }}>{date}</div>
        </div>
        <div style={{ fontSize: 30, color: '#FFB4A3', marginTop: 48, textTransform: 'uppercase', letterSpacing: 4, flexShrink: 0 }}>Trip recap</div>
        <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, marginTop: 12, flexShrink: 0 }}>{trip.name.slice(0, 48)}</div>
        {/* Fixed tile sizes so the grid always fits: 1 wide, 2 side by side, or 2×2. */}
        <div style={{ display: 'flex', gap: 16, marginTop: 36, flexWrap: 'wrap', flexShrink: 0 }}>
          {photos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} width={photos.length === 1 ? 952 : 468} height={photos.length <= 2 ? 560 : 272} style={{ objectFit: 'cover', borderRadius: 24 }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 'auto', flexShrink: 0 }}>
          {[
            { v: String(trip.stops.length), l: trip.stops.length === 1 ? 'stop' : 'stops' },
            { v: `+${recap.pointsEarned}`, l: 'points' },
            { v: String(trip.members.length), l: trip.members.length === 1 ? 'explorer' : 'in the crew' },
            ...(recap.distanceKm ? [{ v: `${recap.distanceKm}`, l: 'km' }] : [])
          ].map(stat => (
            <div key={stat.l} style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 24, padding: '24px 28px' }}>
              <div style={{ fontSize: 56, fontWeight: 800 }}>{stat.v}</div>
              <div style={{ fontSize: 24, color: 'rgba(251,248,244,0.6)' }}>{stat.l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 26, color: 'rgba(251,248,244,0.55)', marginTop: 28, flexShrink: 0 }}>
          {trip.stops.map(s => s.name).join('  ·  ').slice(0, 120)}
        </div>
      </div>
    ),
    { width: 1080, height: 1350 }
  )
}
