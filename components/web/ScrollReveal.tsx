// components/web/ScrollReveal.tsx
// One observer for the whole web app. Sections, page headers and every card
// in a grid/rail fade and slide in once as they enter the viewport; items
// that arrive together are staggered. Elements added later (Explore's
// "Load more", filter changes, the vibe picker, client-side navigation) are
// picked up too.
//
// Hiding is opt-in: web.css only hides these elements under html.w-anim,
// which the layout's inline script sets before first paint (skipped for
// reduced motion) — so with no JS nothing is hidden.
//
// Resilience: content must never stay invisible because an observer
// callback was missed. Any target that is on screen (or already scrolled
// past) and still hidden 1.5s after it appeared, or 1.5s after the last
// scroll, is force-revealed.
'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export const REVEAL_SELECTOR = [
  '.w-section',
  '.w-page-head',
  '.w-editorial-copy',
  '.w-editorial-hero',
  '.w-cta-band',
  '.w-grid-3 > *',
  '.w-grid-4 > *',
  '.w-rail > *',
  '.w-teasers > *',
  '.w-masonry > *',
  '.w-reveal'
].join(',')

const FALLBACK_MS = 1500

export default function ScrollReveal() {
  const pathname = usePathname()

  useEffect(() => {
    const root = document.documentElement
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.remove('w-anim')
      return
    }
    // Client-side navigation into /web doesn't run the layout's inline script.
    root.classList.add('w-anim')

    // Tracked per effect run, NOT via a DOM attribute. The previous version
    // marked elements with data-reveal-watched; when navigating between two
    // pages that share a template (vendor → vendor, guide → guide) React
    // reuses those DOM nodes, so still-hidden elements kept the mark after
    // the old observer was disconnected and were never observed again —
    // stuck at opacity 0.
    const watched = new Set<HTMLElement>()

    const reveal = (el: HTMLElement, delayMs = 0) => {
      el.style.transitionDelay = delayMs ? `${delayMs}ms` : ''
      el.classList.add('is-visible')
      watched.delete(el)
      io.unobserve(el)
      if (delayMs) window.setTimeout(() => { el.style.transitionDelay = '' }, 900 + delayMs)
    }

    const io = new IntersectionObserver(entries => {
      entries
        .filter(e => e.isIntersecting)
        .map(e => e.target as HTMLElement)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left)
        .forEach((el, i) => reveal(el, Math.min(i, 8) * 70))
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })

    // Force-reveal anything the user can already see (or has scrolled past)
    // that the observer somehow didn't reveal.
    const sweep = () => {
      const bottom = window.innerHeight
      watched.forEach(el => {
        if (!el.isConnected) { watched.delete(el); return }
        if (el.getBoundingClientRect().top < bottom) reveal(el)
      })
    }
    let sweepTimer = 0
    const scheduleSweep = () => {
      window.clearTimeout(sweepTimer)
      sweepTimer = window.setTimeout(sweep, FALLBACK_MS)
    }

    const scan = () => {
      let added = false
      document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach(el => {
        if (el.classList.contains('is-visible') || watched.has(el)) return
        watched.add(el)
        io.observe(el)
        added = true
      })
      if (added) scheduleSweep()
    }

    scan()
    const mo = new MutationObserver(scan)
    mo.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('scroll', scheduleSweep, { passive: true })
    window.addEventListener('resize', scheduleSweep, { passive: true })

    return () => {
      io.disconnect()
      mo.disconnect()
      window.clearTimeout(sweepTimer)
      window.removeEventListener('scroll', scheduleSweep)
      window.removeEventListener('resize', scheduleSweep)
      // Never leave anything hidden behind when this run ends.
      watched.forEach(el => el.classList.add('is-visible'))
    }
  }, [pathname])

  return null
}
