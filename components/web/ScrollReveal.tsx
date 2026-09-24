// components/web/ScrollReveal.tsx
// One observer for the whole web app. Sections, page headers and every card
// in a grid/rail fade and slide in once as they enter the viewport; items
// that arrive together are staggered. Elements added later (Explore's
// "Load more", filter changes, the vibe picker) are picked up too.
//
// Hiding is opt-in: web.css only hides these elements under
// html.w-anim, which the layout's inline script sets before first paint
// (and skips for reduced-motion users) — so with no JS nothing is hidden.
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

export default function ScrollReveal() {
  const pathname = usePathname()

  useEffect(() => {
    const root = document.documentElement
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Client-side navigation into /web doesn't run the layout's inline script.
    root.classList.add('w-anim')

    const io = new IntersectionObserver(entries => {
      const entering = entries.filter(e => e.isIntersecting).map(e => e.target as HTMLElement)
      entering
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left)
        .forEach((el, i) => {
          el.style.transitionDelay = `${Math.min(i, 8) * 70}ms`
          el.classList.add('is-visible')
          io.unobserve(el)
          // Drop the delay once revealed so hover transitions stay instant.
          window.setTimeout(() => { el.style.transitionDelay = '' }, 900 + i * 70)
        })
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })

    const scan = () => {
      document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach(el => {
        if (!el.classList.contains('is-visible') && !el.dataset.revealWatched) {
          el.dataset.revealWatched = '1'
          io.observe(el)
        }
      })
    }
    scan()
    const mo = new MutationObserver(scan)
    mo.observe(document.body, { childList: true, subtree: true })
    return () => { io.disconnect(); mo.disconnect() }
  }, [pathname])

  return null
}
