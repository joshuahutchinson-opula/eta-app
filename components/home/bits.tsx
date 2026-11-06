// components/home/bits.tsx — small pieces shared by Home's sections:
//   Reveal      fades and lifts a section in as it scrolls into view
//   SaveHeart   save with a heartbeat and a haptic (lib/saved.ts)
//   SectionHead eyebrow + title (+ link), the same on every section
//   openLine    "Open till 10 PM" / "Opens 5 PM" for a place
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { readSaved, toggleSaved, SAVED_EVENT, type SavedKind } from '@/lib/saved'
import { hapticSaved } from '@/lib/haptics'
import { formatTime, type OpenNow } from '@/lib/hours'
import { useLang } from '@/lib/i18n-client'

export function Reveal({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) { setShown(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect() } }, { rootMargin: '0px 0px -8% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} className={`reveal ${shown ? 'in' : ''} ${className}`} style={style}>{children}</div>
}

export function useSaved(kind: SavedKind, id: string | null | undefined): [boolean, () => boolean] {
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!id) return
    const sync = () => setSaved(readSaved(kind).includes(id))
    sync()
    window.addEventListener(SAVED_EVENT, sync)
    return () => window.removeEventListener(SAVED_EVENT, sync)
  }, [kind, id])
  const toggle = () => {
    if (!id) return false
    const now = toggleSaved(kind, id)
    setSaved(now)
    hapticSaved()
    return now
  }
  return [saved, toggle]
}

export function SaveHeart({ kind, id, size = 18, className = 'save-btn', label }: { kind: SavedKind; id: string; size?: number; className?: string; label?: string }) {
  const { t } = useLang()
  const [saved, toggle] = useSaved(kind, id)
  const [beat, setBeat] = useState(0)
  return (
    <button
      type="button"
      className={className}
      aria-pressed={saved}
      aria-label={label ?? (saved ? t('m.home.saved') : t('m.home.save'))}
      onClick={e => { e.preventDefault(); e.stopPropagation(); if (toggle()) setBeat(b => b + 1) }}
    >
      <span key={beat} className={beat ? 'heart-beat' : ''} style={{ display: 'inline-flex' }}>
        <Icon name="heart" className={saved ? 'filled' : ''} size={size} />
      </span>
    </button>
  )
}

export function SectionHead({ eyebrow, title, href, linkLabel }: { eyebrow: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="home-section-head">
      <div>
        <span className="home-eyebrow">{eyebrow}</span>
        <h2 className="home-title">{title}</h2>
      </div>
      {href && linkLabel && <Link href={href} className="section-link">{linkLabel}</Link>}
    </div>
  )
}

export function useOpenLine() {
  const { t } = useLang()
  return (open: OpenNow | null | undefined): string | null => {
    if (!open) return null
    if (open.state === 'open') return open.closes ? t('m.home.openTill', { time: formatTime(open.closes) }) : t('m.home.openNow')
    if (open.state === 'soon') return t('m.home.opensAt', { time: formatTime(open.opens) })
    return null
  }
}
