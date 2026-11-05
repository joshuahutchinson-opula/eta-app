// components/ArrivalMoment.tsx — on the first open at an airport or a hotel
// (lib/arrival.ts): switch the region to where they've landed and offer a
// vetted transfer plus the welcome reward on offer there. Runs once per
// device; the rewards themselves are data (lib/welcome.ts).
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import QRCode from '@/components/QRCode'
import { useRegion } from '@/components/RegionProvider'
import { getCurrentUser } from '@/lib/auth-client'
import { apiJson } from '@/lib/api-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { saveTrip } from '@/lib/trip-mode'
import { isCityCode } from '@/lib/regions'
import type { LatLng } from '@/lib/routing'
import type { WelcomeReward } from '@/lib/welcome'
import { hapticRewardRedeemed } from '@/lib/haptics'

const DONE_KEY = 'eta_arrival_checked'

interface Arrival {
  place: { kind: 'airport' | 'hotel'; name: string; city: string; partnerCode?: string | null } | null
  transfers?: Array<{ id: string; name: string; neighborhood: string; images: string[]; phone: string | null; whatsapp: string | null }>
  reward?: WelcomeReward | null
}

export default function ArrivalMoment({ location }: { location: LatLng | null }) {
  const { t } = useLang()
  const errorText = useErrorText()
  const { setCity, town } = useRegion()
  const [arrival, setArrival] = useState<Arrival | null>(null)
  const [open, setOpen] = useState(false)
  const [claim, setClaim] = useState<{ busy: boolean; code: string | null; error: string | null }>({ busy: false, code: null, error: null })

  useEffect(() => {
    if (!location) return
    try { if (localStorage.getItem(DONE_KEY)) return; localStorage.setItem(DONE_KEY, String(Date.now())) } catch { return }
    fetch(`/api/arrival?lat=${location.lat}&lng=${location.lng}`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: (Arrival & { city?: string }) | null) => {
        if (!d?.place) return
        if (isCityCode(d.place.city)) setCity(d.place.city)
        if (d.place.kind === 'hotel') saveTrip({ stayName: d.place.name, stayCity: d.place.city, partnerCode: d.place.partnerCode ?? null }).catch(() => {})
        setArrival(d)
        setOpen(true)
      })
      .catch(() => {})
  }, [location, setCity])

  const claimReward = async () => {
    if (!arrival?.reward) return
    setClaim({ busy: true, code: null, error: null })
    try {
      const { redemption } = await apiJson<{ redemption: { code: string } }>('/api/welcome', { method: 'POST', body: { rewardId: arrival.reward.id } })
      hapticRewardRedeemed()
      setClaim({ busy: false, code: redemption.code, error: null })
    } catch (e) {
      setClaim({ busy: false, code: null, error: errorText(e) })
    }
  }

  if (!arrival?.place) return null
  const place = arrival.place
  const signedIn = Boolean(getCurrentUser())

  return (
    <>
      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <div className={`bottom-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.arrival.title')} style={{ maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="sheet-grabber" />
        {open && (
          <div style={{ padding: '0 20px 24px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'var(--rum)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <Icon name={place.kind === 'airport' ? 'plane' : 'home'} size={24} />
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--label-primary)', marginBottom: '4px' }}>{t('m.arrival.title')}</h3>
            <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '16px' }}>
              {place.kind === 'airport' ? t('m.arrival.airport', { place: place.name, town: town.name }) : t('m.arrival.hotel', { place: place.name, town: town.name })}
            </p>

            {place.kind === 'airport' && arrival.transfers && arrival.transfers.length > 0 && (
              <>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.arrival.transfers')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {arrival.transfers.map(v => (
                    <Link key={v.id} href={`/vendor/${v.id}`} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', textDecoration: 'none' }}>
                      <span style={{ width: '44px', height: '44px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: 'var(--system-bg-secondary)' }}>
                        {v.images[0] && <Img src={v.images[0]} alt="" width={88} height={88} sizes="44px" />}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>{v.name}</span>
                        <span style={{ display: 'block', fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}><Icon name="shield" size={11} /> {t('m.arrival.vetted')}</span>
                      </span>
                      <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
                    </Link>
                  ))}
                </div>
              </>
            )}

            {arrival.reward && (
              <div className="card" style={{ padding: '14px', marginBottom: '16px', cursor: 'default', border: '1.5px solid var(--gold)' }}>
                <p className="section-eyebrow" style={{ marginBottom: '2px' }}>{t('m.arrival.welcomePerk')}</p>
                <p style={{ fontSize: '17px', fontWeight: 700, color: 'var(--label-primary)' }}>{arrival.reward.name}</p>
                <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '10px' }}>
                  {arrival.reward.description}
                  {arrival.reward.vendors.length > 0 && ` · ${t('m.rewards.at', { list: arrival.reward.vendors.map(v => v.name).join(', ') })}`}
                </p>
                {claim.code ? (
                  <div style={{ textAlign: 'center' }}>
                    <QRCode value={claim.code} size={160} />
                    <p className="num-font" style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.08em', marginTop: '8px', color: 'var(--label-primary)' }}>{claim.code}</p>
                    <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{t('m.rewards.showVendor')}</p>
                  </div>
                ) : signedIn ? (
                  <button className="btn btn-primary" onClick={claimReward} disabled={claim.busy} style={{ width: '100%' }}>{claim.busy ? '…' : t('m.arrival.claim')}</button>
                ) : (
                  <Link href="/login?next=/rewards" className="btn btn-primary" style={{ width: '100%', textDecoration: 'none' }}>{t('m.arrival.loginToClaim')}</Link>
                )}
                {claim.error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginTop: '6px' }}>{claim.error}</p>}
              </div>
            )}

            <button className="btn btn-tertiary" onClick={() => setOpen(false)} style={{ width: '100%' }}>{t('m.arrival.explore', { town: town.name })}</button>
          </div>
        )}
      </div>
    </>
  )
}
