// components/rewards/GiveBack.tsx — the town's Give Back card on the Rewards
// hub (lib/causes.ts; docs/mockups/RewardsHub.dc.html): the cause's photo
// with a "Give Back · <town>" tag, what each block of points covers, the
// community progress toward the goal, and the amount right on the card —
// 100 / 250 / 500 or Other — with a green Give button.
'use client'

import { useState } from 'react'
import { apiJson } from '@/lib/api-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { hapticRewardRedeemed, triggerHaptic } from '@/lib/haptics'
import { applyBalances } from '@/lib/rewards-client'
import { DONATE_PICKS } from '@/lib/earn-config'
import { withNum } from '@/components/rewards/StatusCard'

export interface CauseView {
  id: string; city: string; title: string; body: string; imageUrl: string | null
  goalPoints: number; unitPoints: number; unitLabel: string; raisedPoints: number; units: number; donors: number
}

export default function GiveBack({ cause, townName, points, signedIn, onDonated }: { cause: CauseView; townName: string; points: number; signedIn: boolean; onDonated: (c: CauseView) => void }) {
  const { t, lang } = useLang()
  const errorText = useErrorText()
  const locale = lang === 'en' ? 'en-US' : lang
  const n = (x: number) => x.toLocaleString(locale)
  const [pick, setPick] = useState<number | 'other'>(DONATE_PICKS[1] ?? DONATE_PICKS[0])
  const [other, setOther] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thanks, setThanks] = useState<string | null>(null)

  const amount = pick === 'other' ? Math.floor(Number(other) || 0) : pick
  const valid = signedIn && amount >= 10 && amount <= points
  const goalUnits = Math.max(1, Math.round(cause.goalPoints / cause.unitPoints))
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
      setOther('')
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="rh-card rh-give">
      <div className="rh-give-img" style={cause.imageUrl ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35)), url(${cause.imageUrl})` } : undefined}>
        <span className="rh-give-tag">{t('m.rw.giveBackTag', { town: townName })}</span>
      </div>
      <div style={{ padding: '14px' }}>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)' }}>{cause.title}</p>
        <p className="rh-sub" style={{ margin: '2px 0 0', fontSize: '13px', lineHeight: 1.4 }}>{cause.body} {t('m.rw.unitLine', { n: n(cause.unitPoints), label: cause.unitLabel })}</p>
        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '13px' }}>
          <span style={{ fontWeight: 600, color: 'var(--label-primary)' }}>{withNum(t('m.rw.ofGoal', { n: n(cause.units), goal: n(goalUnits) }), n(cause.units))}</span>
          <span className="rh-sub">{t('m.rw.communityGoal')}</span>
        </div>
        <div className="rh-give-bar" role="progressbar" aria-valuemin={0} aria-valuemax={cause.goalPoints} aria-valuenow={cause.raisedPoints} aria-label={t('m.rw.raised', { raised: n(cause.raisedPoints), goal: n(cause.goalPoints) })}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="rh-picks" role="group" aria-label={t('m.rw.donateTitle')}>
          {DONATE_PICKS.map(p => (
            <button key={p} type="button" aria-pressed={pick === p} disabled={!signedIn || p > points} onClick={() => { triggerHaptic('selection'); setPick(p) }} style={{ opacity: signedIn && p > points ? 0.4 : 1 }}>{n(p)}</button>
          ))}
          <button type="button" className="other" aria-pressed={pick === 'other'} disabled={!signedIn} onClick={() => { triggerHaptic('selection'); setPick('other') }}>{t('m.rw.other')}</button>
        </div>
        {pick === 'other' && (
          <input inputMode="numeric" pattern="[0-9]*" autoFocus value={other} onChange={e => setOther(e.target.value.replace(/\D/g, '').slice(0, 7))} placeholder="750" aria-label={t('m.rw.otherLabel')} className="field num" style={{ marginTop: '10px' }} />
        )}
        {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginTop: '8px' }}>{error}</p>}
        {thanks && <p role="status" className="swap-fade" style={{ fontSize: '13px', fontWeight: 700, color: '#1F6E5A', marginTop: '8px' }}>{thanks}</p>}
        <button className="rh-give-btn press" disabled={!valid || busy} onClick={() => { triggerHaptic('medium'); give() }}>
          {withNum(t('m.rw.giveN', { n: n(Math.max(0, amount)) }), n(Math.max(0, amount)))}
        </button>
      </div>
    </article>
  )
}
