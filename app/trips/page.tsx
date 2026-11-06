// app/trips/page.tsx — Profile → Trips: "+ Plan A Trip", Upcoming trips
// (town, dates, stay status, "<n> days" chip; edit, invite friends, delete)
// and Past Trips as photo cards (town, dates, places, % explored, Recap →).
// Group trips show date changes waiting for this traveler to confirm.
// Deleting the last upcoming trip sends Home back to Browsing / Between
// trips (lib/stage.ts works it out from what's left).
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import Dock from '@/components/Dock'
import Img from '@/components/Img'
import Icon from '@/lib/icons'
import { openPlanTrip } from '@/components/PlanTripSheet'
import { useDateRange } from '@/components/home/StageBlocks'
import { apiJson } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { shareOrCopy } from '@/lib/share'
import { absoluteUrl } from '@/lib/site-url'
import { answerChange, deleteTrip, refreshTrips, STAGE_EVENT, allTrips, type TripView } from '@/lib/stage-client'
import { jamaicaDayKey } from '@/lib/trip-dates'
import { townFor } from '@/lib/regions'
import { triggerHaptic } from '@/lib/haptics'

interface Stats { places: number; explored: number; photos: string[] }

export default function TripsPage() {
  const { t } = useLang()
  const errorText = useErrorText()
  const range = useDateRange()
  const [trips, setTrips] = useState<TripView[]>([])
  const [stats, setStats] = useState<Record<string, Stats>>({})
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<TripView | null>(null)

  useEffect(() => {
    const read = () => setTrips(allTrips())
    read()
    refreshTrips().then(read)
    window.addEventListener(STAGE_EVENT, read)
    return () => window.removeEventListener(STAGE_EVENT, read)
  }, [])

  const today = jamaicaDayKey()
  const upcoming = trips.filter(x => x.status !== 'ENDED' && x.end >= today).sort((a, b) => a.start.localeCompare(b.start))
  const past = trips.filter(x => x.status === 'ENDED' || x.end < today).sort((a, b) => b.end.localeCompare(a.end))

  useEffect(() => {
    if (!getCurrentUser()) return
    for (const p of past.filter(x => !x.local && !stats[x.id])) {
      apiJson<{ stats: Stats | null }>(`/api/travel-trips/${p.id}`).then(d => d.stats && setStats(s => ({ ...s, [p.id]: d.stats! }))).catch(() => {})
    }
  }, [past.map(p => p.id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const invite = async (trip: TripView) => {
    if (!trip.inviteCode) return
    const r = await shareOrCopy({ title: t('m.trips.inviteTitle', { town: townFor(trip.city).name }), text: t('m.trips.inviteText', { town: townFor(trip.city).name, dates: range(trip.start, trip.end) }), url: absoluteUrl(`/trips/join/${trip.inviteCode}`) })
    if (r === 'copied') setMsg(t('m.trips.linkCopied'))
  }

  const remove = async (trip: TripView) => {
    setConfirmDelete(null)
    try { await deleteTrip(trip.id); triggerHaptic('medium') } catch (e) { setMsg(errorText(e)) }
  }

  const days = (trip: TripView) => {
    const n = Math.round((Date.parse(trip.start) - Date.parse(today)) / 86400000)
    return n <= 0 ? t('m.trips.onNow') : n === 1 ? t('m.trips.oneDay') : t('m.trips.days', { n })
  }

  return (
    <main className="trips-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <BackButton fallback="/profile" />
        <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--label-primary)' }}>{t('m.trips.title')}</h1>
      </div>

      <button className="btn btn-primary press" style={{ width: '100%', marginBottom: '22px' }} onClick={() => openPlanTrip({})}>
        <Icon name="plus" size={16} /> {t('m.trips.plan')}
      </button>

      {msg && <p role="status" style={{ fontSize: '13px', color: 'var(--label-primary)', marginBottom: '10px' }}>{msg}</p>}

      <span className="home-eyebrow">{t('m.trips.upcomingEyebrow')}</span>
      <h2 className="home-title" style={{ marginBottom: '12px' }}>{t('m.trips.upcoming')}</h2>
      {upcoming.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '22px' }}>{t('m.trips.noneUpcoming')}</p>
      ) : upcoming.map(trip => (
        <div key={trip.id} style={{ marginBottom: '10px' }}>
          <div className="trip-row">
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '17px', fontWeight: 800, color: 'var(--label-primary)' }}>
                {[townFor(trip.city).name, ...trip.legs.slice(1).map(l => townFor(l.city).name)].join(' → ')}
              </span>
              <span className="num-font" style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>{range(trip.start, trip.end)}</span>
              <span style={{ display: 'block', fontSize: '13px', color: trip.stayName ? 'var(--label-secondary)' : 'var(--rum-text)' }}>
                <Icon name="home" size={11} /> {trip.stayName ?? t('m.trips.noStay')}
              </span>
              {trip.members.length > 1 && <span style={{ display: 'block', fontSize: '12px', color: 'var(--label-secondary)', marginTop: '2px' }}><Icon name="users" size={11} /> {trip.members.map(m => m.name).join(', ')}</span>}
            </span>
            <span className="trip-days num-font">{days(trip)}</span>
          </div>
          {trip.pendingChange && (
            <div className="stage-prompt" style={{ marginBottom: '6px' }}>
              <p className="stage-prompt-title" style={{ fontSize: '14px' }}><Icon name="calendar" size={16} /> {trip.pendingChange.mine ? t('m.trips.changeWaiting', { dates: range(trip.pendingChange.start, trip.pendingChange.end) }) : t('m.trips.changeAsk', { name: trip.pendingChange.proposedBy, dates: range(trip.pendingChange.start, trip.pendingChange.end) })}</p>
              {!trip.pendingChange.mine && !trip.pendingChange.approvedByMe && (
                <div className="stage-prompt-actions">
                  <button className="btn btn-primary" onClick={() => answerChange(trip.id, trip.pendingChange!.id, true).catch(e => setMsg(errorText(e)))}>{t('m.trips.confirm')}</button>
                  <button className="btn btn-secondary" onClick={() => answerChange(trip.id, trip.pendingChange!.id, false).catch(e => setMsg(errorText(e)))}>{t('m.trips.decline')}</button>
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="chip" onClick={() => openPlanTrip({ tripId: trip.id })}><Icon name="settings" size={13} /> {t('m.trips.edit')}</button>
            {trip.inviteCode && <button className="chip" onClick={() => invite(trip)}><Icon name="users" size={13} /> {t('m.trips.invite')}</button>}
            <button className="chip" style={{ color: 'var(--error)' }} onClick={() => setConfirmDelete(trip)}><Icon name="trash" size={13} /> {trip.isOwner === false ? t('m.trips.leave') : t('m.trips.delete')}</button>
          </div>
        </div>
      ))}

      <span className="home-eyebrow" style={{ marginTop: '26px' }}>{t('m.trips.pastEyebrow')}</span>
      <h2 className="home-title" style={{ marginBottom: '12px' }}>{t('m.trips.past')}</h2>
      {past.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--label-secondary)' }}>{t('m.trips.nonePast')}</p>
      ) : past.map(trip => {
        const s = stats[trip.id]
        return (
          <Link key={trip.id} href="/recap" className="past-trip press" onClick={() => triggerHaptic('light')}>
            {s?.photos[0] ? <Img src={s.photos[0]} alt="" width={900} height={400} sizes="100vw" /> : <span className="home-hero-fallback" aria-hidden />}
            <span className="past-trip-shade" aria-hidden />
            <span className="past-trip-body">
              <span style={{ display: 'block', fontSize: '22px', fontWeight: 800 }}>{townFor(trip.city).name}</span>
              <span className="num-font" style={{ display: 'block', fontSize: '13px', opacity: 0.9 }}>{range(trip.start, trip.end)}</span>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '13px', fontWeight: 600 }}>
                <span className="num-font">{t('m.trips.pastStats', { places: s?.places ?? 0, explored: s?.explored ?? 0 })}</span>
                <span>{t('m.trips.recap')}</span>
              </span>
            </span>
          </Link>
        )
      })}

      {confirmDelete && (
        <>
          <div className="bottom-sheet-overlay open" onClick={() => setConfirmDelete(null)} />
          <div className="bottom-sheet open" role="dialog" aria-modal="true" aria-label={t('m.trips.deleteTitle')}>
            <div className="sheet-grabber" />
            <div style={{ padding: '0 20px 24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--label-primary)' }}>{confirmDelete.isOwner === false ? t('m.trips.leaveTitle') : t('m.trips.deleteTitle')}</h3>
              <p style={{ fontSize: '14px', color: 'var(--label-secondary)', margin: '6px 0 14px' }}>{townFor(confirmDelete.city).name} · {range(confirmDelete.start, confirmDelete.end)}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-tertiary" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>{t('m.book.cancel')}</button>
                <button className="btn btn-primary" style={{ flex: 2, background: 'var(--error)' }} onClick={() => remove(confirmDelete)}>{confirmDelete.isOwner === false ? t('m.trips.leave') : t('m.trips.delete')}</button>
              </div>
            </div>
          </div>
        </>
      )}
      <Dock />
    </main>
  )
}
