// components/web/ParallaxScope.tsx
// Layered scroll parallax. Any descendant with data-parallax="<speed>" is
// shifted vertically by (its frame's distance from the viewport centre ×
// speed), so layers with different speeds move at different rates as you
// scroll — backgrounds drift slower than the content in front of them.
// Positive speeds lag behind the scroll (background), negative ones run
// ahead (foreground). data-parallax-max caps the shift in px — set it to
// the slack a layer has inside its frame so an edge is never exposed.
// Scroll-driven only; off for reduced motion.
'use client'

import { useEffect, useRef } from 'react'

const MAX_SHIFT = 90

export default function ParallaxScope({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0

    const update = () => {
      const vh = window.innerHeight
      const rootRect = root.getBoundingClientRect()
      if (rootRect.bottom < -200 || rootRect.top > vh + 200) return
      root.querySelectorAll<HTMLElement>('[data-parallax]').forEach(el => {
        const speed = Number(el.dataset.parallax) || 0
        const max = Number(el.dataset.parallaxMax) || MAX_SHIFT
        const frameEl = el.parentElement ?? el
        const r = frameEl.getBoundingClientRect()
        const fromCentre = r.top + r.height / 2 - vh / 2
        const shift = Math.max(-max, Math.min(max, fromCentre * speed))
        el.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`
      })
    }
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update) }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return <section ref={ref} className={className}>{children}</section>
}
