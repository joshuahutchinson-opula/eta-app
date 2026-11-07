// app/rewards/mine/page.tsx — My Rewards: active vouchers first (each with
// its expiry; tap for the QR the vendor scans to confirm — high-value ones
// rotate), then used and expired ones. Below: a partner property code.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import ErrorState from '@/components/ErrorState'
import RewardsTop from '@/components/rewards/RewardsTop'
import VoucherSheet, { useExpiresIn, voucherStatus, type Voucher } from '@/components/rewards/VoucherSheet'
import { apiJson } from '@/lib/api-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { hapticSaved, triggerHaptic } from '@/lib/haptics'
import { useRegion } from '@/components/RegionProvider'
import { isCityCode } from '@/lib/regions'

export default function MyRewards() {
  const { t, lang } = useLang()
  const errorText = useErrorText()
  const expiresIn = useExpiresIn()
  const { setCity } = useRegion()
  const locale = lang === 'en' ? 'en-US' : lang
  const [rows, setRows] = useState<Voucher[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<Voucher | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    setFailed(false)
    try { setRows(await apiJson<Voucher[]>('/api/rewards/redemptions')) } catch { setFailed(true) }
  }, [])
  useEffect(() => {
    load()
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [load])

  const applyPartnerCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    try {
      const joined = await apiJson<{ property: { name: string; city: string }; redemption: Voucher | null }>(`/api/partners/${encodeURIComponent(code.trim())}`, { method: 'POST' })
      if (isCityCode(joined.property.city)) setCity(joined.property.city)
      hapticSaved()
      setCode('')
      setMsg({ ok: true, text: joined.redemption ? t('m.partner.perkAdded', { name: joined.property.name }) : t('m.partner.linked', { name: joined.property.name }) })
      load()
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) })
    }
  }

  const active = (rows ?? []).filter(r => voucherStatus(r, now) === 'ACTIVE')
  const past = (rows ?? []).filter(r => voucherStatus(r, now) !== 'ACTIVE')
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' })

  const row = (r: Voucher, i: number, list: Voucher[]) => {
    const status = voucherStatus(r, now)
    return (
      <button key={r.id} onClick={() => { triggerHaptic('light'); setOpen(r) }} aria-label={t('m.rewards.showVoucher', { name: r.rewardName })}
        style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: i < list.length - 1 ? '0.5px solid var(--separator)' : 'none', opacity: status === 'ACTIVE' ? 1 : 0.6, minHeight: '64px' }}>
        <span className={`rw-hist-ic ${status === 'ACTIVE' ? '' : 'minus'}`} aria-hidden><Icon name={status === 'USED' ? 'check' : r.rotatingQr ? 'qr' : 'gift'} size={18} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)', textDecoration: status === 'USED' ? 'line-through' : undefined }}>{r.rewardName}</span>
          <span className="num-font" style={{ display: 'block', fontSize: '13px', color: status === 'ACTIVE' ? 'var(--warning)' : 'var(--label-secondary)', marginTop: '2px' }}>
            {status === 'ACTIVE' ? expiresIn(r.expiresAt, now) ?? r.code : status === 'USED' && r.usedAt ? t('m.rewards.usedOn', { date: shortDate(r.usedAt) }) : t(`m.rewards.status.${status}` as 'm.rewards.status.USED')}
          </span>
        </span>
        {status === 'ACTIVE' ? <Icon name="chevronRight" size={18} style={{ color: 'var(--label-tertiary)' }} /> : <span className="num-font" style={{ fontSize: '14px', color: 'var(--label-secondary)' }}>{r.pointCost > 0 ? `−${r.pointCost.toLocaleString(locale)}` : t('m.hub.free')}</span>}
      </button>
    )
  }

  return (
    <main className="rw">
      <RewardsTop title={t('m.rw.mine')} />
      <div className="content-fade-in">
        {failed ? <div className="rw-pad"><ErrorState onRetry={load} /></div> : rows === null ? (
          <div className="rw-pad"><div className="skeleton-card" style={{ height: '200px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div></div>
        ) : (
          <>
            <div className="section-header" style={{ padding: '0 16px' }}><div className="section-heading"><span className="section-title">{t('m.rw.active')}</span></div></div>
            {active.length === 0
              ? <div className="empty-state" style={{ padding: '24px 16px' }}><Icon name="gift" size={28} style={{ color: 'var(--label-tertiary)' }} /><p>{t('m.rw.noVouchers')}</p></div>
              : <div className="rw-hist">{active.map(row)}</div>}
            {past.length > 0 && (
              <section className="rw-section">
                <div className="section-header" style={{ padding: '0 16px' }}><div className="section-heading"><span className="section-title">{t('m.rw.past')}</span></div></div>
                <div className="rw-hist">{past.map(row)}</div>
              </section>
            )}
          </>
        )}

        <section className="rw-section">
          <div className="section-header" style={{ padding: '0 16px' }}><div className="section-heading"><span className="section-eyebrow">{t('m.partner.eyebrow')}</span><span className="section-title">{t('m.partner.title')}</span></div></div>
          <form onSubmit={applyPartnerCode} className="rw-link" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default' }}>
            <span style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '10px' }}>{t('m.partner.sub')}</span>
            <span style={{ display: 'flex', gap: '8px' }}>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder={t('m.partner.placeholder')} aria-label={t('m.partner.title')} autoCapitalize="characters" autoComplete="off" className="field num-font" style={{ flex: 1, minWidth: 0, marginTop: 0, letterSpacing: '0.06em' }} />
              <button type="submit" className="btn btn-primary" disabled={code.trim().length < 3} style={{ padding: '0 16px' }}>{t('m.partner.apply')}</button>
            </span>
            {msg && <span role="status" style={{ fontSize: '13px', marginTop: '8px', color: msg.ok ? 'var(--success)' : 'var(--error)' }}>{msg.text}</span>}
          </form>
        </section>
        <p className="rw-foot">{t('m.rw.footer')}</p>
      </div>
      <VoucherSheet voucher={open} onClose={() => setOpen(null)} />
      <Dock />
    </main>
  )
}
