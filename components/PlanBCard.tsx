// components/PlanBCard.tsx — Plan B: rain is forecast for a booked outdoor
// experience, so offer the indoor swaps from /api/bookings/plan-b. One tap
// moves the booking (any difference goes back to the wallet).
'use client'

import { useCallback, useEffect, useState } from 'react'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import Price from '@/components/Price'
import { getCurrentUser } from '@/lib/auth-client'
import { apiJson } from '@/lib/api-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { hapticSaved } from '@/lib/haptics'
import type { PlanBOffer } from '@/lib/plan-b'

export default function PlanBCard({ padded = true, onSwapped }: { padded?: boolean; onSwapped?: () => void }) {
  const { t, lang } = useLang()
  const errorText = useErrorText()
  const locale = lang === 'en' ? 'en-US' : lang
  const [offers, setOffers] = useState<PlanBOffer[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!getCurrentUser()) return
    apiJson<{ offers: PlanBOffer[] }>('/api/bookings/plan-b').then(d => setOffers(d.offers ?? [])).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  const swap = async (bookingId: string, experienceId: string, name: string) => {
    setBusy(experienceId)
    setError(null)
    try {
      await apiJson(`/api/bookings/${bookingId}/plan-b`, { method: 'POST', body: { experienceId } })
      hapticSaved()
      setDone(t('m.planb.swapped', { name }))
      setOffers(o => o.filter(x => x.booking.id !== bookingId))
      onSwapped?.()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  if (!offers.length && !done) return null
  const offer = offers[0]

  return (
    <div style={{ padding: padded ? '12px 16px 0' : '0 0 16px' }}>
      <div className="card" style={{ padding: '14px', cursor: 'default', borderLeft: '3px solid var(--info, #0A84FF)' }}>
        {done && !offer ? (
          <p role="status" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 600, color: 'var(--success)' }}><Icon name="check" size={16} /> {done}</p>
        ) : offer && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Icon name="umbrella" size={22} style={{ color: '#0A84FF', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <p className="section-eyebrow">{t('m.planb.eyebrow')}</p>
                <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>
                  {t('m.planb.title', { chance: offer.rainChance, name: offer.booking.experience.name })}
                </p>
                <p className="num-font" style={{ fontSize: '12px', color: 'var(--label-secondary)' }}>
                  {new Date(offer.booking.date).toLocaleString(locale, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Jamaica' })}
                </p>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.planb.sub')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {offer.options.map(o => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '48px', height: '48px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: 'var(--system-bg-secondary)' }}>
                    {o.imageUrl && <Img src={o.imageUrl} alt="" width={96} height={96} sizes="48px" />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--label-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--label-secondary)' }}>
                      {o.time ? `${o.time} · ` : ''}{o.refund > 0 ? <>{t('m.planb.refund')} <Price usd={o.refund} /></> : t('m.planb.samePrice')}
                    </span>
                  </span>
                  <button className="btn btn-primary" onClick={() => swap(offer.booking.id, o.id, o.name)} disabled={busy !== null} style={{ minHeight: '36px', padding: '0 12px', fontSize: '14px' }}>
                    {busy === o.id ? '…' : t('m.planb.swap')}
                  </button>
                </div>
              ))}
            </div>
            {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginTop: '8px' }}>{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}
