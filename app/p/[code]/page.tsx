// app/p/[code]/page.tsx — where a hotel or villa partner's QR (or link) lands:
// presets the region and stay, shows the welcome perk, and after a quick
// sign-up (the hotel already filled in as the stay) goes to the arrival's
// Checked In screen with the hotel's gift. The property is recorded as
// their referrer, and the trip starts today with the hotel as the stay.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import QRCode from '@/components/QRCode'
import { useRegion } from '@/components/RegionProvider'
import { getCurrentUser } from '@/lib/auth-client'
import { apiJson } from '@/lib/api-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { saveTrip } from '@/lib/trip-mode'
import { isCityCode, townFor } from '@/lib/regions'
import { hapticRewardRedeemed } from '@/lib/haptics'
import { markOnboarded } from '@/lib/onboarding'
import { handToArrival } from '@/lib/arrival-client'
import { addTrip, allTrips, refreshTrips, setTravelerType, updateTrip } from '@/lib/stage-client'
import { addDays, jamaicaDayKey } from '@/lib/trip-dates'
import type { CityCode } from '@/lib/regions'

interface Preview { code: string; name: string; kind: 'HOTEL' | 'VILLA'; city: string; perk: { id: string; name: string; description: string } | null }

export default function PartnerLanding() {
  const { code } = useParams() as { code: string }
  const router = useRouter()
  const { t } = useLang()
  const errorText = useErrorText()
  const { setCity } = useRegion()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [voucher, setVoucher] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const signedIn = typeof window !== 'undefined' && Boolean(getCurrentUser())
  const [autoGo, setAutoGo] = useState(false)
  useEffect(() => { setAutoGo(new URLSearchParams(window.location.search).get('go') === '1') }, [])

  useEffect(() => {
    apiJson<Preview>(`/api/partners/${encodeURIComponent(code)}`)
      .then(p => {
        setPreview(p)
        if (isCityCode(p.city)) setCity(p.city)
        saveTrip({ stayName: p.name, stayCity: p.city, partnerCode: p.code }).catch(() => {})
      })
      .catch(e => setError(errorText(e)))
  }, [code, setCity, errorText])

  // The hotel is the stay, the trip starts today: on to Checked In.
  const checkIn = async () => {
    if (!preview) return
    const today = jamaicaDayKey()
    await setTravelerType('VISITOR').catch(() => {})
    await refreshTrips()
    const current = allTrips().find(x => x.status !== 'ENDED' && x.start <= addDays(today, 2) && x.end >= today)
    const stay = { stayName: preview.name, stayCity: preview.city as CityCode }
    const trip = current
      ? (await updateTrip(current.id, { ...stay, status: 'ACTIVE' }).catch(() => ({ trip: current }))).trip ?? current
      : await addTrip({ city: preview.city as CityCode, start: today, end: addDays(today, 6), status: 'ACTIVE', ...stay }).catch(() => null)
    handToArrival({
      place: { kind: 'hotel', name: preview.name, city: preview.city as CityCode, partnerCode: preview.code },
      city: preview.city,
      reward: null,
      trip: trip ? { tripId: trip.id, kind: 'VISIT', returning: Boolean(trip.returning), stay: { name: preview.name, city: preview.city, lat: null, lng: null, partnerCode: preview.code }, ride: null, end: trip.end } : undefined
    })
    markOnboarded()
    router.push('/arrival?step=checkin')
  }

  const claim = async () => {
    setBusy(true)
    setError(null)
    try {
      const joined = await apiJson<{ redemption: { code: string } | null }>(`/api/partners/${encodeURIComponent(code)}`, { method: 'POST' })
      try { localStorage.setItem('eta_partner_claimed', preview?.code ?? code) } catch {}
      hapticRewardRedeemed()
      if (joined.redemption) setVoucher(joined.redemption.code)
      await checkIn()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (autoGo && preview && signedIn && !busy && !voucher) { setAutoGo(false); claim() }
  }, [autoGo, preview, signedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', padding: '24px 16px' }}>
      <div className="empty-state" style={{ minHeight: '80vh', justifyContent: 'center', maxWidth: '420px', margin: '0 auto' }}>
        {error && !preview ? (
          <>
            <Icon name="home" size={36} style={{ color: 'var(--label-tertiary)' }} />
            <p role="alert" style={{ fontSize: '16px', color: 'var(--label-primary)' }}>{error}</p>
            <Link href="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('m.stories.backHome')}</Link>
          </>
        ) : !preview ? (
          <div className="skeleton-card" style={{ width: '100%', height: '220px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>
        ) : (
          <>
            <div style={{ width: '60px', height: '60px', borderRadius: '18px', background: 'var(--rum)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="home" size={28} /></div>
            <p className="section-eyebrow">{t('m.partner.welcomeFrom')}</p>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--label-primary)' }}>{preview.name}</h1>
            <p>{t('m.partner.regionSet', { town: townFor(preview.city).name })}</p>

            {preview.perk && (
              <div className="card" style={{ width: '100%', padding: '16px', textAlign: 'left', border: '1.5px solid var(--gold)', cursor: 'default' }}>
                <p className="section-eyebrow">{t('m.arrival.welcomePerk')}</p>
                <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--label-primary)' }}>{preview.perk.name}</p>
                <p style={{ fontSize: '14px', color: 'var(--label-secondary)' }}>{preview.perk.description}</p>
                {voucher && (
                  <div style={{ textAlign: 'center', marginTop: '12px' }}>
                    <QRCode value={voucher} size={170} />
                    <p className="num-font" style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.08em', marginTop: '8px', color: 'var(--label-primary)' }}>{voucher}</p>
                    <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{t('m.rewards.showVendor')}</p>
                  </div>
                )}
              </div>
            )}

            {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)' }}>{error}</p>}

            {voucher ? (
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { markOnboarded(); router.push('/') }}>{t('m.arrival.explore', { town: townFor(preview.city).name })}</button>
            ) : signedIn ? (
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={claim} disabled={busy}>{busy ? '…' : preview.perk ? t('m.arrival.claim') : t('m.partner.continue')}</button>
            ) : (
              <>
                <Link href={`/register?next=${encodeURIComponent(`/p/${preview.code}?go=1`)}`} className="btn btn-primary" style={{ width: '100%', textDecoration: 'none' }}>{preview.perk ? t('m.arrival.loginToClaim') : t('m.partner.continue')}</Link>
                <Link href={`/login?next=${encodeURIComponent(`/p/${preview.code}?go=1`)}`} className="btn btn-tertiary" style={{ width: '100%', textDecoration: 'none' }}>{t('m.profile.login')}</Link>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}
