// components/rewards/VoucherSheet.tsx — one voucher, full of QR, for the
// vendor to scan and confirm. Single use. High-value rewards (rotatingQr)
// show a live QR that changes every 30 s (lib/vouchers.ts), fetched from
// /api/rewards/redemptions/:code/qr, so screenshots don't work; the sheet
// counts down to the next change.
'use client'

import { useEffect, useState } from 'react'
import QRCode from '@/components/QRCode'
import Icon from '@/lib/icons'
import { apiJson } from '@/lib/api-client'
import { useLang } from '@/lib/i18n-client'

export interface Voucher {
  id: string
  rewardName: string
  pointCost: number
  code: string
  status: 'ACTIVE' | 'USED' | 'EXPIRED'
  expiresAt: string | null
  usedAt: string | null
  createdAt: string
  rotatingQr?: boolean
}

export function voucherStatus(v: Voucher, now = Date.now()): Voucher['status'] {
  return v.status === 'ACTIVE' && v.expiresAt && Date.parse(v.expiresAt) <= now ? 'EXPIRED' : v.status
}

export function useExpiresIn() {
  const { t } = useLang()
  return (iso: string | null, now = Date.now()) => {
    if (!iso) return null
    const ms = Date.parse(iso) - now
    if (ms <= 0) return null
    const days = Math.floor(ms / 86400000)
    if (days >= 1) return t('m.rewards.expiresIn', { time: t('m.rewards.expiresDays', { n: days }) })
    const mins = Math.floor(ms / 60000)
    return t('m.rewards.expiresIn', { time: t('m.rewards.expiresHours', { h: Math.floor(mins / 60), m: mins % 60 }) })
  }
}

export default function VoucherSheet({ voucher, onClose }: { voucher: Voucher | null; onClose: () => void }) {
  const { t, lang } = useLang()
  const expiresIn = useExpiresIn()
  const [qr, setQr] = useState<{ value: string; refreshAt: number | null } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const status = voucher ? voucherStatus(voucher, now) : 'ACTIVE'
  const live = Boolean(voucher?.rotatingQr && status === 'ACTIVE')

  // Live QR: fetch now, then again whenever it's about to change.
  useEffect(() => {
    setQr(null)
    if (!voucher || !live) return
    let timer: ReturnType<typeof setTimeout>
    let stop = false
    const load = async () => {
      try {
        const d = await apiJson<{ value: string; refreshAt: number | null }>(`/api/rewards/redemptions/${encodeURIComponent(voucher.code)}/qr`)
        if (stop) return
        setQr(d)
        if (d.refreshAt) timer = setTimeout(load, Math.max(1000, d.refreshAt - Date.now() + 250))
      } catch {
        if (!stop) timer = setTimeout(load, 5000)
      }
    }
    load()
    return () => { stop = true; clearTimeout(timer) }
  }, [voucher, live])

  useEffect(() => {
    if (!voucher) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [voucher])

  const value = live ? qr?.value ?? null : voucher?.code ?? null
  const secs = qr?.refreshAt ? Math.max(0, Math.ceil((qr.refreshAt - now) / 1000)) : null
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : lang, { month: 'short', day: 'numeric' })

  return (
    <>
      <div className={`bottom-sheet-overlay ${voucher ? 'open' : ''}`} onClick={onClose} />
      <div className={`bottom-sheet ${voucher ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.rewards.voucher')}>
        <div className="sheet-grabber" />
        {voucher && (
          <div style={{ padding: '0 20px 24px', textAlign: 'center' }}>
            <p className="section-eyebrow">{t('m.rewards.voucher')}</p>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--label-primary)', margin: '2px 0 12px' }}>{voucher.rewardName}</h3>
            <div style={{ opacity: status === 'ACTIVE' ? 1 : 0.35, minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {value ? <QRCode value={value} size={200} /> : <div className="skeleton-card" style={{ width: '200px', height: '200px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>}
            </div>
            {live && (
              <p role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '13px', fontWeight: 700, color: 'var(--rum-text)' }}>
                <span className="rw-live-dot" aria-hidden /> {t('m.rw.liveCode', { n: secs ?? 30 })}
              </p>
            )}
            <p className="num-font" style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--label-primary)', marginTop: '10px', textDecoration: status === 'USED' ? 'line-through' : undefined }}>{voucher.code}</p>
            <p role="status" style={{ fontSize: '14px', fontWeight: 700, margin: '6px 0 4px', color: status === 'ACTIVE' ? 'var(--warning)' : status === 'USED' ? 'var(--success)' : 'var(--error)' }}>
              {status === 'ACTIVE' ? expiresIn(voucher.expiresAt, now) : status === 'USED' && voucher.usedAt ? t('m.rewards.usedOn', { date: shortDate(voucher.usedAt) }) : t(`m.rewards.status.${status}` as 'm.rewards.status.USED')}
            </p>
            {status === 'ACTIVE' && (
              <p style={{ fontSize: '13px', color: 'var(--label-secondary)', margin: '0 0 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="shield" size={13} /> {live ? t('m.rw.liveCodeSub') : t('m.rewards.showVendor')}
              </p>
            )}
            <button className="btn btn-tertiary" onClick={onClose} style={{ width: '100%', marginTop: '8px' }}>{t('m.profile.done')}</button>
          </div>
        )}
      </div>
    </>
  )
}
