// app/trip/[slug]/page.tsx
// The link a trip owner shares with their crew. Crew members pick who they
// are (or join with a new name), then vote on stops before anything is
// booked. The owner's own device sees the owner controls here too.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Dock from '@/components/Dock'
import TripPlanner from '@/components/TripPlanner'
import Icon from '@/lib/icons'
import { usePatois } from '@/lib/i18n-client'
import { getMemberId, getTripKey, setMemberId, tripApi, type TripView } from '@/lib/trip-client'

export default function SharedTripPage() {
  const patois = usePatois()
  const { slug } = useParams() as { slug: string }
  const [trip, setTrip] = useState<TripView | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [memberId, setMember] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [joining, setJoining] = useState(false)
  const isOwner = Boolean(trip?.canEdit)

  const load = useCallback(async () => {
    try {
      const data = await tripApi(slug, '')
      setTrip(data)
      setNotFound(false)
    } catch {
      setNotFound(true)
    }
  }, [slug])

  useEffect(() => {
    setMember(getMemberId(slug))
    load()
    // Keep votes from the rest of the crew flowing in while the page is open.
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load() }, 15000)
    return () => clearInterval(timer)
  }, [slug, load])

  const pickMember = (id: string) => {
    setMemberId(slug, id)
    setMember(id)
  }

  const join = async () => {
    if (!newName.trim()) return
    setJoining(true)
    try {
      const data = await tripApi<TripView & { memberId: string }>(slug, '/members', { method: 'POST', body: { name: newName.trim() } })
      setTrip(data)
      pickMember(data.memberId)
    } catch {
      // surfaced by the planner's own error state on next action
    } finally {
      setJoining(false)
    }
  }

  if (notFound) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div className="empty-state">
          <Icon name="route" size={32} style={{ color: 'var(--label-tertiary)' }} />
          <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--label-primary)' }}>{patois.emptySearch}</p>
          <p>This trip link doesn’t work anymore.</p>
          <Link href="/experiences" className="btn btn-primary" style={{ marginTop: 8, textDecoration: 'none' }}>Plan your own</Link>
        </div>
        <Dock />
      </main>
    )
  }

  if (!trip) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', padding: 16 }}>
        <div className="skeleton-card" style={{ height: 32, width: '60%', marginBottom: 16 }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
        <div className="skeleton-card" style={{ height: 240 }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
        <Dock />
      </main>
    )
  }

  const knownMember = memberId && trip.members.some(m => m.id === memberId) ? memberId : null
  const needsIdentity = !isOwner && !knownMember && trip.status === 'PLANNING'

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: 96 }}>
      <div style={{ padding: 16 }}>
        {trip.status === 'COMPLETED' ? (
          <Link href={`/trip/${slug}/recap`} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, marginBottom: 16, textDecoration: 'none' }}>
            <Icon name="sparkle" size={20} style={{ color: 'var(--gold)' }} />
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--label-primary)' }}>See the trip recap</span>
            <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
          </Link>
        ) : null}

        {needsIdentity ? (
          <div className="card" style={{ padding: 16, marginBottom: 20, cursor: 'default' }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--label-primary)', marginBottom: 4 }}>Wah Gwan! Who are you?</p>
            <p style={{ fontSize: 13, color: 'var(--label-secondary)', marginBottom: 12 }}>Pick your name so your votes count.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {trip.members.filter(m => !m.isOwner).map(m => (
                <button key={m.id} className="chip" onClick={() => pickMember(m.id)}>{m.name}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') join() }}
                placeholder="Not listed? Add your name"
                style={{ flex: 1, padding: 12, borderRadius: 14, border: '1px solid var(--separator)', background: 'var(--system-bg)', fontSize: 16, fontFamily: 'inherit', color: 'var(--label-primary)', outline: 'none', minHeight: 44 }}
              />
              <button className="btn btn-primary" onClick={join} disabled={joining || !newName.trim()}>Join</button>
            </div>
          </div>
        ) : null}

        <TripPlanner
          trip={trip}
          mode={isOwner ? 'owner' : 'crew'}
          memberId={isOwner ? undefined : knownMember}
          onTripChange={t => setTrip({ ...t, canEdit: Boolean(getTripKey(slug)) })}
        />

        {isOwner && trip.status === 'PLANNING' ? (
          <Link href={`/experiences?trip=${slug}`} className="btn btn-primary" style={{ width: '100%', textDecoration: 'none', marginTop: 12 }}>
            Book it from Experiences
          </Link>
        ) : null}
      </div>
      <Dock />
    </main>
  )
}
