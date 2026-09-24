// app/web/plan/[slug]/page.tsx — B7 read-only shared itinerary
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PlanShareBar from '@/components/web/PlanShareBar'
import { loadTrip, toTripDTO } from '@/lib/trips'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const trip = await loadTrip(params.slug)
  if (!trip) return { title: 'Plan not found' }
  return {
    title: trip.name,
    description: `A day plan on ETA: ${trip.stops.map(s => s.vendor?.name ?? s.photoSpot?.name ?? s.experience?.name).filter(Boolean).join(' → ')}`.slice(0, 160),
    robots: { index: false }
  }
}

export default async function SharedPlanPage({ params }: { params: { slug: string } }) {
  const raw = await loadTrip(params.slug)
  if (!raw || raw.status === 'CANCELLED') notFound()
  const trip = toTripDTO(raw)
  const date = trip.date ? new Date(trip.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null
  const mapped = trip.stops.filter(s => s.lat !== null && s.lng !== null)
  const routeUrl = mapped.length > 1
    ? `https://www.google.com/maps/dir/${mapped.map(s => `${s.lat},${s.lng}`).join('/')}`
    : null

  return (
    <div className="w-container" style={{ maxWidth: 880 }}>
      <header className="w-page-head">
        <p className="w-eyebrow">{date ?? 'Day plan'} · {trip.stops.length} {trip.stops.length === 1 ? 'stop' : 'stops'}</p>
        <h1 className="w-page-title">{trip.name}</h1>
        {trip.notes ? <p className="w-page-dek">{trip.notes}</p> : null}
        <div style={{ marginTop: 20 }}><PlanShareBar slug={trip.slug} name={trip.name} /></div>
      </header>

      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 14 }}>
        {trip.stops.map((s, i) => {
          const href = s.kind === 'vendor' ? `/web/vendor/${s.refId}` : s.kind === 'experience' ? `/web/experiences/${s.refId}` : null
          const body = (
            <>
              <span className="w-stop-num">{i + 1}</span>
              {s.image ? <img src={s.image} alt="" /> : <span />}
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 17 }}>{s.name}</p>
                <p className="w-muted" style={{ fontSize: 14 }}>{s.subtitle}</p>
                {s.note ? <p style={{ fontSize: 14, marginTop: 6 }}>{s.note}</p> : null}
              </div>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.time ?? ''}</span>
            </>
          )
          return (
            <li key={s.id}>
              {href ? <Link href={href} className="w-stop" style={{ transition: 'box-shadow 0.2s' }}>{body}</Link> : <div className="w-stop">{body}</div>}
            </li>
          )
        })}
      </ol>

      {routeUrl ? (
        <p style={{ marginTop: 24 }}>
          <a href={routeUrl} target="_blank" rel="noopener noreferrer" className="w-link-arrow">Open the whole route in Google Maps →</a>
        </p>
      ) : null}

      <div className="w-cta-band">
        <div>
          <h2>Want this booked, with your crew and points?</h2>
          <p>The ETA app turns a plan like this into a bookable trip with split payments.</p>
        </div>
        <Link href="/web/get-the-app" className="w-btn" style={{ background: '#fff', color: '#14120E' }}>Get the app</Link>
      </div>
    </div>
  )
}
