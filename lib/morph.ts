// lib/morph.ts — card → detail, shared-element style: the tapped card's
// image grows into the detail page's hero. A card marks its image box with
// data-morph (components/MorphCapture remembers where it was on the tap);
// the detail page's hero calls useMorphIn(ref, ready) and animates from that
// box to its own place: scaled to cover the card, clipped to the card's
// shape and corners, then opening out to full size. No distortion — the
// hero's media is object-fit: cover throughout.
// Reduce motion: a short fade instead. With no recent tap it does nothing.
'use client'

import { useLayoutEffect, useEffect } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

interface Pending { rect: DOMRect; radius: number; at: number }

let pending: Pending | null = null
const FRESH_MS = 2500
export const MORPH_MS = 460
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/** Remember the tapped card's image box (called by components/MorphCapture). */
export function captureMorph(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  if (rect.width < 24 || rect.height < 24) return
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
  pending = { rect, radius, at: Date.now() }
  document.documentElement.classList.add('morphing')
  window.setTimeout(() => document.documentElement.classList.remove('morphing'), FRESH_MS)
}

/** Is a card → detail morph about to run? (Pages use a plain fade then.) */
export function morphPending(): boolean {
  return Boolean(pending && Date.now() - pending.at < FRESH_MS)
}

/** Grow the remembered card into this element once it's on screen (`ready`). */
export function useMorphIn(ref: React.RefObject<HTMLElement>, ready = true) {
  useIsoLayoutEffect(() => {
    if (!ready || !pending || Date.now() - pending.at > FRESH_MS) return
    const from = pending
    pending = null
    const el = ref.current
    if (!el || typeof el.animate !== 'function') return
    if (prefersReducedMotion()) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' })
      return
    }
    const to = el.getBoundingClientRect()
    if (!to.width || !to.height) return
    // Scale so the hero covers the card, and clip away what's outside it.
    const s = Math.max(from.rect.width / to.width, from.rect.height / to.height)
    const visW = from.rect.width / s
    const visH = from.rect.height / s
    const cl = Math.max(0, (to.width - visW) / 2)
    const ct = Math.max(0, (to.height - visH) / 2)
    const tx = from.rect.left - to.left - cl * s
    const ty = from.rect.top - to.top - ct * s
    const r = from.radius / s
    el.animate([
      { transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${s})`, clipPath: `inset(${ct}px ${cl}px ${ct}px ${cl}px round ${r}px)` },
      { transformOrigin: '0 0', transform: 'translate(0, 0) scale(1)', clipPath: 'inset(0px 0px 0px 0px round 0px)' }
    ], { duration: MORPH_MS, easing: EASE })
  }, [ready])
}
