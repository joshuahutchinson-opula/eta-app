// app/trip/[slug]/page.tsx
// A crew trip. Who sees what (lib/trips.ts → tripAccess):
//   invite link (?invite=) — a preview and "Join the crew" (with an account);
//   crew (owner, members) — the planner, chat, split payments and, once
//     booked, live progress with the crew's shared locations;
//   view link (?view=) — read-only live progress (Safety → share live trip).
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import TripPlanner from '@/components/TripPlanner'
import CrewChat from '@/components/CrewChat'
import ShareLocationToggle from '@/components/ShareLocationToggle'
import Price from '@/components/Price'
import { Filled } from '@/components/LinkedText'
import Icon from '@/lib/icons'
import { useErrorText, useLang, usePatois } from '@/lib/i18n-client'
import { getCurrentUser, setCurrentUser } from '@/lib/auth-client'
import { tripApi, type TripView } from '@/lib/trip-client'
import { useWatchedLocation } from '@/lib/geo'
import { townFor } from '@/lib/regions'
import { hapticBookingConfirmed } from '@/lib/haptics'
import { ApiError } from '@/lib/errors'

const TripMap = dynamic(() => import('@/components/TripMap'), { ssr: false })

export default function SharedTripPage() {
  const patois = usePatois()
  const { t } = useLang()
  const errorText = useErrorText()
  const router = useRouter()
  const { slug } = useParams() as { slug: string }
  const [trip, setTrip] = useState<TripView | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notFound' | 'forbidden'>('loading')
  const [joinName, setJoinName] = useState('')
  const [busy, setBusy] = useState<'join' | 'pay' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await tripApi(slug, '')
      setTrip(data)
      setState('ready')
    } catch (e) {
      setState(e instanceof ApiError && e.status === 403 ? 'forbidden' : 'notFound')
    }
  }, [slug])

  useEffect(() => {
    const user = getCurrentUser()
    setSignedIn(Boolean(user))
    if (user) setJoinName(user.name.split(' ')[0])
    load()
    // Votes, payments and the crew's positions keep flowing in while the page is open.
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load() }, 15000)
    return () => clearInterval(timer)
  }, [load])

  const crew = trip?.access === 'owner' || trip?.access === 'member'
  const live = crew && trip?.status === 'BOOKED'
  const me = useWatchedLocation(Boolean(live))

  const join = async () => {
    const invite = new URLSearchParams(window.location.search).get('invite')
    if (!invite) return
    setBusy('join')
    setError(null)
    try {
      const data = await tripApi<TripView & { memberId: string }>(slug, '/join', { method: 'POST', body: { invite, name: joinName.trim() || undefined } })
      setTrip(data)
      // Drop the invite from the address bar: from here on the account is the key.
      router.replace(`/trip/${slug}`)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const payShare = async () => {
    setBusy('pay')
    setError(null)
    try {
      const data = await tripApi<TripView & { walletBalance: number | null }>(slug, '/pay-share', { method: 'POST' })
      hapticBookingConfirmed()
      setTrip(data)
      const u = getCurrentUser()
      if (u && typeof data.walletBalance === 'number') setCurrentUser({ ...u, walletBalance: data.walletBalance })
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  if (state === 'notFound' || state === 'forbidden') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div className="empty-state">
          <Icon name={state === 'forbidden' ? 'lock' : 'route'} size={32} style={{ color: 'var(--label-tertiary)' }} />
          <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--label-primary)' }}>{state === 'forbidden' ? t('m.crew.noAccess') : patois.emptySearch}</p>
          <p>{state === 'forbidden' ? t('m.err.tripForbidden') : t('m.crew.notFound')}</p>
          {state === 'forbidden' && !signedIn ? (
            <Link href={`/login?next=${encodeURIComponent(`/trip/${slug}`)}`} className="btn btn-secondary" style={{ marginTop: 8, textDecoration: 'none' }}>{t('m.profile.login')}</Link>
          ) : null}
          <Link href="/experiences" className="btn btn-primary" style={{ marginTop: 8, textDecoration: 'none' }}>{t('m.crew.planOwn')}</Link>
        </div>
      </main>
    )
  }

  if (!trip) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', padding: 16 }}>
        <div className="skeleton-card" style={{ height: 32, width: '60%', marginBottom: 16 }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
        <div className="skeleton-card" style={{ height: 240 }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
      </main>
    )
  }

  const myMember = trip.members.find(m => m.id === trip.myMemberId)
  const owesShare = live && trip.splitPayment && myMember && !myMember.paid && myMember.share > 0
  const crewOnMap = trip.members.filter(m => m.location && m.id !== trip.myMemberId).map(m => ({ name: m.name, lat: m.location!.lat, lng: m.location!.lng }))
  const center = townFor(trip.city)
  const next = encodeURIComponent(`/trip/${slug}${typeof window !== 'undefined' ? window.location.search : ''}`)

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: 96 }}>
      <div style={{ padding: 16 }}>
        {trip.access === 'invitee' ? (
          <div className="card" style={{ padding: 16, marginBottom: 20, cursor: 'default' }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--label-primary)', marginBottom: 4 }}>
              {t('m.crew.invitedTitle', { owner: trip.invite?.owner ?? 'ETA', trip: trip.name })}
            </p>
            <p style={{ fontSize: 13, color: 'var(--label-secondary)', marginBottom: 12, lineHeight: 1.4 }}>{t('m.crew.invitedBody')}</p>
            {signedIn ? (
              <>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--label-secondary)', marginBottom: 6 }} htmlFor="join-name">{t('m.crew.yourName')}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    id="join-name"
                    value={joinName}
                    maxLength={40}
                    onChange={e => setJoinName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') join() }}
                    style={{ flex: 1, padding: 12, borderRadius: 14, border: '1px solid var(--separator)', background: 'var(--system-bg)', fontSize: 16, fontFamily: 'inherit', color: 'var(--label-primary)', outline: 'none', minHeight: 44 }}
                  />
                  <button className="btn btn-primary" onClick={join} disabled={busy === 'join'}>{t('m.crew.join')}</button>
                </div>
              </>
            ) : (
              <Link href={`/login?next=${next}`} className="btn btn-primary" style={{ width: '100%', textDecoration: 'none' }}>{t('m.crew.loginToJoin')}</Link>
            )}
          </div>
        ) : null}

        {trip.status === 'BOOKED' && trip.stops.length > 0 ? (
          // Live progress for the crew and for whoever holds a view link; refreshes every 15s.
          <div className="card" role="status" style={{ padding: 14, marginBottom: 16, cursor: 'default' }}>
            {trip.access === 'viewer' && <p style={{ fontSize: 12, color: 'var(--label-secondary)', marginBottom: 4 }}>{t('m.crew.viewOnly')}</p>}
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--live)' }}>
              <span className="live-dot" /> {t('m.trip.liveProgress', { n: Math.min(trip.currentStopIndex + 1, trip.stops.length), total: trip.stops.length })}
            </p>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-primary)', marginTop: 4 }}>
              {trip.currentStopIndex < trip.stops.length ? t('m.trip.liveNext', { name: trip.stops[trip.currentStopIndex].name }) : t('m.trip.liveDone')}
            </p>
          </div>
        ) : null}

        {live ? (
          <>
            <div className="card" style={{ position: 'relative', height: 240, overflow: 'hidden', marginBottom: 8, cursor: 'default' }}>
              <TripMap stops={trip.stops} currentIndex={trip.currentStopIndex} user={me} crew={crewOnMap} fallbackCenter={[center.lat, center.lng]} youLabel={t('m.crew.you', { name: myMember?.name ?? '' })} />
            </div>
            {crewOnMap.length > 0 && <p style={{ fontSize: 12, color: 'var(--label-secondary)', marginBottom: 12 }}>{t('m.crew.onMap', { n: crewOnMap.length })}</p>}
            {myMember && <ShareLocationToggle slug={slug} onChange={load} />}
          </>
        ) : null}

        {owesShare ? (
          <div className="card" style={{ padding: 16, marginBottom: 16, cursor: 'default', border: '1.5px solid var(--rum-tint)' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--label-primary)', marginBottom: 4 }}>{t('m.crew.payShare')}</p>
            <p style={{ fontSize: 13, color: 'var(--label-secondary)', marginBottom: 12 }}>
              <Filled text={t('m.crew.payShareBody')} values={{ amount: <Price usd={myMember!.share} compact /> }} />
            </p>
            <button className="btn btn-primary" onClick={payShare} disabled={busy === 'pay'} style={{ width: '100%' }}>
              {busy === 'pay' ? patois.loadingPayment : <>{t('m.book.pay')} <Price usd={myMember!.share} compact /></>}
            </button>
          </div>
        ) : live && trip.splitPayment && myMember?.paid ? (
          <p role="status" style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)', marginBottom: 16 }}><Icon name="check" size={14} /> {t('m.crew.sharePaid')}</p>
        ) : null}

        {error ? <p role="alert" style={{ fontSize: 13, color: 'var(--error)', marginBottom: 12 }}>{error}</p> : null}

        {trip.status === 'COMPLETED' ? (
          <Link href={`/trip/${slug}/recap`} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, marginBottom: 16, textDecoration: 'none' }}>
            <Icon name="sparkle" size={20} style={{ color: 'var(--gold)' }} />
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.crew.recap')}</span>
            <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
          </Link>
        ) : null}

        <TripPlanner trip={trip} mode={trip.access === 'owner' ? 'owner' : 'crew'} onTripChange={setTrip} />

        {crew ? <CrewChat slug={slug} myMemberId={trip.myMemberId ?? null} /> : null}

        {trip.access === 'owner' && trip.status === 'PLANNING' ? (
          <Link href={`/experiences?trip=${slug}`} className="btn btn-primary" style={{ width: '100%', textDecoration: 'none', marginTop: 12 }}>
            {t('m.crew.bookFromExperiences')}
          </Link>
        ) : null}
      </div>
    </main>
  )
}
