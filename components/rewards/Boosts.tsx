// components/rewards/Boosts.tsx — today's boosts on the Rewards hub
// (docs/mockups/RewardsHub.dc.html): vendor quiet hours ("2× Points", Live
// Now with a bar running down to the end and a countdown, or when it
// starts), the rainy-day bonus when rain is forecast (with how many indoor
// spots there are), and the crew bonus. They stack on the base points
// (lib/boosts.ts).
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

export interface BoostView {
  id: string
  kind: 'quiet_hour' | 'rainy_day' | 'crew'
  title: string
  multiplier: number
  bonus: number
  startMin: number | null
  endMin: number | null
  live: boolean
  endsAt: string | null
  vendor: { id: string; name: string; imageUrl: string | null } | null
}

const FACES = ['#C4654F', '#2E7D8C', '#3B3F6B']

export default function Boosts({ boosts, indoorSpots = 0 }: { boosts: BoostView[]; indoorSpots?: number }) {
  const { t, lang } = useLang()
  const locale = lang === 'en' ? 'en-US' : lang
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!boosts.some(b => b.live && b.endsAt)) return
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [boosts])

  const clock = (min: number) => new Date(Date.UTC(2000, 0, 1, Math.floor(min / 60) + 5, min % 60)).toLocaleTimeString(locale, { hour: 'numeric', minute: min % 60 ? '2-digit' : undefined, timeZone: 'America/Jamaica' })
  const left = (iso: string) => {
    const m = Math.max(0, Math.round((Date.parse(iso) - now) / 60000))
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
  }
  const x = (m: number) => (Number.isInteger(m) ? String(m) : m.toFixed(1))
  const jaMin = () => { const d = new Date(now - 5 * 3600000); return d.getUTCHours() * 60 + d.getUTCMinutes() }

  if (!boosts.length) return <p style={{ fontSize: '14px', color: 'var(--label-secondary)' }}>{t('m.rw.boostNone')}</p>
  return (
    <div className="rh-scroll list-in">
      {boosts.map(b => {
        if (b.kind === 'rainy_day') {
          return (
            <Link key={b.id} href="/marketplace" onClick={() => triggerHaptic('light')} className="rh-boost rain press">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="rh-pill frost num">{t('m.rw.xPoints', { x: x(b.multiplier) })}</span>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7 15a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17.5 15z" /><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2" /></svg>
              </div>
              <p style={{ margin: '12px 0 0', fontSize: '16px', fontWeight: 700 }}>{t('m.rw.rainTitle')}</p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>{indoorSpots > 0 ? t('m.rw.rainLine', { n: indoorSpots }) : t('m.rw.boostRainSub')}</p>
              <p style={{ margin: '18px 0 0', fontSize: '13px', fontWeight: 600 }}>{t('m.rw.seeIndoor')}</p>
            </Link>
          )
        }
        if (b.kind === 'crew') {
          return (
            <div key={b.id} className="rh-boost">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="rh-pill rum num">{t('m.rw.crewEach', { n: b.bonus })}</span>
                <span className="rh-faces" aria-hidden>{FACES.map(c => <span key={c} style={{ background: c }} />)}</span>
              </div>
              <p style={{ margin: '12px 0 0', fontSize: '16px', fontWeight: 700 }}>{t('m.rw.crewTitle')}</p>
              <p className="rh-sub" style={{ margin: '2px 0 0', fontSize: '13px' }}>{t('m.rw.crewLine')}</p>
            </div>
          )
        }
        const ended = b.live && b.endsAt && Date.parse(b.endsAt) <= now
        const range = b.startMin !== null && b.endMin !== null ? `${clock(b.startMin)}–${clock(b.endMin)}` : null
        const pct = b.live && b.startMin !== null && b.endMin !== null ? Math.max(4, Math.min(100, Math.round(((b.endMin - jaMin()) / (b.endMin - b.startMin)) * 100))) : 0
        const body = (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="rh-pill gold num">{t('m.rw.xPoints', { x: x(b.multiplier) })}</span>
              {b.live && !ended && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: 'var(--rum-text)' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--rum-text)' }} />{t('m.rw.liveNow')}</span>}
            </div>
            <p style={{ margin: '12px 0 0', fontSize: '16px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.vendor?.name ?? b.title}</p>
            <p className="rh-sub" style={{ margin: '2px 0 0', fontSize: '13px' }}>{range ? t('m.rw.quietLine', { range }) : b.title}</p>
            {b.live && !ended ? (
              <>
                <div className="rh-track"><i style={{ width: `${pct}%` }} /></div>
                {b.endsAt && <p className="rh-sub" style={{ margin: '6px 0 0', fontSize: '12px' }}>{t('m.rw.endsIn', { time: left(b.endsAt) })}</p>}
              </>
            ) : b.startMin !== null && !ended ? (
              <p className="rh-sub" style={{ margin: '12px 0 0', fontSize: '12px' }}>{t('m.rw.startsAt', { time: clock(b.startMin) })}</p>
            ) : null}
          </>
        )
        return b.vendor
          ? <Link key={b.id} href={`/vendor/${b.vendor.id}`} onClick={() => triggerHaptic('light')} className="rh-boost press">{body}</Link>
          : <div key={b.id} className="rh-boost">{body}</div>
      })}
    </div>
  )
}
