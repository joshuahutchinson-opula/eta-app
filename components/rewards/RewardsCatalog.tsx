// components/rewards/RewardsCatalog.tsx — the Rewards list on the hub with
// its filter pills (All, Vendor Perks, Insider Only, Events, ETA Perks),
// as rows (docs/mockups/RewardsHub.dc.html): a coloured thumbnail, the name,
// where it's honoured, what's left today or the tier it needs, and the
// points cost as the button. Redeeming spends points (after a confirm) and
// opens the single-use voucher straight away.
'use client'

import { useState } from 'react'
import Icon from '@/lib/icons'
import { apiJson } from '@/lib/api-client'
import { useErrorText, useLang, usePatois } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { hapticRewardRedeemed, triggerHaptic } from '@/lib/haptics'
import { atLeast, type TierKey } from '@/lib/rewardTiers'
import { applyBalances } from '@/lib/rewards-client'
import { REWARD_FILTERS, type RewardItem } from '@/lib/rewards'
import type { DictKey } from '@/lib/i18n'
import VoucherSheet, { type Voucher } from '@/components/rewards/VoucherSheet'

type Filter = (typeof REWARD_FILTERS)[number]

/** Each kind of reward gets its own colour on the thumbnail. */
const THUMB: Record<string, string> = { vendor: '#C4654F', insider: '#3B3F6B', events: '#7A1408', eta: '#2E7D8C' }

export default function RewardsCatalog({ rewards, points, lifetimePoints, signedIn, onRedeemed }: {
  rewards: RewardItem[] | null
  points: number
  lifetimePoints: number
  signedIn: boolean
  onRedeemed: () => void
}) {
  const { t, lang } = useLang()
  const patois = usePatois()
  const errorText = useErrorText()
  const labels = useLabels()
  const locale = lang === 'en' ? 'en-US' : lang
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<RewardItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voucher, setVoucher] = useState<Voucher | null>(null)

  const shown = (rewards ?? []).filter(r => filter === 'all' || (r.category ?? 'eta') === filter)

  const redeem = async () => {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      const d = await apiJson<{ redemption: Voucher; points: number; lifetimePoints: number }>('/api/rewards/redeem', { method: 'POST', body: { rewardId: selected.id } })
      hapticRewardRedeemed()
      applyBalances(d)
      setSelected(null)
      setVoucher(d.redemption)
      onRedeemed()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="rh-pills" role="tablist" aria-label={t('m.rw.rewards')}>
        {REWARD_FILTERS.map(f => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => { triggerHaptic('selection'); setFilter(f) }}>
            {t(`m.rw.filter.${f}` as DictKey)}
          </button>
        ))}
      </div>

      {rewards === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>{[0, 1, 2].map(i => <div key={i} className="skeleton-card" style={{ height: '84px', borderRadius: '18px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>)}</div>
      ) : shown.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginTop: '12px' }}>{t('m.rw.empty')}</p>
      ) : (
        <div key={filter} className="list-in" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
          {shown.map(r => {
            const tierOk = !r.minTier || atLeast(lifetimePoints, r.minTier as TierKey)
            const out = r.left ? r.left.today <= 0 || r.left.month <= 0 : false
            const can = signedIn && tierOk && !r.locked && !out && points >= r.cost
            const cat = r.category ?? 'eta'
            const where = r.vendors && r.vendors.length ? r.vendors.map(v => v.name).join(', ') : r.description
            const gold = Boolean(r.minTier) || cat === 'insider'
            const note = r.locked ? t('m.rewards.visitToUnlock')
              : !tierOk && r.minTier ? t('m.rw.tierOnly', { tier: labels.tier(r.minTier) })
              : out ? t('m.rw.soldOut')
              : r.minTier ? `${t('m.rw.tierOnly', { tier: labels.tier(r.minTier) })}${r.left ? ` · ${t('m.rw.leftToday', { n: r.left.today })}` : ''}`
              : r.left ? t('m.rw.leftToday', { n: r.left.today }) : null
            return (
              <article key={r.id} className="rh-card rh-reward" style={can || !signedIn ? undefined : { opacity: 0.75 }}>
                <span className="rh-thumb" style={{ background: THUMB[cat] ?? THUMB.eta }} aria-hidden><Icon name={r.locked || !tierOk ? 'lock' : r.icon} size={24} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>{r.name}</p>
                  <p className="rh-sub" style={{ margin: '2px 0 0', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{where}</p>
                  {note && <p className={gold ? 'rh-gold-note' : 'rh-sub'} style={{ margin: '5px 0 0', fontSize: '12px', fontWeight: 600 }}>{note}</p>}
                </div>
                <button className="rh-cost press" disabled={signedIn && !can} aria-label={t('m.rw.redeemFor', { n: r.cost.toLocaleString(locale) })} onClick={() => { triggerHaptic('light'); setError(null); setSelected(r) }}>
                  <span className="num">{r.cost.toLocaleString(locale)}</span>
                </button>
              </article>
            )
          })}
        </div>
      )}

      {/* Confirm */}
      <div className={`bottom-sheet-overlay ${selected ? 'open' : ''}`} onClick={() => setSelected(null)} />
      <div className={`bottom-sheet ${selected ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.rewards.confirm')}>
        <div className="sheet-grabber" />
        {selected && (
          <div style={{ padding: '0 20px 20px' }}>
            <div className="rw-card-ic" style={{ width: '56px', height: '56px', borderRadius: '16px', margin: '0 auto 14px', display: 'flex' }}><Icon name={selected.icon} size={26} /></div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--label-primary)', textAlign: 'center', marginBottom: '4px' }}>{selected.name}</h3>
            <p style={{ fontSize: '15px', color: 'var(--label-secondary)', textAlign: 'center', marginBottom: '16px' }}>{selected.description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>{t('m.rewards.cost')}</span>
              <span className="num-font" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>{t('m.rewards.ptsShort', { n: selected.cost.toLocaleString(locale) })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>{t('m.rewards.balanceAfter')}</span>
              <span className="num-font" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>{t('m.rewards.ptsShort', { n: (points - selected.cost).toLocaleString(locale) })}</span>
            </div>
            {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px', textAlign: 'center' }}>{error}</p>}
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: '8px' }} onClick={redeem} disabled={busy}>{busy ? patois.loadingRedeem : t('m.rewards.confirm')}</button>
            <button className="btn btn-tertiary" style={{ width: '100%' }} onClick={() => setSelected(null)}>{t('m.book.cancel')}</button>
          </div>
        )}
      </div>

      <VoucherSheet voucher={voucher} onClose={() => setVoucher(null)} />
    </>
  )
}
