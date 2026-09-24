// components/AddToTripSheet.tsx
// "Add to trip" from anywhere (B3): drops a vendor into one of your
// in-progress trips, or starts a new one with it as the first stop.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { hapticSaved } from '@/lib/haptics'
import { addStopToTrip, createTrip, fetchMyTrips, type TripView } from '@/lib/trip-client'

interface Props {
  vendor: { id: string; name: string } | null
  onClose: () => void
}

export default function AddToTripSheet({ vendor, onClose }: Props) {
  const [trips, setTrips] = useState<TripView[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<{ slug: string; name: string; already: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const open = vendor !== null

  useEffect(() => {
    if (!open) return
    setDone(null)
    setError(null)
    setTrips(null)
    fetchMyTrips(['PLANNING', 'BOOKED']).then(setTrips).catch(() => setTrips([]))
  }, [open, vendor?.id])

  const addTo = async (trip: TripView) => {
    if (!vendor) return
    setBusy(trip.slug)
    setError(null)
    try {
      const updated = await addStopToTrip(trip.slug, { vendorId: vendor.id })
      hapticSaved()
      setDone({ slug: trip.slug, name: updated.name, already: updated.alreadyAdded })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sumth nah wuk')
    } finally {
      setBusy(null)
    }
  }

  const startNew = async () => {
    if (!vendor) return
    setBusy('new')
    setError(null)
    try {
      const trip = await createTrip({ name: `My day around ${vendor.name}`, stops: [{ vendorId: vendor.id }] })
      hapticSaved()
      setDone({ slug: trip.slug, name: trip.name, already: false })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sumth nah wuk')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`bottom-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="Add to trip">
        <div className="sheet-grabber" />
        <div style={{ padding: '0 20px 24px' }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--rum-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--rum-text)' }}>
                <Icon name="check" size={22} />
              </div>
              <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--label-primary)' }}>
                {done.already ? 'Already on' : 'Added to'} {done.name}
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Keep browsing</button>
                <Link href={`/experiences?trip=${done.slug}`} className="btn btn-primary" style={{ flex: 1, textDecoration: 'none' }}>Open trip</Link>
              </div>
            </div>
          ) : (
            <>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--label-primary)', marginBottom: 4 }}>Add to trip</h3>
              <p style={{ fontSize: 15, color: 'var(--label-secondary)', marginBottom: 16 }}>{vendor?.name}</p>

              {trips === null ? (
                <div className="skeleton-card" style={{ height: 64, marginBottom: 8 }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
              ) : trips.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {trips.map(t => (
                    <button
                      key={t.slug}
                      onClick={() => addTo(t)}
                      disabled={busy !== null}
                      className="card"
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: 'none', textAlign: 'left', fontFamily: 'inherit', width: '100%' }}
                    >
                      {t.stops[0]?.image ? (
                        <img src={t.stops[0].image} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }} />
                      ) : (
                        <span style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--system-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-tertiary)' }}><Icon name="route" size={18} /></span>
                      )}
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: 'var(--label-primary)' }}>{t.name}</span>
                        <span style={{ display: 'block', fontSize: 13, color: 'var(--label-secondary)' }}>
                          {t.stops.length} {t.stops.length === 1 ? 'stop' : 'stops'} · {t.status === 'BOOKED' ? 'Booked' : 'Planning'}{t.members.length > 1 ? ` · ${t.members.length} in crew` : ''}
                        </span>
                      </span>
                      {busy === t.slug ? <span className="num-font" style={{ color: 'var(--label-tertiary)' }}>…</span> : <Icon name="plus" size={16} style={{ color: 'var(--rum-text)' }} />}
                    </button>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 14, color: 'var(--label-secondary)', marginBottom: 12 }}>No trips in progress yet.</p>
              )}

              <button className="btn btn-primary" style={{ width: '100%' }} onClick={startNew} disabled={busy !== null}>
                <Icon name="plus" size={16} /> {busy === 'new' ? 'Starting…' : 'Start a new trip with this stop'}
              </button>
              {error ? <p role="alert" style={{ fontSize: 13, color: 'var(--error)', marginTop: 10 }}>{error}</p> : null}
            </>
          )}
        </div>
      </div>
    </>
  )
}
