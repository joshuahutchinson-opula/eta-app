// components/experiences/ReserveSheet.tsx — "Reserve" from a moment: pick how
// many people, confirm, done. Nothing is paid online: it's a reservation
// (a PENDING booking, POST /api/bookings) and you pay there with ETA Pay
// for 2× points. Signed out, it sends you to log in first.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { apiJson } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { useCurrency } from '@/lib/currency'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { hapticBookingConfirmed, triggerHaptic } from '@/lib/haptics'
import type { Moment } from '@/lib/moments'

const TZ = 'America/Jamaica'

export default function ReserveSheet({ moment, onClose, onReserved }: { moment: Moment | null; onClose: () => void; onReserved?: () => void }) {
  const router = useRouter()
  const { t, lang } = useLang()
  const errorText = useErrorText()
  const { format } = useCurrency()
  const locale = lang === 'en' ? 'en-US' : lang
  const [people, setPeople] = useState(2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const open = Boolean(moment)

  useEffect(() => {
    if (!moment) return
    setError(null)
    setDone(false)
    setPeople(p => Math.max(1, Math.min(p, moment.spotsLeft ?? 12)))
  }, [moment])

  const max = Math.max(1, Math.min(12, moment?.spotsLeft ?? 12))
  const when = moment ? new Date(moment.startAt).toLocaleString(locale, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: TZ }) : ''

  const confirm = async () => {
    if (!moment) return
    if (!getCurrentUser()) { router.push(`/login?next=${encodeURIComponent(`/experiences/${moment.id}`)}`); return }
    setBusy(true)
    setError(null)
    try {
      const date = new Date(moment.startAt).toLocaleDateString('en-CA', { timeZone: TZ })
      await apiJson('/api/bookings', { method: 'POST', body: { experienceId: moment.id, date, time: moment.time ?? undefined, partySize: people } })
      hapticBookingConfirmed()
      setDone(true)
      onReserved?.()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`bottom-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open} aria-label={t('m.mo.reserve')}>
        <div className="sheet-grabber" />
        {moment && (
          <div style={{ padding: '0 20px 24px', color: 'var(--label-primary)' }}>
            {done ? (
              <div className="swap-fade" style={{ textAlign: 'center', padding: '8px 0' }}>
                <span className="check-pop-in" style={{ display: 'inline-flex', width: '56px', height: '56px', borderRadius: '50%', background: 'var(--rum)', color: '#fff', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={26} /></span>
                <h3 style={{ marginTop: '12px', fontSize: '20px', fontWeight: 800 }}>{t('m.rs.done')}</h3>
                <p style={{ marginTop: '6px', fontSize: '15px', color: 'var(--label-secondary)' }}>{t('m.rs.doneBody', { title: moment.title, when })}</p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
                  <Link href="/bookings" className="btn btn-secondary" style={{ flex: 1, textDecoration: 'none' }} onClick={onClose}>{t('m.rs.myBookings')}</Link>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={onClose}>{t('m.profile.done')}</button>
                </div>
              </div>
            ) : (
              <>
                <p className="section-eyebrow">{t('m.mo.reserve')}</p>
                <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '2px 0 14px' }}>{moment.title}</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '0.5px solid var(--separator)' }}>
                  <span style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>{t('m.rs.when')}</span>
                  <span className="num-font" style={{ fontSize: '15px', fontWeight: 700 }}>{when}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid var(--separator)' }}>
                  <span style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>{t('m.rs.people')}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '14px' }}>
                    <button className="back-button" aria-label="−" disabled={people <= 1} onClick={() => { triggerHaptic('selection'); setPeople(p => Math.max(1, p - 1)) }}><Icon name="minus" size={16} /></button>
                    <span className="num-font" style={{ fontSize: '18px', fontWeight: 700, minWidth: '20px', textAlign: 'center' }} aria-live="polite">{people}</span>
                    <button className="back-button" aria-label="+" disabled={people >= max} onClick={() => { triggerHaptic('selection'); setPeople(p => Math.min(max, p + 1)) }}><Icon name="plus" size={16} /></button>
                  </span>
                </div>
                {moment.price != null && moment.price > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
                    <span style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>{format(moment.price)} × {people}</span>
                    <span className="num-font" style={{ fontSize: '17px', fontWeight: 800 }}>{format(moment.price * people)}</span>
                  </div>
                )}
                <p style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', color: 'var(--label-secondary)', margin: '4px 0 16px', lineHeight: 1.4 }}>
                  <Icon name="star" size={14} style={{ color: 'var(--gold)', flexShrink: 0, marginTop: '2px' }} />{t('m.rs.payThere')}
                </p>
                {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px', textAlign: 'center' }}>{error}</p>}
                <button className="btn btn-primary" style={{ width: '100%', marginBottom: '8px' }} disabled={busy} onClick={confirm}>
                  {getCurrentUser() ? t('m.rs.confirm', { n: people }) : t('m.rs.login')}
                </button>
                <button className="btn btn-tertiary" style={{ width: '100%' }} onClick={() => { triggerHaptic('light'); router.push(`/experiences/${moment.id}`) }}>{t('m.rs.details')}</button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
