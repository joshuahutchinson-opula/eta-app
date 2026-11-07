// app/rewards/history/page.tsx — points history: every ledger entry
// (lib/points-ledger.ts), earns and spends, with its reason, the vendor and
// when. Newest first, 40 at a time.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import ErrorState from '@/components/ErrorState'
import RewardsTop from '@/components/rewards/RewardsTop'
import { apiJson } from '@/lib/api-client'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'
import type { DictKey } from '@/lib/i18n'

interface Row { id: string; points: number; kind: string; reason: string; sourceType: string | null; vendor: string | null; city: string | null; at: string }

const ICON: Record<string, string> = {
  qr_first_visit: 'qr', qr_repeat_visit: 'qr', payment: 'card', booking: 'calendar', ticket: 'ticket', review: 'star', story_tag: 'instagram',
  secret_spot: 'sparkle', gem_verified: 'sparkle', quest_complete: 'flag', quest_checkpoint: 'flag', streak3: 'flame', referral: 'users',
  crew_bonus: 'users', photo_spot: 'camera', challenge: 'flame', boost_quiet_hour: 'clock', boost_rainy_day: 'umbrella', birthday: 'gift',
  redeem: 'gift', donate: 'heart'
}

export default function PointsHistory() {
  const { t, lang } = useLang()
  const locale = lang === 'en' ? 'en-US' : lang
  const [rows, setRows] = useState<Row[] | null>(null)
  const [more, setMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async (before?: string) => {
    setFailed(false)
    try {
      const d = await apiJson<{ rows: Row[]; more: boolean }>(`/api/rewards/history${before ? `?before=${encodeURIComponent(before)}` : ''}`)
      setRows(prev => before && prev ? [...prev, ...d.rows] : d.rows)
      setMore(d.more)
    } catch {
      setFailed(true)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const when = (iso: string) => new Date(iso).toLocaleString(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Jamaica' })
  const label = (reason: string) => { const k = `m.rw.reason.${reason}` as DictKey; const s = t(k); return s === k ? reason : s }

  return (
    <main className="rw">
      <RewardsTop title={t('m.rw.historyTitle')} />
      <div className="content-fade-in">
        {failed && !rows ? <div className="rw-pad"><ErrorState onRetry={() => load()} /></div> : rows === null ? (
          <div className="rw-pad"><div className="skeleton-card" style={{ height: '320px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div></div>
        ) : rows.length === 0 ? (
          <div className="empty-state" style={{ minHeight: '50vh' }}><Icon name="receipt" size={28} style={{ color: 'var(--label-tertiary)' }} /><p>{t('m.rw.historyEmpty')}</p></div>
        ) : (
          <>
            <ul className="rw-hist" style={{ listStyle: 'none', padding: 0 }}>
              {rows.map(r => {
                const minus = r.points < 0
                return (
                  <li key={r.id} className="rw-hist-row">
                    <span className={`rw-hist-ic ${minus ? 'minus' : ''}`} aria-hidden><Icon name={ICON[r.reason] ?? 'star'} size={16} /></span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>{label(r.reason)}</span>
                      <span style={{ display: 'block', fontSize: '12px', color: 'var(--label-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[r.vendor, when(r.at)].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={`rw-hist-pts num-font ${minus ? 'minus' : ''}`}>{minus ? '−' : '+'}{Math.abs(r.points).toLocaleString(locale)}</span>
                  </li>
                )
              })}
            </ul>
            {more && (
              <div className="rw-pad" style={{ marginTop: '12px' }}>
                <button className="btn btn-secondary" style={{ width: '100%' }} disabled={loadingMore} onClick={async () => { triggerHaptic('light'); setLoadingMore(true); await load(rows[rows.length - 1].at); setLoadingMore(false) }}>{t('m.rw.loadMore')}</button>
              </div>
            )}
          </>
        )}
        <p className="rw-foot">{t('m.rw.footer')}</p>
      </div>
      <Dock />
    </main>
  )
}
