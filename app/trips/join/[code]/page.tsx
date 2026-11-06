// app/trips/join/[code]/page.tsx — a friend's trip invite link. Shows the
// trip first (town, dates, stay, who's going); "Join the trip" copies its
// dates and town onto theirs (signing up first if needed — the link comes
// back here afterwards).
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { useRegion } from '@/components/RegionProvider'
import { useDateRange } from '@/components/home/StageBlocks'
import { apiJson } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { markOnboarded } from '@/lib/onboarding'
import { refreshTrips } from '@/lib/stage-client'
import { isCityCode, townFor } from '@/lib/regions'
import { hapticBookingConfirmed } from '@/lib/haptics'

interface Preview { code: string; city: string; start: string; end: string; stayName: string | null; owner: { name: string; avatarUrl: string | null }; people: number }

export default function JoinTrip() {
  const { code } = useParams() as { code: string }
  const router = useRouter()
  const { t } = useLang()
  const errorText = useErrorText()
  const range = useDateRange()
  const { setCity } = useRegion()
  const [trip, setTrip] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    apiJson<Preview>(`/api/travel-trips/join?code=${encodeURIComponent(code)}`).then(setTrip).catch(e => setError(errorText(e)))
  }, [code, errorText])

  const join = async () => {
    if (!getCurrentUser()) { router.push(`/register?next=${encodeURIComponent(`/trips/join/${code}`)}`); return }
    setBusy(true)
    setError(null)
    try {
      await apiJson('/api/travel-trips/join', { method: 'POST', body: { code } })
      await refreshTrips()
      if (trip && isCityCode(trip.city)) setCity(trip.city)
      markOnboarded()
      hapticBookingConfirmed()
      router.push('/')
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', padding: '24px 16px' }}>
      <div className="empty-state" style={{ minHeight: '80vh', justifyContent: 'center', maxWidth: '420px', margin: '0 auto' }}>
        {!trip ? (
          error ? (
            <>
              <Icon name="plane" size={36} style={{ color: 'var(--label-tertiary)' }} />
              <p role="alert" style={{ fontSize: '16px', color: 'var(--label-primary)' }}>{error}</p>
              <Link href="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('m.stories.backHome')}</Link>
            </>
          ) : <div className="home-skel" style={{ width: '100%', height: '220px' }} aria-hidden />
        ) : (
          <>
            <span className="invite-banner" style={{ width: '100%' }}>
              {trip.owner.avatarUrl ? <img src={trip.owner.avatarUrl} alt="" /> : <span className="invite-initial">{trip.owner.name.charAt(0)}</span>}
              <span style={{ textAlign: 'left' }}>{t('m.trips.joinFrom', { name: trip.owner.name })}</span>
            </span>
            <p className="home-eyebrow">{t('m.trips.joinEyebrow')}</p>
            <h1 style={{ fontSize: '30px', fontWeight: 800, color: 'var(--label-primary)' }}>{townFor(trip.city).name}</h1>
            <p className="num-font" style={{ fontSize: '16px', color: 'var(--label-primary)' }}>{range(trip.start, trip.end)}</p>
            {trip.stayName && <p><Icon name="home" size={13} /> {trip.stayName}</p>}
            <p><Icon name="users" size={13} /> {t('m.trips.going', { n: trip.people })}</p>
            {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)' }}>{error}</p>}
            <button className="btn btn-primary press" style={{ width: '100%' }} onClick={join} disabled={busy}>{busy ? '…' : t('m.trips.join')}</button>
          </>
        )}
      </div>
    </main>
  )
}
