// components/TripPlanner.tsx
// Group trip planning (B1). One component, two seats:
//   owner — on the Experiences tab: rename, remove stops, add crew, invite
//           people by link, and book once the crew has weighed in.
//   crew  — on /trip/[slug] after joining from an invite link: vote on each
//           stop, update their own status, see who's paid.
// Payments: each member pays their own share through the trip link
// (/pay-share); nobody toggles anyone else's paid status any more.
'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import Price from '@/components/Price'
import { Filled } from '@/components/LinkedText'
import { triggerHaptic } from '@/lib/haptics'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { shareOrCopy } from '@/lib/share'
import { createInviteLink, tripApi, type TripView } from '@/lib/trip-client'

const AV_COLORS = ['var(--rum)', 'var(--gold)', 'var(--live)', 'var(--info)']
export function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AV_COLORS[Math.abs(h) % AV_COLORS.length]
}

interface Props {
  trip: TripView
  mode: 'owner' | 'crew'
  onTripChange: (trip: TripView) => void
  onBook?: () => void
  booking?: boolean
}

export default function TripPlanner({ trip, mode, onTripChange, onBook, booking }: Props) {
  const { t } = useLang()
  const errorText = useErrorText()
  const [crewInput, setCrewInput] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const isOwner = mode === 'owner' && trip.canEdit !== false
  const planning = trip.status === 'PLANNING'
  const viewerId = trip.myMemberId ?? undefined

  const run = async (key: string, fn: () => Promise<TripView>) => {
    setBusy(key)
    setError(null)
    try {
      onTripChange({ ...(await fn()), canEdit: trip.canEdit })
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const vote = (stopId: string, value: 1 | -1) => {
    if (!viewerId) return
    triggerHaptic('selection')
    run(`vote-${stopId}`, () => tripApi(trip.slug, '/votes', { method: 'POST', body: { stopId, value } }))
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

  const cycleMyStatus = (id: string, status: string) => {
    if (id !== viewerId) return
    const order = ['pending', 'enroute', 'arrived']
    run(`status-${id}`, () => tripApi(trip.slug, '/members', { method: 'PATCH', body: { memberId: id, status: order[(order.indexOf(status) + 1) % order.length] } }))
  }

  const invite = async () => {
    triggerHaptic('light')
    setBusy('invite')
    setError(null)
    try {
      const url = await createInviteLink(trip.slug)
      const result = await shareOrCopy({ title: trip.name, text: t('m.crew.inviteText', { name: trip.name }), url })
      if (result === 'copied') { setCopied(true); setTimeout(() => setCopied(false), 1800) }
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const statusLabel = (s: string) => (['pending', 'enroute', 'arrived'].includes(s) ? t(`m.crew.status.${s}` as 'm.crew.status.pending') : s)
  const paidCount = trip.members.filter(m => m.paid).length
  const perPerson = trip.members[0]?.share ?? 0
  const heading = planning ? t('m.crew.planning') : trip.status === 'BOOKED' ? t('m.crew.booked') : trip.status === 'COMPLETED' ? t('m.crew.completed') : t('m.crew.cancelled')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--label-secondary)' }}>{heading}</p>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginTop: 2 }}>{trip.name}</h2>
        </div>
        {trip.source === 'app' && (planning || trip.status === 'BOOKED') && viewerId ? (
          <button onClick={invite} disabled={busy === 'invite'} className="btn btn-secondary" style={{ flexShrink: 0, padding: '0 14px' }}>
            <Icon name="users" size={16} /> {copied ? t('m.crew.inviteCopied') : t('m.crew.invite')}
          </button>
        ) : null}
      </div>

      {planning && trip.members.length > 1 ? (
        <p style={{ fontSize: 13, color: 'var(--label-secondary)', marginBottom: 12 }}>
          {t('m.crew.voteHint')} {isOwner ? t('m.crew.voteHintOwner') : ''}
        </p>
      ) : null}

      <div className="section-heading" style={{ marginBottom: 8 }}>
        <span className="section-eyebrow">{t('m.crew.stops')}</span>
      </div>
      {trip.stops.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          <Icon name="mapPin" size={28} style={{ color: 'var(--label-tertiary)' }} />
          <p style={{ fontSize: 15, fontWeight: 600 }}>{t('m.crew.noStops')}</p>
          <p>{t('m.crew.noStopsBody')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {trip.stops.map((stop, i) => {
            const mine = viewerId ? stop.votes.byMember[viewerId] : undefined
            return (
              <div key={stop.id} className="card" style={{ padding: 12, cursor: 'default' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="num-font" style={{ width: 22, fontSize: 13, fontWeight: 700, color: 'var(--label-tertiary)', flexShrink: 0 }}>{i + 1}</span>
                  {stop.image ? <img src={stop.image} alt="" loading="lazy" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} /> : null}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stop.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--label-secondary)' }}>
                      {stop.subtitle}{stop.addedBy ? ` · ${t('m.crew.addedBy', { name: stop.addedBy })}` : ''}
                    </p>
                  </div>
                  {isOwner && planning ? (
                    <button aria-label={t('m.crew.remove', { name: stop.name })} onClick={() => removeStop(stop.id)} disabled={busy === `rm-${stop.id}`} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'var(--system-bg-secondary)', color: 'var(--label-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                      <Icon name="close" size={12} />
                    </button>
                  ) : null}
                </div>
                {trip.members.length > 1 || mode === 'crew' ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingLeft: 34 }}>
                    <button onClick={() => vote(stop.id, 1)} disabled={!planning || !viewerId} aria-pressed={mine === 1} className={`chip ${mine === 1 ? 'active' : ''}`} style={{ minHeight: 36, padding: '4px 12px', fontSize: 13 }}>
                      <Icon name="check" size={12} /> {t('m.crew.keep')} <span className="num-font">{stop.votes.up}</span>
                    </button>
                    <button onClick={() => vote(stop.id, -1)} disabled={!planning || !viewerId} aria-pressed={mine === -1} className={`chip ${mine === -1 ? 'active' : ''}`} style={{ minHeight: 36, padding: '4px 12px', fontSize: 13 }}>
                      <Icon name="close" size={12} /> {t('m.crew.skip')} <span className="num-font">{stop.votes.down}</span>
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
      {planning && viewerId ? (
        <Link href="/marketplace" className="btn btn-tertiary" style={{ textDecoration: 'none', width: '100%', marginBottom: 20 }}>
          <Icon name="plus" size={14} /> {mode === 'crew' ? t('m.crew.suggestStop') : t('m.crew.addStops')}
        </Link>
      ) : null}

      <div className="section-heading" style={{ marginBottom: 8 }}>
        <span className="section-eyebrow">{t('m.crew.crew')}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 12, paddingBottom: 4 }}>
        {trip.members.map(m => (
          <button
            key={m.id}
            onClick={() => cycleMyStatus(m.id, m.status)}
            style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: m.id === viewerId ? 'pointer' : 'default', fontFamily: 'inherit', minHeight: 44 }}
            aria-label={`${m.name}: ${statusLabel(m.status)}${m.id === viewerId ? ` — ${t('m.crew.tapToUpdate')}` : ''}`}
          >
            <span style={{ width: 44, height: 44, borderRadius: '50%', background: avatarColor(m.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'white', border: m.id === viewerId ? '2px solid var(--label-primary)' : m.status === 'arrived' ? '2px solid var(--success)' : '2px solid transparent', opacity: m.hasAccount ? 1 : 0.6 }}>
              {m.name[0]?.toUpperCase()}
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--label-secondary)' }}>{m.id === viewerId ? t('m.crew.you', { name: m.name }) : m.name}</span>
            <span style={{ fontSize: 10, color: 'var(--label-tertiary)' }}>{m.hasAccount ? statusLabel(m.status) : t('m.crew.noAccount')}</span>
          </button>
        ))}
      </div>
      {isOwner && planning ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input
            value={crewInput}
            onChange={e => setCrewInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addCrew() }}
            placeholder={t('m.crew.addPlaceholder')}
            aria-label={t('m.crew.addPlaceholder')}
            style={{ flex: 1, padding: 12, borderRadius: 14, border: '1px solid var(--separator)', background: 'var(--system-bg-elevated)', fontSize: 16, fontFamily: 'inherit', color: 'var(--label-primary)', outline: 'none', minHeight: 44 }}
          />
          <button onClick={addCrew} aria-label={t('m.crew.addAria')} disabled={busy === 'crew'} style={{ width: 44, borderRadius: 14, background: 'var(--rum)', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44 }}>
            <Icon name="plus" size={16} />
          </button>
        </div>
      ) : null}

      {perPerson > 0 && trip.members.length > 1 ? (
        <>
          <div className="section-heading" style={{ marginBottom: 8 }}>
            <span className="section-eyebrow">{t('m.crew.split')}</span>
          </div>
          <div style={{ background: 'var(--system-bg-elevated)', borderRadius: 14, padding: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <Price usd={perPerson * trip.members.length} compact style={{ fontSize: 20, fontWeight: 700, color: 'var(--label-primary)' }} />
              <span className="num-font" style={{ fontSize: 13, color: 'var(--label-secondary)', textAlign: 'right' }}>
                <Filled text={t('m.crew.paidCount')} values={{ paid: paidCount, total: trip.members.length, each: <Price usd={perPerson} compact /> }} />
              </span>
            </div>
            {trip.members.map((m, i) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: i > 0 ? '0.5px solid var(--separator)' : 'none' }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--label-primary)' }}>{m.id === viewerId ? t('m.crew.you', { name: m.name }) : m.name}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, padding: '6px 10px', borderRadius: 999, background: m.paid ? 'var(--system-bg)' : 'var(--rum-tint)', color: m.paid ? 'var(--success)' : 'var(--rum-text)' }}>
                  {m.paid ? <><Icon name="check" size={12} /> {t('m.crew.paid')}</> : t('m.crew.unpaid')}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {error ? <p role="alert" style={{ fontSize: 13, color: 'var(--error)', marginBottom: 12 }}>{error}</p> : null}

      {isOwner && planning && onBook ? (
        <button className="btn btn-primary" onClick={onBook} disabled={booking || trip.stops.length === 0} style={{ width: '100%' }}>
          {booking ? t('m.crew.booking') : t('m.crew.book')}
        </button>
      ) : null}
    </div>
  )
}
