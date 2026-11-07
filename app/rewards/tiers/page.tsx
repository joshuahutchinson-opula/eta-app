// app/rewards/tiers/page.tsx — Tiers & How To Earn: the status ladder
// (Visitor, Explorer, Insider, Yaadie) with every tier's perks and where you
// are on it; the earning table (straight from lib/earn-config.ts), how
// boosts stack, the rules box, and your birthday for double points.
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
  // The gold line on the ladder runs up to your position.
  const fill = `calc(${((at + percent / 100) / REWARD_TIERS.length) * 100}% - 18px)`

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

  return (
    <main className="rw">
      <RewardsTop title={t('m.rw.tiersTitle')} />
      <div className="content-fade-in">
        {/* The ladder */}
        <section aria-label={t('m.rw.ladder')}>
          <div className="section-header" style={{ padding: '0 16px' }}><div className="section-heading"><span className="section-eyebrow">{t('m.rw.status')}</span><span className="section-title">{t('m.rw.ladder')}</span></div></div>
          <p className="rw-pad" style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '14px' }}>{t('m.rw.ladderSub')}</p>
          <div className="rw-ladder">
            {user && <span className="rw-ladder-fill" style={{ height: fill }} aria-hidden />}
            {REWARD_TIERS.map((tier, i) => {
              const reached = Boolean(user) && i <= at
              const isCurrent = Boolean(user) && i === at
              return (
                <div key={tier.key} className={`rw-step ${reached ? 'reached' : 'locked'} ${isCurrent ? 'current' : ''}`}>
                  <span className="rw-step-dot" aria-hidden><Icon name={reached ? tier.icon : 'lock'} size={14} /></span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--label-primary)' }}>{labels.tier(tier.key)}</span>
                    <span className="num-font" style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{t('m.rw.ptsLifetime', { n: n(tier.threshold) })}</span>
                    {isCurrent && <span className="rw-tag" style={{ marginLeft: 'auto' }}>{t('m.rw.youreHere')}</span>}
                  </div>
                  {isCurrent && tierProgress(lifetime).next && (
                    <p className="num-font" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--rum-text)', marginTop: '4px' }}>
                      {t('m.rw.toNext', { n: n(tierProgress(lifetime).pointsToNext), tier: labels.tier(tierProgress(lifetime).next!.key) })}
                    </p>
                  )}
                  <ul>
                    {Array.from({ length: tier.perks }, (_, k) => (
                      <li key={k}><Icon name={reached ? 'check' : 'sparkle'} size={15} style={{ color: reached ? 'var(--success)' : 'var(--gold)', flexShrink: 0, marginTop: '2px' }} />{t(`m.rw.perk.${tier.key}.${k}` as DictKey)}</li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>

        {/* How to earn */}
        <section className="rw-section" aria-label={t('m.rw.howToEarn')}>
          <div className="section-header" style={{ padding: '0 16px' }}><div className="section-heading"><span className="section-eyebrow">{t('m.rw.title')}</span><span className="section-title">{t('m.rw.howToEarn')}</span></div></div>
          <div className="rw-table">
            {EARN_TABLE.map(row => (
              <div key={row.key} className="rw-table-row">
                <span>{t(`m.rw.earn.${row.key}` as DictKey)}</span>
                <b className="num-font">{row.per === 'dollar' ? t('m.rw.perDollar', { n: row.points }) : t('m.rw.ptsPlus', { n: row.points })}</b>
              </div>
            ))}
          </div>
          <p className="rw-pad" style={{ fontSize: '15px', fontWeight: 800, color: 'var(--label-primary)', margin: '20px 0 8px' }}>{t('m.rw.boostRules')}</p>
          <div className="rw-table">
            <div className="rw-table-row"><Icon name="clock" size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} /><span>{t('m.rw.boostRule.quiet')}</span></div>
            <div className="rw-table-row"><Icon name="umbrella" size={16} style={{ color: '#5AC8FA', flexShrink: 0 }} /><span>{t('m.rw.boostRule.rain')}</span></div>
            <div className="rw-table-row"><Icon name="users" size={16} style={{ color: 'var(--rum-text)', flexShrink: 0 }} /><span>{t('m.rw.boostRule.crew', { n: EARN.crewBonus })}</span></div>
            <div className="rw-table-row"><Icon name="gift" size={16} style={{ color: 'var(--rum-text)', flexShrink: 0 }} /><span>{t('m.rw.boostRule.birthday')}</span></div>
          </div>
        </section>

        {/* Rules */}
        <section className="rw-section" aria-label={t('m.rw.rules')}>
          <div className="section-header" style={{ padding: '0 16px' }}><div className="section-heading"><span className="section-title">{t('m.rw.rules')}</span></div></div>
          <div className="rw-rules">
            <ul style={{ margin: 0, paddingLeft: '18px' }}>
              {Array.from({ length: RULES }, (_, i) => <li key={i}>{t(`m.rw.rule.${i}` as DictKey)}</li>)}
            </ul>
          </div>
        </section>

        {/* Birthday (Explorer perk) */}
        {user && (
          <section className="rw-section" aria-label={t('m.rw.birthday')}>
            <form onSubmit={saveBirthday} className="rw-link" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default' }}>
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

        <p className="rw-foot">{t('m.rw.footer')}</p>
      </div>
      <Dock />
    </main>
  )
}
