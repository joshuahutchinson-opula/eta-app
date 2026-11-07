// components/rewards/GiveBack.tsx — the town's Give Back card on the Rewards
// hub (lib/causes.ts): the cause, what each block of points covers, the
// community progress toward the goal, and a sheet to donate any amount
// (quick picks 100 / 250 / 500, or Other).
'use client'

import { useState } from 'react'
import Icon from '@/lib/icons'
import { apiJson } from '@/lib/api-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { hapticRewardRedeemed, triggerHaptic } from '@/lib/haptics'
import { applyBalances } from '@/lib/rewards-client'
import { DONATE_PICKS } from '@/lib/earn-config'

export interface CauseView {
  id: string; city: string; title: string; body: string; imageUrl: string | null
  goalPoints: number; unitPoints: number; unitLabel: string; raisedPoints: number; units: number; donors: number
}

export default function GiveBack({ cause, townName, points, signedIn, onDonated }: { cause: CauseView; townName: string; points: number; signedIn: boolean; onDonated: (c: CauseView) => void }) {
  const { t, lang } = useLang()
  const errorText = useErrorText()
  const locale = lang === 'en' ? 'en-US' : lang
  const n = (x: number) => x.toLocaleString(locale)
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState<number | 'other'>(DONATE_PICKS[0])
  const [other, setOther] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thanks, setThanks] = useState<string | null>(null)

  const amount = pick === 'other' ? Math.floor(Number(other) || 0) : pick
  const valid = amount >= 10 && amount <= points
  const pct = Math.min(100, Math.round((cause.raisedPoints / cause.goalPoints) * 100))

  const give = async () => {
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      const d = await apiJson<{ raisedPoints: number; units: number; points: number; lifetimePoints: number }>(`/api/causes/${cause.id}/donate`, { method: 'POST', body: { points: amount } })
      hapticRewardRedeemed()
      applyBalances(d)
      onDonated({ ...cause, raisedPoints: d.raisedPoints, units: d.units })
      setThanks(t('m.rw.donateThanks', { n: n(amount), town: townName }))
      setOpen(false)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <article className="rw-give">
        <div className="rw-give-img" style={cause.imageUrl ? { backgroundImage: `url(${cause.imageUrl})` } : undefined}>
          <h3>{cause.title}</h3>
        </div>
        <div className="rw-give-body">
          <p>{cause.body}</p>
          <p style={{ marginTop: '10px', fontWeight: 700, color: 'var(--label-primary)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <Icon name="heart" size={16} style={{ color: 'var(--rum-text)', flexShrink: 0, marginTop: '2px' }} />
            {t('m.rw.unitLine', { n: n(cause.unitPoints), label: cause.unitLabel })}
          </p>
          <div className="rw-give-bar" role="progressbar" aria-valuemin={0} aria-valuemax={cause.goalPoints} aria-valuenow={cause.raisedPoints} aria-label={t('m.rw.raised', { raised: n(cause.raisedPoints), goal: n(cause.goalPoints) })}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="num-font" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--label-secondary)' }}>
            <span style={{ fontWeight: 700, color: 'var(--label-primary)' }}>{t('m.rw.raised', { raised: n(cause.raisedPoints), goal: n(cause.goalPoints) })}</span>
            <span>{t('m.rw.unitsDone', { n: n(cause.units), donors: n(cause.donors) })}</span>
          </div>
          {thanks && <p role="status" style={{ marginTop: '10px', color: 'var(--success)', fontWeight: 700 }}>{thanks}</p>}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: '14px' }} disabled={!signedIn || points < 10} onClick={() => { triggerHaptic('light'); setError(null); setThanks(null); setOpen(true) }}>
            <Icon name="heart" size={16} /> {t('m.rw.donate')}
          </button>
        </div>
      </article>

      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <div className={`bottom-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.rw.donateTitle')}>
        <div className="sheet-grabber" />
        {open && (
          <div style={{ padding: '0 20px 20px' }}>
            <p className="section-eyebrow">{t('m.rw.giveBack')}</p>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--label-primary)', margin: '2px 0 4px' }}>{t('m.rw.donateTitle')}</h3>
            <p className="num-font" style={{ fontSize: '14px', color: 'var(--label-secondary)' }}>{t('m.rw.donateNeed', { n: n(points) })}</p>
            <div className="rw-picks" role="group" aria-label={t('m.rw.donateTitle')}>
              {DONATE_PICKS.map(p => (
                <button key={p} type="button" className="rw-pick num-font" aria-pressed={pick === p} disabled={p > points} onClick={() => { triggerHaptic('selection'); setPick(p) }} style={{ opacity: p > points ? 0.4 : 1 }}>{n(p)}</button>
              ))}
              <button type="button" className="rw-pick" aria-pressed={pick === 'other'} onClick={() => { triggerHaptic('selection'); setPick('other') }} style={{ fontSize: '14px' }}>{t('m.rw.other')}</button>
            </div>
            {pick === 'other' && (
              <input inputMode="numeric" pattern="[0-9]*" autoFocus value={other} onChange={e => setOther(e.target.value.replace(/\D/g, '').slice(0, 7))} placeholder="750" aria-label={t('m.rw.otherLabel')} className="field num-font" style={{ marginTop: 0, marginBottom: '12px' }} />
            )}
            {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{error}</p>}
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: '8px' }} disabled={!valid || busy} onClick={give}>{t('m.rw.donateConfirm', { n: n(Math.max(0, amount)) })}</button>
            <button className="btn btn-tertiary" style={{ width: '100%' }} onClick={() => setOpen(false)}>{t('m.book.cancel')}</button>
          </div>
        )}
      </div>
    </>
  )
}
