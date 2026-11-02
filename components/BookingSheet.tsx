// components/BookingSheet.tsx — the booking step for an experience (or event
// tickets): date, time and party size → price breakdown, the cancellation
// summary → payment → done.
// Start times show their spots left (or Sold out) when the experience lists
// a capacity, and today's times that have already passed (Jamaica time)
// can't be picked. Payment is a clearly labelled placeholder ("Pay with ETA
// Wallet") until the real payment rails are decided; it deducts from
// walletBalance.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import Price from '@/components/Price'
import VerifyEmailBanner from '@/components/VerifyEmailBanner'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { getAuthToken, getCurrentUser, isVerified, setCurrentUser } from '@/lib/auth-client'
import { jamaicaDateTime, jamaicaToday, priceBreakdown } from '@/lib/pricing'
import { parseTier, TIER_SUMMARY_KEY } from '@/lib/cancellation'
import { hapticBookingConfirmed, triggerHaptic } from '@/lib/haptics'
import type { SlotState } from '@/lib/slots'

export interface BookingDetails {
  date: string
  time: string | null
  partySize: number
}

export interface BookingResult {
  bookingId?: string | null
  transactionId?: string | null
  walletBalance?: number | null
}

interface Props {
  open: boolean
  onClose: () => void
  title: string
  unitPrice: number
  priceIsEstimate?: boolean
  startTimes?: string[]
  maxPartySize?: number | null
  defaultPartySize?: number
  /** Enables per-slot capacity ("3 spots left", "Sold out"). */
  experienceId?: string | null
  /** lib/cancellation.ts tier; summarised before paying. */
  cancellationTier?: string | null
  /** The vendor's own cancellation wording, shown under the summary. */
  cancellationNote?: string | null
  /** Event tickets: no date/time to pick, this "when" line instead. */
  fixedWhen?: { date: string; label: string } | null
  /** Shown under the total when part of it is paid by the rest of the crew. */
  chargeNow?: number | null
  /** Crew trips: everyone pays their own share through the trip link. */
  split?: { members: number; on: boolean; onToggle: (on: boolean) => void } | null
  onConfirm: (details: BookingDetails) => Promise<BookingResult>
  /** Called when the traveler taps Continue on the confirmation. */
  onDone: (result: BookingResult) => void
}

function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** True when that start time today (Jamaica time) has already gone. */
function passedToday(date: string, time: string): boolean {
  if (date !== jamaicaToday()) return false
  const start = jamaicaDateTime(date, time)
  return Boolean(start && start.getTime() <= Date.now())
}

export default function BookingSheet({ open, onClose, title, unitPrice, priceIsEstimate, startTimes = [], maxPartySize, defaultPartySize = 1, experienceId, cancellationTier, cancellationNote, fixedWhen, chargeNow, split, onConfirm, onDone }: Props) {
  const { t } = useLang()
  const errorText = useErrorText()
  const tickets = Boolean(fixedWhen)
  const [step, setStep] = useState<'details' | 'pay' | 'done'>('details')
  const [date, setDate] = useState(jamaicaToday())
  const [time, setTime] = useState<string>(startTimes[0] ?? '10:00')
  const [party, setParty] = useState(defaultPartySize)
  const [wallet, setWallet] = useState<number | null>(null)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BookingResult>({})
  const [slots, setSlots] = useState<SlotState[] | null>(null)
  const [verified, setVerified] = useState(true)
  const max = maxPartySize ?? 20

  useEffect(() => {
    if (!open) return
    setStep('details')
    setError(null)
    setParty(Math.min(max, Math.max(1, defaultPartySize)))
    if (fixedWhen) setDate(fixedWhen.date)
    const user = getCurrentUser()
    setWallet(user?.walletBalance ?? null)
    setVerified(!user || isVerified(user))
    const token = getAuthToken()
    if (token) {
      fetch('/api/auth/verify', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d?.user) { setCurrentUser(d.user); setWallet(d.user.walletBalance); setVerified(isVerified(d.user)) } })
        .catch(() => {})
    }
    // Reset only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Per-slot capacity for the picked date.
  useEffect(() => {
    if (!open || !experienceId || tickets || startTimes.length === 0) { setSlots(null); return }
    let cancelled = false
    setSlots(null)
    fetch(`/api/experiences/${experienceId}/availability?date=${date}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) setSlots(Array.isArray(d?.slots) ? d.slots : []) })
      .catch(() => { if (!cancelled) setSlots([]) })
    return () => { cancelled = true }
  }, [open, experienceId, date, tickets, startTimes.length])

  const splitOn = Boolean(split?.on && split.members > 1)
  const seats = splitOn ? split!.members : party
  const slotFor = (st: string) => slots?.find(s => s.time === st)
  const unavailable = (st: string) => {
    const s = slotFor(st)
    return passedToday(date, st) || Boolean(s && (s.soldOut || s.closed || (s.left !== null && s.left < seats)))
  }

  // Keep the picked time valid as the date, party size or availability change.
  useEffect(() => {
    if (!open || tickets || startTimes.length === 0) return
    if (!time || unavailable(time) || !startTimes.includes(time)) setTime(startTimes.find(st => !unavailable(st)) ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, party, slots])

  const price = priceBreakdown(unitPrice, seats)
  const signedIn = Boolean(getCurrentUser())
  const due = splitOn ? priceBreakdown(unitPrice, 1).total : chargeNow ?? price.total
  const short = wallet !== null && wallet < due
  const tier = parseTier(cancellationTier)

  const toPay = () => {
    if (!tickets) {
      if (startTimes.length > 0 && !time) { setError(t('m.book.pickTime')); return }
      if (time && passedToday(date, time)) { setError(t('m.book.timePassed')); return }
    }
    setError(null)
    triggerHaptic('light')
    setStep('pay')
  }

  const pay = async () => {
    setPaying(true)
    setError(null)
    try {
      const r = await onConfirm({ date, time: tickets ? null : time || null, partySize: seats })
      if (typeof r.walletBalance === 'number') {
        const u = getCurrentUser()
        if (u) setCurrentUser({ ...u, walletBalance: r.walletBalance })
      }
      setResult(r)
      hapticBookingConfirmed()
      setStep('done')
    } catch (e) {
      setError(errorText(e))
    } finally {
      setPaying(false)
    }
  }

  const row = (label: string, value: React.ReactNode, strong = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0' }}>
      <span style={{ fontSize: '15px', color: strong ? 'var(--label-primary)' : 'var(--label-secondary)', fontWeight: strong ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: strong ? '17px' : '15px', fontWeight: strong ? 700 : 600, color: 'var(--label-primary)' }}>{value}</span>
    </div>
  )

  const slotNote = (st: string) => {
    if (passedToday(date, st)) return t('m.book.passed')
    const s = slotFor(st)
    if (!s) return null
    if (s.soldOut || s.closed) return t('m.book.soldOut')
    if (s.left === null) return null
    if (s.left < seats) return t('m.book.tooFew', { n: seats })
    return s.left === 1 ? t('m.book.oneSpotLeft') : s.left <= 10 ? t('m.book.spotsLeft', { n: s.left }) : null
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', fontSize: '16px', fontFamily: 'inherit', color: 'var(--label-primary)', minHeight: '44px' }

  return (
    <>
      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={step === 'done' ? undefined : onClose} />
      <div className={`bottom-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={tickets ? t('m.book.ticketsTitle') : t('m.book.title')}>
        <div className="sheet-grabber" />
        {open && (
          <div style={{ padding: '0 20px 24px' }}>
            {step === 'details' && (
              <>
                <p className="section-eyebrow">{t('m.book.step', { n: 1 })}</p>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '16px' }}>{title}</h3>

                {fixedWhen ? (
                  <div className="card" style={{ padding: '12px 14px', marginBottom: '16px', cursor: 'default', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Icon name="calendar" size={18} style={{ color: 'var(--rum-text)' }} />
                    <span>
                      <span style={{ display: 'block', fontSize: '12px', color: 'var(--label-secondary)' }}>{t('m.book.when')}</span>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{fixedWhen.label}</span>
                    </span>
                  </div>
                ) : (
                  <>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '6px' }} htmlFor="book-date">{t('m.book.date')}</label>
                    <input id="book-date" type="date" min={jamaicaToday()} value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, marginBottom: '16px' }} />

                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '6px' }}>{t('m.book.time')}</p>
                    {startTimes.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }} aria-busy={Boolean(experienceId) && slots === null}>
                        {startTimes.map(st => {
                          const note = slotNote(st)
                          const off = unavailable(st)
                          return (
                            <button
                              key={st}
                              className={`chip ${time === st ? 'active' : ''}`}
                              aria-pressed={time === st}
                              disabled={off}
                              onClick={() => { triggerHaptic('selection'); setTime(st) }}
                              style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0, minHeight: '44px', opacity: off ? 0.45 : 1, textDecoration: off && note === t('m.book.passed') ? 'line-through' : undefined }}
                            >
                              <span>{timeLabel(st)}</span>
                              {note && <span style={{ fontSize: '11px', fontWeight: 600, color: off ? 'var(--label-tertiary)' : 'var(--warning)' }}>{note}</span>}
                            </button>
                          )
                        })}
                        {experienceId && slots === null && <span role="status" style={{ fontSize: '12px', color: 'var(--label-tertiary)', alignSelf: 'center' }}>{t('m.book.checkingSlots')}</span>}
                      </div>
                    ) : (
                      <input type="time" value={time} onChange={e => setTime(e.target.value)} aria-label={t('m.book.time')} style={{ ...inputStyle, marginBottom: '16px' }} />
                    )}
                  </>
                )}

                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '6px' }}>{tickets ? t('m.book.quantity') : t('m.book.party')}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                  <button className="heart-btn" aria-label={t('m.book.fewer')} disabled={party <= 1} onClick={() => { triggerHaptic('selection'); setParty(p => Math.max(1, p - 1)) }} style={{ fontSize: '22px', fontWeight: 600, color: 'var(--label-primary)' }}>−</button>
                  <span className="num-font" aria-live="polite" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)', minWidth: '32px', textAlign: 'center' }}>{party}</span>
                  <button className="heart-btn" aria-label={t('m.book.more')} disabled={party >= max} onClick={() => { triggerHaptic('selection'); setParty(p => Math.min(max, p + 1)) }} style={{ fontSize: '22px', fontWeight: 600, color: 'var(--label-primary)' }}>+</button>
                  {maxPartySize ? <span style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{t('m.book.maxParty', { n: maxPartySize })}</span> : null}
                </div>

                {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{error}</p>}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-tertiary" onClick={onClose} style={{ flex: 1 }}>{t('m.book.cancel')}</button>
                  <button className="btn btn-primary" onClick={toPay} disabled={!date || (startTimes.length > 0 && !tickets && !time)} style={{ flex: 2 }}>{t('m.book.review')}</button>
                </div>
              </>
            )}

            {step === 'pay' && (
              <>
                <p className="section-eyebrow">{t('m.book.step', { n: 2 })}</p>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '12px' }}>{t('m.book.breakdown')}</h3>
                <div className="card" style={{ padding: '8px 16px', marginBottom: '12px', cursor: 'default' }}>
                  {row(tickets ? t('m.book.perTicketTimes', { n: seats }) : t('m.book.perPersonTimes', { n: seats }), <><Price usd={price.unitPrice} compact /> × {seats}</>)}
                  {row(t('m.book.subtotal'), <Price usd={price.subtotal} compact />)}
                  {price.fees > 0 && row(t('m.book.fees'), <Price usd={price.fees} compact />)}
                  <div style={{ borderTop: '0.5px solid var(--separator)', marginTop: '4px', paddingTop: '4px' }}>
                    {row(t('m.book.total'), <Price usd={price.total} />, true)}
                    {due !== price.total && row(t('m.book.yourShare'), <Price usd={due} />, true)}
                  </div>
                </div>
                {priceIsEstimate && <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '12px' }}>{t('m.book.estimateNote')}</p>}

                {split && split.members > 1 && (
                  <button role="switch" aria-checked={splitOn} onClick={() => { triggerHaptic('selection'); split.onToggle(!splitOn) }} className="card" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', marginBottom: '12px', border: 'none', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                    <Icon name="users" size={18} style={{ color: 'var(--rum-text)' }} />
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.crew.splitToggle')}</span>
                      <span style={{ display: 'block', fontSize: '12px', color: 'var(--label-secondary)', marginTop: '2px' }}>{t('m.crew.splitToggleBody')}</span>
                    </span>
                    <span aria-hidden style={{ width: '48px', height: '28px', borderRadius: '999px', background: splitOn ? 'var(--rum)' : 'var(--separator)', position: 'relative', flexShrink: 0 }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: splitOn ? '23px' : '3px', transition: 'left 0.2s ease' }} />
                    </span>
                  </button>
                )}

                <div className="card" style={{ padding: '12px 14px', marginBottom: '12px', cursor: 'default' }}>
                  <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: 'var(--label-primary)' }}>
                    <Icon name="shield" size={16} style={{ color: 'var(--rum-text)' }} /> {t('m.cancel.summaryTitle')}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--label-primary)', margin: '4px 0 2px', lineHeight: 1.4 }}>{t(TIER_SUMMARY_KEY[tier])}</p>
                  {cancellationNote && <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '2px' }}>{t('m.cancel.vendorNote', { note: cancellationNote })}</p>}
                  <p style={{ fontSize: '12px', color: 'var(--label-secondary)' }}>
                    {t('m.cancel.refundToWallet')}{' '}
                    <Link href="/policies/cancellation" style={{ color: 'var(--rum-text)', fontWeight: 600 }}>{t('m.cancel.fullPolicy')}</Link>
                  </p>
                </div>

                <div className="card" style={{ padding: '14px 16px', marginBottom: '16px', cursor: 'default', border: '1.5px dashed var(--separator)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <Icon name="wallet" size={18} style={{ color: 'var(--rum-text)' }} />
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)' }}>{t('m.book.payWallet')}</span>
                    <span className="chip" style={{ marginLeft: 'auto', minHeight: '24px', padding: '2px 8px', fontSize: '11px', cursor: 'default' }}>{t('m.book.placeholder')}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{t('m.book.placeholderNote')}</p>
                  {wallet !== null && (
                    <p style={{ fontSize: '13px', color: short ? 'var(--error)' : 'var(--label-secondary)', marginTop: '6px' }}>
                      {t('m.book.walletBalance')} <Price usd={wallet} compact />
                    </p>
                  )}
                </div>

                {!signedIn && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{t('m.book.loginFirst')}</p>}
                {signedIn && !verified && <div style={{ marginBottom: '8px' }}><p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '6px' }}>{t('m.book.verifyFirst')}</p><VerifyEmailBanner padded={false} /></div>}
                {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{error}</p>}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-tertiary" onClick={() => setStep('details')} style={{ flex: 1 }}>{t('m.book.back')}</button>
                  {!signedIn ? (
                    <Link href={`/login?next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/')}`} className="btn btn-primary" style={{ flex: 2, textDecoration: 'none' }}>{t('m.profile.login')}</Link>
                  ) : short ? (
                    <Link href="/wallet" className="btn btn-primary" style={{ flex: 2, textDecoration: 'none' }}>{t('m.book.topUp')}</Link>
                  ) : (
                    <button className="btn btn-primary" onClick={pay} disabled={paying || !verified} style={{ flex: 2 }}>
                      {paying ? '…' : <>{t('m.book.pay')} <Price usd={due} compact /></>}
                    </button>
                  )}
                </div>
              </>
            )}

            {step === 'done' && (
              <div style={{ textAlign: 'center' }}>
                <div className="check-pop-in" style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px auto 12px', color: 'white' }}>
                  <Icon name="check" size={26} />
                </div>
                <h3 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '4px' }}>{tickets ? t('m.book.ticketsBooked') : t('m.book.booked')}</h3>
                <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '20px' }}>{tickets ? t('m.book.ticketsBookedBody') : t('m.book.bookedBody')}</p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <Link href="/bookings" className="btn btn-secondary" style={{ flex: 1, textDecoration: 'none' }}>
                    <Icon name="ticket" size={16} /> {t('m.book.ticket')}
                  </Link>
                  {result.transactionId && (
                    <Link href={`/receipt/${result.transactionId}`} className="btn btn-secondary" style={{ flex: 1, textDecoration: 'none' }}>
                      <Icon name="receipt" size={16} /> {t('m.book.receipt')}
                    </Link>
                  )}
                </div>
                <button className="btn btn-primary" onClick={() => onDone(result)} style={{ width: '100%' }}>{t('m.book.continue')}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
