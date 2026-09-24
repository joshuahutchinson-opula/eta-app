// components/web/Parallax.tsx
// Restrained scroll parallax: the child drifts at `speed` × scroll distance
// (capped at 60px) while on screen. Scroll-driven only — nothing moves on
// its own — and disabled for reduced-motion users.
'use client'

import { useEffect, useRef } from 'react'

export default function Parallax({ speed = 0.15, children }: { speed?: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const update = () => {
      const r = el.getBoundingClientRect()
      if (r.bottom < -200 || r.top > window.innerHeight) return
      const y = Math.max(-60, Math.min(60, window.scrollY * speed))
      el.style.transform = `translate3d(0, ${y}px, 0)`
      el.style.opacity = String(Math.max(0.35, 1 - window.scrollY / 900))
    }
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll) }
  }, [speed])

  return <div ref={ref} style={{ willChange: 'transform' }}>{children}</div>
}
