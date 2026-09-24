// components/TripPlanner.tsx
// Group trip planning (B1). One component, two seats:
//   owner — on the Experiences tab: rename, remove stops, add crew, mark
//           who's paid, and book once the crew has weighed in.
//   crew  — on /trip/[slug] from the shared link: vote on each stop,
//           update their own status, see the split.
'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { triggerHaptic } from '@/lib/haptics'
import { tripApi, tripShareUrl, type TripView } from '@/lib/trip-client'

const AV_COLORS = ['var(--rum)', 'var(--gold)', 'var(--live)', 'var(--info)']
function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AV_COLORS[Math.abs(h) % AV_COLORS.length]
}

const STATUS_LABEL: Record<string, string> = { pending: 'Not started', enroute: 'En route', arrived: 'Arrived' }

interface Props {
  trip: TripView
  mode: 'owner' | 'crew'
  memberId?: string | null
  onTripChange: (trip: TripView) => void
  onBook?: () => void
  booking?: boolean
}

export default function TripPlanner({ trip, mode, memberId, onTripChange, onBook, booking }: Props) {
  const [crewInput, setCrewInput] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const isOwner = mode === 'owner' && trip.canEdit !== false
  const planning = trip.status === 'PLANNING'
  const viewerId = memberId ?? (isOwner ? trip.members.find(m => m.isOwner)?.id : undefined)

  const run = async (key: string, fn: () => Promise<TripView>) => {
    setBusy(key)
    setError(null)
    try {
      onTripChange({ ...(await fn()), canEdit: trip.canEdit })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sumth nah wuk')
    } finally {
      setBusy(null)
    }
  }

  const vote = (stopId: string, value: 1 | -1) => {
    if (!viewerId) return
    triggerHaptic('selection')
    run(`vote-${stopId}`, () => tripApi(trip.slug, '/votes', { method: 'POST', body: { stopId, memberId: viewerId, value } }))
  }

  const removeStop = (stopId: string) => {
    triggerHaptic('light')
    run(`rm-${stopId}`, () => tripApi(trip.slug, `/stops?stopId=${stopId}`, { method: 'DELETE' }))
  }

  const addCrew = () => {
    const name = crewInput.trim()
    if (!name) return
    setCrewInput('')
    run('crew', () => tripApi(trip.slug, '/members', { method: 'POST', body: { name } }))
  }

  const togglePaid = (id: string, paid: boolean) => {
    if (!isOwner) return
    triggerHaptic('selection')
    run(`paid-${id}`, () => tripApi(trip.slug, '/members', { method: 'PATCH', body: { memberId: id, paid: !paid } }))
  }

  const cycleMyStatus = (id: string, status: string) => {
    if (id !== viewerId) return
    const order = ['pending', 'enroute', 'arrived']
    run(`status-${id}`, () => tripApi(trip.slug, '/members', { method: 'PATCH', body: { memberId: id, status: order[(order.indexOf(status) + 1) % order.length] } }))
  }

  const share = async () => {
    const url = tripShareUrl(trip.slug)
    triggerHaptic('light')
    if (navigator.share) {
      navigator.share({ title: trip.name, text: `Help plan "${trip.name}" — vote on the stops before we book.`, url }).catch(() => {})
      return
    }
    await navigator.clipboard?.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const paidCount = trip.members.filter(m => m.paid).length
  const perPerson = trip.members[0]?.share ?? 0
  const sortedStops = trip.stops

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--label-secondary)' }}>
            {planning ? 'Planning with your crew' : trip.status === 'BOOKED' ? 'Booked' : trip.status === 'COMPLETED' ? 'Completed' : 'Cancelled'}
          </p>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginTop: 2 }}>{trip.name}</h2>
        </div>
        {trip.source === 'app' && planning ? (
          <button onClick={share} className="btn btn-secondary" style={{ flexShrink: 0, padding: '0 14px' }}>
            <Icon name="share" size={16} /> {copied ? 'Copied' : 'Share'}
          </button>
        ) : null}
      </div>

      {planning && trip.members.length > 1 ? (
        <p style={{ fontSize: 13, color: 'var(--label-secondary)', marginBottom: 12 }}>
          Your crew votes on each stop from the shared link. {isOwner ? 'Drop anything that gets voted down, then book.' : ''}
        </p>
      ) : null}

      <div className="section-heading" style={{ marginBottom: 8 }}>
        <span className="section-eyebrow">Stops</span>
      </div>
      {sortedStops.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          <Icon name="mapPin" size={28} style={{ color: 'var(--label-tertiary)' }} />
          <p style={{ fontSize: 15, fontWeight: 600 }}>No stops yet</p>
          <p>Tap + on any vendor in Market to add it here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {sortedStops.map((stop, i) => {
            const mine = viewerId ? stop.votes.byMember[viewerId] : undefined
            return (
              <div key={stop.id} className="card" style={{ padding: 12, cursor: 'default' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="num-font" style={{ width: 22, fontSize: 13, fontWeight: 700, color: 'var(--label-tertiary)', flexShrink: 0 }}>{i + 1}</span>
                  {stop.image ? <img src={stop.image} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} /> : null}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stop.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--label-secondary)' }}>
                      {stop.subtitle}{stop.addedBy ? ` · added by ${stop.addedBy}` : ''}
                    </p>
                  </div>
                  {isOwner && planning ? (
                    <button aria-label={`Remove ${stop.name}`} onClick={() => removeStop(stop.id)} disabled={busy === `rm-${stop.id}`} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--system-bg-secondary)', color: 'var(--label-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                      <Icon name="close" size={12} />
                    </button>
                  ) : null}
                </div>
                {trip.members.length > 1 || mode === 'crew' ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingLeft: 34 }}>
                    <button
                      onClick={() => vote(stop.id, 1)}
                      disabled={!planning || !viewerId}
                      aria-pressed={mine === 1}
                      className={`chip ${mine === 1 ? 'active' : ''}`}
                      style={{ minHeight: 34, padding: '4px 12px', fontSize: 13 }}
                    >
                      <Icon name="check" size={12} /> Keep <span className="num-font">{stop.votes.up}</span>
                    </button>
                    <button
                      onClick={() => vote(stop.id, -1)}
                      disabled={!planning || !viewerId}
                      aria-pressed={mine === -1}
                      className={`chip ${mine === -1 ? 'active' : ''}`}
                      style={{ minHeight: 34, padding: '4px 12px', fontSize: 13 }}
                    >
                      <Icon name="close" size={12} /> Skip <span className="num-font">{stop.votes.down}</span>
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
      {planning ? (
        <Link href="/marketplace" className="btn btn-tertiary" style={{ textDecoration: 'none', width: '100%', marginBottom: 20 }}>
          <Icon name="plus" size={14} /> {mode === 'crew' ? 'Suggest a stop from Market' : 'Add stops from Market'}
        </Link>
      ) : null}

      <div className="section-heading" style={{ marginBottom: 8 }}>
        <span className="section-eyebrow">Crew</span>
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 12, paddingBottom: 4 }}>
        {trip.members.map(m => (
          <button
            key={m.id}
            onClick={() => cycleMyStatus(m.id, m.status)}
            style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: m.id === viewerId ? 'pointer' : 'default', fontFamily: 'inherit', minHeight: 44 }}
            aria-label={`${m.name}: ${STATUS_LABEL[m.status] ?? m.status}${m.id === viewerId ? ' — tap to update' : ''}`}
          >
            <span style={{ width: 44, height: 44, borderRadius: '50%', background: avatarColor(m.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'white', border: m.id === viewerId ? '2px solid var(--label-primary)' : m.status === 'arrived' ? '2px solid var(--success)' : '2px solid transparent' }}>
              {m.name[0]?.toUpperCase()}
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--label-secondary)' }}>{m.id === viewerId ? `${m.name} (you)` : m.name}</span>
            <span style={{ fontSize: 10, color: 'var(--label-tertiary)' }}>{STATUS_LABEL[m.status] ?? m.status}</span>
          </button>
        ))}
      </div>
      {isOwner && planning ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input
            value={crewInput}
            onChange={e => setCrewInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addCrew() }}
            placeholder="Add someone to the crew"
            style={{ flex: 1, padding: 12, borderRadius: 14, border: '1px solid var(--separator)', background: 'var(--system-bg-elevated)', fontSize: 16, fontFamily: 'inherit', color: 'var(--label-primary)', outline: 'none', minHeight: 44 }}
          />
          <button onClick={addCrew} aria-label="Add to crew" disabled={busy === 'crew'} style={{ width: 44, borderRadius: 14, background: 'var(--rum)', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44 }}>
            <Icon name="plus" size={16} />
          </button>
        </div>
      ) : null}

      {perPerson > 0 ? (
        <>
          <div className="section-heading" style={{ marginBottom: 8 }}>
            <span className="section-eyebrow">Split payment</span>
          </div>
          <div style={{ background: 'var(--system-bg-elevated)', borderRadius: 14, padding: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="num-font" style={{ fontSize: 20, fontWeight: 700, color: 'var(--label-primary)' }}>${perPerson * trip.members.length}</span>
              <span className="num-font" style={{ fontSize: 13, color: 'var(--label-secondary)' }}>{paidCount} of {trip.members.length} paid · ${perPerson} each</span>
            </div>
            {trip.members.map((m, i) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: i > 0 ? '0.5px solid var(--separator)' : 'none' }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--label-primary)' }}>{m.name}</span>
                <button
                  onClick={() => togglePaid(m.id, m.paid)}
                  disabled={!isOwner || busy === `paid-${m.id}`}
                  style={{ fontSize: 13, fontWeight: 600, padding: '6px 10px', borderRadius: 999, border: 'none', fontFamily: 'inherit', cursor: isOwner ? 'pointer' : 'default', background: m.paid ? 'var(--system-bg)' : 'var(--rum-tint)', color: m.paid ? 'var(--success)' : 'var(--rum-text)', minHeight: 36 }}
                >
                  {m.paid ? 'Paid' : `$${m.share}`}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {error ? <p role="alert" style={{ fontSize: 13, color: 'var(--error)', marginBottom: 12 }}>{error}</p> : null}

      {isOwner && planning && onBook ? (
        <button className="btn btn-primary" onClick={onBook} disabled={booking || trip.stops.length === 0} style={{ width: '100%' }}>
          {booking ? 'Booking...' : 'Dun — book dis trip'}
        </button>
      ) : null}
    </div>
  )
}
