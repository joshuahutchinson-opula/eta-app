// app/trip/[slug]/recap/page.tsx — B5 post-trip recap (public, shareable).
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import RecapShare from '@/components/RecapShare'
import { getTripRecap } from '@/lib/recap'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const recap = await getTripRecap(params.slug)
  if (!recap) return { title: 'Trip recap' }
  const desc = `${recap.trip.stops.length} stops · +${recap.pointsEarned} points on ETA`
  return {
    title: `${recap.trip.name} — trip recap`,
    description: desc,
    robots: { index: false },
    openGraph: { title: `${recap.trip.name} — trip recap`, description: desc, images: [`/api/trips/${params.slug}/recap-image`] }
  }
}

export default async function RecapPage({ params }: { params: { slug: string } }) {
  const recap = await getTripRecap(params.slug)
  if (!recap) notFound()
  const { trip } = recap
  const photos = recap.moments.length > 0 ? recap.moments.map(m => ({ url: m.url, caption: m.caption ?? m.spot })) : recap.stopPhotos.map(url => ({ url, caption: null }))
  const date = new Date(trip.booking?.date ?? recap.completedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <main style={{ minHeight: '100dvh', background: '#14120E', color: '#FBF8F4', padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#FFB4A3' }}>Trip recap · {date}</p>
        <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 8 }}>{trip.name}</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 20 }}>
          {[
            { v: trip.stops.length, l: trip.stops.length === 1 ? 'stop' : 'stops' },
            { v: `+${recap.pointsEarned}`, l: 'points earned' },
            { v: trip.members.length, l: trip.members.length === 1 ? 'explorer' : 'in the crew' }
          ].map(s => (
            <div key={s.l} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: '14px 12px' }}>
              <p className="num-font" style={{ fontSize: 26, fontWeight: 800 }}>{s.v}</p>
              <p style={{ fontSize: 12, color: 'rgba(251,248,244,0.6)' }}>{s.l}</p>
            </div>
          ))}
        </div>

        {photos.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: photos.length === 1 ? '1fr' : '1fr 1fr', gap: 8, marginTop: 20 }}>
            {photos.slice(0, 6).map((p, i) => (
              <figure key={i} style={{ margin: 0, position: 'relative', borderRadius: 16, overflow: 'hidden', aspectRatio: photos.length === 1 ? '4 / 3' : '1 / 1', gridColumn: i === 0 && photos.length > 2 ? 'span 2' : undefined }}>
                <img src={p.url} alt={p.caption ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {p.caption ? <figcaption style={{ position: 'absolute', left: 10, bottom: 8, fontSize: 12, fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{p.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        ) : null}
        {recap.moments.length === 0 && photos.length > 0 ? (
          <p style={{ fontSize: 12, color: 'rgba(251,248,244,0.5)', marginTop: 8 }}>Photos from the stops — post moments during your next trip to see your own here.</p>
        ) : null}

        <h2 style={{ fontSize: 17, fontWeight: 700, marginTop: 28, marginBottom: 10 }}>The route</h2>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {trip.stops.map((s, i) => (
            <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 10 }}>
              <span className="num-font" style={{ width: 24, textAlign: 'center', fontWeight: 700, color: '#FF4B2B' }}>{i + 1}</span>
              {s.image ? <img src={s.image} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }} /> : null}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{s.name}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'rgba(251,248,244,0.55)' }}>{s.subtitle}</span>
              </span>
            </li>
          ))}
        </ol>
        {recap.distanceKm ? <p style={{ fontSize: 13, color: 'rgba(251,248,244,0.55)', marginTop: 10 }}>About {recap.distanceKm} km between stops.</p> : null}

        {trip.members.length > 1 ? (
          <p style={{ fontSize: 14, color: 'rgba(251,248,244,0.75)', marginTop: 20 }}>With {trip.members.map(m => m.name).join(', ')}.</p>
        ) : null}

        <div style={{ marginTop: 28 }}>
          <RecapShare slug={trip.slug} name={trip.name} />
        </div>
        <Link href="/experiences" style={{ display: 'block', textAlign: 'center', marginTop: 20, color: '#FFB4A3', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
          Plan the next one →
        </Link>
      </div>
    </main>
  )
}
