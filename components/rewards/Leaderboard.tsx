// components/rewards/Leaderboard.tsx — this month's leaderboard for the town
// (lib/leaderboard.ts). Opt-in: a switch, off by default; names are first
// name + initial. Shows the top places and your own rank.
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

  return (
    <div className="rw-board">
      {board.rows.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--label-secondary)', padding: '14px 0' }}>{t('m.rw.boardEmpty')}</p>
      ) : board.rows.map(r => (
        <div key={r.rank} className={`rw-board-row ${r.me ? 'me' : ''}`}>
          <span className={`rw-rank num-font ${r.rank <= 3 ? `r${r.rank}` : ''}`}>{r.rank}</span>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}{r.me ? ` · ${t('m.rw.you')}` : ''}</span>
          <span className="num-font" style={{ color: 'var(--label-secondary)', fontWeight: 700 }}>{t('m.rewards.ptsShort', { n: n(r.points) })}</span>
        </div>
      ))}
      {signedIn && board.mine && (
        <p className="num-font" style={{ padding: '12px 0', borderTop: '0.5px solid var(--separator)', fontSize: '14px', fontWeight: 700, color: 'var(--rum-text)' }}>
          {board.mine.rank ? t('m.rw.yourRank', { n: board.mine.rank, town: townName }) : board.mine.points > 0 ? t('m.rw.yourRankHidden', { n: n(board.mine.points) }) : t('m.rw.yourRankNone', { town: townName })}
        </p>
      )}
      {signedIn && (
        <button role="switch" aria-checked={on} onClick={toggle} disabled={busy} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', background: 'none', border: 'none', borderTop: '0.5px solid var(--separator)', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', minHeight: '44px' }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>{t('m.rw.boardJoin')}</span>
            <span style={{ display: 'block', fontSize: '12px', color: 'var(--label-secondary)', marginTop: '2px' }}>{t('m.rw.boardSub')}</span>
          </span>
          <span className={`rw-switch ${on ? 'on' : ''}`} aria-hidden />
        </button>
      )}
    </div>
  )
}
