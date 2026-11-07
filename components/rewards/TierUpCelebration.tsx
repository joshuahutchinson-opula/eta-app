// components/rewards/TierUpCelebration.tsx — the full-screen tier-up moment.
// Mounted once in the root layout. Whenever the cached user changes (any
// earn: a scan, a payment, a review…), it compares the tier from LIFETIME
// points with the highest tier already celebrated (User.tierSeen); when it's
// higher, it takes over the screen with the new status, its perks, a burst
// of confetti and a haptic flourish. "Keep exploring" records it as seen
// (POST /api/rewards/tier-seen). Reduce motion: no burst, no confetti, no
// movement — same content.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { AUTH_EVENT, USER_EVENT, getCurrentUser, setCurrentUser } from '@/lib/auth-client'
import { apiJson } from '@/lib/api-client'
import { useLang } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { useReducedMotion } from '@/lib/motion'
import { triggerHaptic } from '@/lib/haptics'
import { getTierForPoints, tierIndex, type RewardTier } from '@/lib/rewardTiers'
import type { DictKey } from '@/lib/i18n'

const CONFETTI = ['#FFB800', '#FFE08A', '#FFFFFF', '#F24230', '#34C759']

export default function TierUpCelebration() {
  const { t, lang } = useLang()
  const labels = useLabels()
  const reduce = useReducedMotion()
  const [tier, setTier] = useState<RewardTier | null>(null)
  const [lifetime, setLifetime] = useState(0)
  const button = useRef<HTMLButtonElement>(null)

  const check = useCallback(() => {
    const u = getCurrentUser()
    if (!u || typeof u.lifetimePoints !== 'number') return
    const now = getTierForPoints(u.lifetimePoints)
    if (tierIndex(now.key) > tierIndex(u.tierSeen ?? 'VISITOR')) {
      setLifetime(u.lifetimePoints)
      setTier(cur => (cur?.key === now.key ? cur : now))
    }
  }, [])

  useEffect(() => {
    check()
    window.addEventListener(USER_EVENT, check)
    window.addEventListener(AUTH_EVENT, check)
    return () => {
      window.removeEventListener(USER_EVENT, check)
      window.removeEventListener(AUTH_EVENT, check)
    }
  }, [check])

  // The haptic flourish: a heavy hit, then two lighter ones.
  useEffect(() => {
    if (!tier) return
    triggerHaptic('heavy')
    const a = setTimeout(() => triggerHaptic('medium'), 260)
    const b = setTimeout(() => triggerHaptic('medium'), 480)
    button.current?.focus()
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [tier])

  const dismiss = useCallback(() => {
    if (!tier) return
    triggerHaptic('light')
    const u = getCurrentUser()
    if (u) setCurrentUser({ ...u, tierSeen: tier.key })
    apiJson('/api/rewards/tier-seen', { method: 'POST' }).catch(() => {})
    setTier(null)
  }, [tier])

  useEffect(() => {
    if (!tier) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tier, dismiss])

  if (!tier) return null
  const name = labels.tier(tier.key)
  const n = lifetime.toLocaleString(lang === 'en' ? 'en-US' : lang)
  return (
    <div className="rw-tierup" role="dialog" aria-modal="true" aria-labelledby="rw-tierup-title">
      {!reduce && <div className="rw-tierup-burst" aria-hidden />}
      {!reduce && Array.from({ length: 36 }, (_, i) => (
        <span key={i} className="rw-confetti" aria-hidden style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDuration: `${2.2 + (i % 7) * 0.35}s`, animationDelay: `${(i % 9) * 0.12}s` }} />
      ))}
      <span className="eyebrow">{t('m.rw.tierUpEyebrow')}</span>
      <div className="rw-tierup-medal" aria-hidden style={{ marginTop: '18px' }}><Icon name={tier.icon} size={58} /></div>
      <h2 id="rw-tierup-title">{t('m.rw.tierUpTitle', { tier: name })}</h2>
      <p className="num-font">{t('m.rw.tierUpBody', { n })}</p>
      <ul aria-label={t('m.rw.tierUpPerks')}>
        {Array.from({ length: tier.perks }, (_, i) => (
          <li key={i}><Icon name="check" size={16} style={{ color: '#FFE08A', flexShrink: 0 }} />{t(`m.rw.perk.${tier.key}.${i}` as DictKey)}</li>
        ))}
      </ul>
      <button ref={button} className="btn" onClick={dismiss}>{t('m.rw.tierUpCta')}</button>
      <Link href="/rewards/tiers" onClick={dismiss} style={{ position: 'relative', marginTop: '14px', color: '#FFE08A', fontWeight: 700, fontSize: '14px' }}>{t('m.rw.seeTiers')}</Link>
    </div>
  )
}
