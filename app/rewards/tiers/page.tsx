// app/rewards/tiers/page.tsx — Tiers & Earning (docs/mockups/RewardsTiers.dc.html):
// the lifetime status ladder (Visitor, Explorer, Insider, Yaadie) with each
// tier's perks — reached ones ticked, yours highlighted with your progress
// to the next, the next one locked — then How To Earn (straight from
// lib/earn-config.ts), the rules, and your birthday for double points.
'use client'

import { useEffect, useState } from 'react'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import RewardsTop from '@/components/rewards/RewardsTop'
import { apiJson } from '@/lib/api-client'
import { USER_EVENT, getCurrentUser, setCurrentUser, type CurrentUser } from '@/lib/auth-client'
import { refreshMe } from '@/lib/rewards-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { hapticSaved, triggerHaptic } from '@/lib/haptics'
import { REWARD_TIERS, getTierForPoints, tierIndex, tierProgress } from '@/lib/rewardTiers'
import { EARN, EARN_TABLE } from '@/lib/earn-config'
import type { DictKey } from '@/lib/i18n'

const RULES = 8

export default function TiersPage() {
  const { t, lang } = useLang()
  const labels = useLabels()
  const errorText = useErrorText()
  const locale = lang === 'en' ? 'en-US' : lang
  const n = (x: number) => x.toLocaleString(locale)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    setUser(getCurrentUser())
    refreshMe().then(u => { if (u) setUser(u) })
    const read = () => setUser(getCurrentUser())
    window.addEventListener(USER_EVENT, read)
    return () => window.removeEventListener(USER_EVENT, read)
  }, [])

  const lifetime = user?.lifetimePoints ?? 0
  const current = getTierForPoints(lifetime)
  const { percent } = tierProgress(lifetime)
  const at = tierIndex(current.key)

  const monthName = (m: number) => new Date(Date.UTC(2000, m - 1, 1)).toLocaleDateString(locale, { month: 'long', timeZone: 'UTC' })
  const birthdayText = (b: string) => new Date(Date.UTC(2000, Number(b.slice(0, 2)) - 1, Number(b.slice(3, 5)))).toLocaleDateString(locale, { month: 'long', day: 'numeric', timeZone: 'UTC' })

  const saveBirthday = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!month || !day) return
    setSaving(true)
    setMsg(null)
    try {
      const birthday = `${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const d = await apiJson<{ user: CurrentUser }>('/api/users/me', { method: 'PUT', body: { birthday } })
      setCurrentUser(d.user)
      setUser(d.user)
      hapticSaved()
      setMsg({ ok: true, text: t('m.rw.birthdaySet', { date: birthdayText(birthday) }) })
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) })
    } finally {
      setSaving(false)
    }
  }

  const prog = tierProgress(lifetime)
  const check = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5 9-10" /></svg>
  const star = <svg width="14" height="14" viewBox="0 0 24 24" fill="#7A1408" aria-hidden><path d="M12 2l2.9 6.3L22 9.2l-5.2 4.7 1.5 7.1L12 17.3 5.7 21l1.5-7.1L2 9.2l7.1-.9z" /></svg>
  const lock = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E0A100" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>

  return (
    <main className="rw">
      <RewardsTop title={t('m.rw.tiersEarning')} />
      <div className="rh-pad content-fade-in" style={{ paddingTop: '10px' }}>
        {/* The ladder */}
        <section aria-label={t('m.rw.yourTiers')}>
          <p className="rh-eb">{t('m.rw.lifetimeStatus')}</p>
          <h2 className="rh-st">{t('m.rw.yourTiers')}</h2>
          <p className="rh-sub" style={{ margin: '6px 0 14px', fontSize: '14px', lineHeight: 1.45 }}>{t('m.rw.ladderIntro')}</p>
          <div className="rh-ladder list-in">
            {REWARD_TIERS.map((tier, i) => {
              const isCurrent = i === (user ? at : 0)
              const reached = i < (user ? at : 0)
              const locked = !reached && !isCurrent
              return (
                <div key={tier.key} className={`rh-tier-card ${isCurrent ? 'current' : ''} ${locked ? 'locked' : ''}`}>
                  <span className="rh-dot" style={isCurrent ? { background: '#FFD54A', boxShadow: '0 0 0 4px rgba(255,213,74,0.3)' } : locked ? { background: 'var(--system-bg-elevated)', border: '2px solid #E0A100' } : { background: '#B82010' }}>
                    {isCurrent ? star : locked ? lock : check}
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '17px', fontWeight: 800 }}>
                      {labels.tier(tier.key)}
                      {isCurrent && <span style={{ marginLeft: '6px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.2)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', verticalAlign: '2px' }}>{t('m.rw.youTag')}</span>}
                    </span>
                    <span className={`num ${isCurrent ? '' : 'rh-sub'}`} style={{ fontSize: '13px', color: isCurrent ? 'rgba(255,255,255,0.8)' : undefined }}>{n(tier.threshold)}</span>
                  </div>
                  <ul className="rh-perks" style={isCurrent ? { color: 'rgba(255,255,255,0.95)' } : undefined}>
                    {Array.from({ length: tier.perks }, (_, k) => <li key={k}>{t(`m.rw.perk.${tier.key}.${k}` as DictKey)}</li>)}
                  </ul>
                  {isCurrent && prog.next && (
                    <>
                      <div style={{ marginTop: '12px', height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}><div style={{ width: `${percent}%`, height: '100%', borderRadius: '999px', background: '#FFD54A' }} /></div>
                      <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
                        <span className="num">{n(lifetime)}</span> / {n(prog.next.threshold)} · <span className="num">{n(prog.pointsToNext)}</span> {t('m.rw.toTier', { n: '', tier: labels.tier(prog.next.key) }).trim()}
                      </p>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* How to earn */}
        <section className="rh-sec" aria-label={t('m.rw.howToEarnTitle')}>
          <p className="rh-eb">{t('m.rw.pointsEyebrow')}</p>
          <h2 className="rh-st" style={{ marginBottom: '12px' }}>{t('m.rw.howToEarnTitle')}</h2>
          <div className="rh-card" style={{ padding: '4px 14px' }}>
            {EARN_TABLE.map(row => (
              <div key={row.key} className="rh-erow">
                <span>{t(`m.rw.earn.${row.key}` as DictKey)}</span>
                <b className="num">{row.per === 'dollar' ? t('m.rw.perDollarShort', { n: row.points }) : t('m.rw.ptsPlus', { n: row.points })}</b>
              </div>
            ))}
          </div>
          <p className="rh-sub" style={{ margin: '10px 4px 0', fontSize: '12px', lineHeight: 1.45 }}>{t('m.rw.earnNote')}</p>
        </section>

        {/* Rules */}
        <div className="rh-rules" style={{ marginTop: '20px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B82010" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: '0 0 auto' }}><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /></svg>
          <p>{t('m.rw.rulesShort')}</p>
        </div>

        {/* Birthday (Explorer perk) */}
        {user && (
          <section className="rh-sec" aria-label={t('m.rw.birthday')}>
            <form onSubmit={saveBirthday} className="rh-card rh-link" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="rw-card-ic gold" style={{ marginBottom: 0 }} aria-hidden><Icon name="gift" size={20} /></span>
                <span style={{ fontSize: '16px', fontWeight: 800 }}>{t('m.rw.birthday')}</span>
              </span>
              <span style={{ fontSize: '13px', color: 'var(--label-secondary)', margin: '8px 0 10px' }}>{t('m.rw.birthdaySub')}</span>
              {user.birthday ? (
                <span style={{ fontWeight: 700, color: 'var(--rum-text)' }}>{t('m.rw.birthdaySet', { date: birthdayText(user.birthday) })}</span>
              ) : (
                <span style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <select aria-label={t('m.rw.month')} value={month} onChange={e => { triggerHaptic('selection'); setMonth(e.target.value) }} className="field" style={{ flex: '2 1 140px', marginTop: 0 }}>
                    <option value="">{t('m.rw.month')}</option>
                    {Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i + 1)}>{monthName(i + 1)}</option>)}
                  </select>
                  <select aria-label={t('m.rw.day')} value={day} onChange={e => { triggerHaptic('selection'); setDay(e.target.value) }} className="field num-font" style={{ flex: '1 1 80px', marginTop: 0 }}>
                    <option value="">{t('m.rw.day')}</option>
                    {Array.from({ length: 31 }, (_, i) => <option key={i} value={String(i + 1)}>{i + 1}</option>)}
                  </select>
                  <button type="submit" className="btn btn-primary" disabled={!month || !day || saving} style={{ flex: '1 1 90px' }}>{t('m.rw.save')}</button>
                </span>
              )}
              {msg && <span role="status" style={{ fontSize: '13px', marginTop: '8px', color: msg.ok ? 'var(--success)' : 'var(--error)' }}>{msg.text}</span>}
            </form>
          </section>
        )}

        <p className="rh-sub" style={{ margin: '20px 4px 0', fontSize: '12px', textAlign: 'center' }}>{t('m.rw.footer')}</p>
      </div>
      <Dock />
    </main>
  )
}
