// components/rewards/Leaderboard.tsx — this month's leaderboard for the town
// (lib/leaderboard.ts; docs/mockups/RewardsHub.dc.html): the top places,
// then your own row highlighted. Opt-in with the switch under it, off by
// default; names are first name + initial.
'use client'

import { useState } from 'react'
import { apiJson } from '@/lib/api-client'
import { setCurrentUser, type CurrentUser } from '@/lib/auth-client'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

export interface Board { month: string; city: string; rows: Array<{ rank: number; name: string; points: number; me: boolean }>; mine: { rank: number | null; points: number } | null }

export default function Leaderboard({ board, optedIn, townName, signedIn, onChange }: { board: Board; optedIn: boolean; townName: string; signedIn: boolean; onChange: () => void }) {
  const { t, lang } = useLang()
  const [on, setOn] = useState(optedIn)
  const [busy, setBusy] = useState(false)
  const n = (x: number) => x.toLocaleString(lang === 'en' ? 'en-US' : lang)

  const toggle = async () => {
    if (!signedIn || busy) return
    setBusy(true)
    triggerHaptic('selection')
    const next = !on
    setOn(next)
    try {
      const { user } = await apiJson<{ user: CurrentUser }>('/api/users/me', { method: 'PUT', body: { leaderboardOptIn: next } })
      setCurrentUser(user)
      onChange()
    } catch {
      setOn(!next)
    } finally {
      setBusy(false)
    }
  }

  const tones = ['#C4654F', '#2E7D8C', '#3B3F6B', '#B82010', '#2E8C6E', '#C98A2B']
  const tone = (name: string) => tones[name.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % tones.length]
  const meRow = board.rows.find(r => r.me)
  const rows = board.rows.filter(r => !r.me).slice(0, meRow ? 2 : 3)

  return (
    <>
      <div className="rh-card" style={{ padding: '6px 14px' }}>
        {board.rows.length === 0 ? (
          <p className="rh-sub" style={{ fontSize: '14px', padding: '12px 0' }}>{t('m.rw.boardEmpty')}</p>
        ) : (
          <div className="list-in">
            {rows.map(r => (
              <div key={r.rank} className="rh-row">
                <span className="num" style={{ width: '24px', color: r.rank === 1 ? '#E0A100' : 'var(--label-secondary)' }}>{r.rank}</span>
                <span className="rh-av" style={{ background: tone(r.name) }} aria-hidden>{r.name.charAt(0)}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <span className="num" style={{ fontSize: '14px', color: 'var(--label-primary)' }}>{n(r.points)}</span>
              </div>
            ))}
            {meRow ? (
              <div className="rh-row me">
                <span className="num" style={{ width: '24px', color: 'var(--rum-text)' }}>{meRow.rank}</span>
                <span className="rh-av" style={{ background: '#3B3F6B' }} aria-hidden>{meRow.name.charAt(0)}</span>
                <span style={{ flex: 1, fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>{t('m.rw.youTag')}</span>
                <span className="num" style={{ fontSize: '14px', color: 'var(--label-primary)' }}>{n(meRow.points)}</span>
              </div>
            ) : signedIn && board.mine ? (
              <p className="num" style={{ padding: '12px 0', fontSize: '13px', fontWeight: 700, color: 'var(--rum-text)' }}>
                {board.mine.rank ? t('m.rw.yourRank', { n: board.mine.rank, town: townName }) : board.mine.points > 0 ? t('m.rw.yourRankHidden', { n: n(board.mine.points) }) : t('m.rw.yourRankNone', { town: townName })}
              </p>
            ) : null}
          </div>
        )}
      </div>
      {signedIn && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', padding: '0 4px' }}>
          <span className="rh-sub" style={{ flex: 1, fontSize: '13px' }}>{t('m.rw.boardJoin')}</span>
          <button role="switch" aria-checked={on} aria-label={t('m.rw.boardJoin')} className="rh-switch" onClick={toggle} disabled={busy} />
        </div>
      )}
    </>
  )
}
