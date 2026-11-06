// components/home/PointsPill.tsx — Home's one points pill (gold star +
// count), top right over the hero and in the slim bar. When the points
// change it counts up to the new total with a small gold sparkle (a jump,
// with reduce motion). Taps through to Rewards.
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { AUTH_EVENT, getCurrentUser } from '@/lib/auth-client'
import { useLang } from '@/lib/i18n-client'
import { useReducedMotion } from '@/lib/motion'

export const POINTS_EVENT = 'eta-points-change'

export default function PointsPill({ solid = false }: { solid?: boolean }) {
  const { t, lang } = useLang()
  const reduce = useReducedMotion()
  const [target, setTarget] = useState<number | null>(null)
  const [shown, setShown] = useState(0)
  const [spark, setSpark] = useState(0)
  const first = useRef(true)

  useEffect(() => {
    const read = () => { const u = getCurrentUser(); setTarget(u ? u.points ?? 0 : null) }
    read()
    const onVis = () => { if (document.visibilityState === 'visible') read() }
    window.addEventListener(AUTH_EVENT, read)
    window.addEventListener(POINTS_EVENT, read)
    window.addEventListener('storage', read)
    window.addEventListener('focus', read)
    document.addEventListener('visibilitychange', onVis)
    const timer = setInterval(read, 15000)
    return () => {
      window.removeEventListener(AUTH_EVENT, read)
      window.removeEventListener(POINTS_EVENT, read)
      window.removeEventListener('storage', read)
      window.removeEventListener('focus', read)
      document.removeEventListener('visibilitychange', onVis)
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (target === null) return
    if (first.current || reduce) { first.current = false; setShown(target); return }
    const from = shown
    if (from === target) return
    if (target > from) setSpark(s => s + 1)
    const start = performance.now()
    const dur = Math.min(1400, 500 + Math.abs(target - from) * 8)
    let raf = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / dur)
      const e = 1 - Math.pow(1 - k, 3)
      setShown(Math.round(from + (target - from) * e))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, reduce]) // eslint-disable-line react-hooks/exhaustive-deps

  if (target === null) return null
  const n = shown.toLocaleString(lang === 'en' ? 'en-US' : lang)
  return (
    <Link href="/rewards" className={`glass-pill press points-pill ${solid ? 'solid' : ''}`} aria-label={t('m.hub.open', { n })}>
      <span className="points-star" aria-hidden>
        <Icon name="star" size={13} style={{ color: 'var(--gold)' }} />
        {spark > 0 && !reduce && <span key={spark} className="points-spark" />}
      </span>
      <span className="num-font" style={{ fontWeight: 700 }}>{n}</span>
    </Link>
  )
}
