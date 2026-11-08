// components/MorphCapture.tsx — listens for taps on cards (once, in the root
// layout). When the tap lands on a card (a link), it remembers the card's
// image box — the one marked data-morph, or else its first photo — so the
// detail page's hero can grow out of it (lib/morph.ts).
'use client'

import { useEffect } from 'react'
import { captureMorph } from '@/lib/morph'

export default function MorphCapture() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return
      // The marked box itself, or the one inside the tapped card.
      const direct = target.closest<HTMLElement>('[data-morph]')
      const card = target.closest<HTMLElement>('a, [role="link"], [data-morph-card]')
      // Cards that don't mark a box: their first photo (components/Img's wrapper).
      const box = direct ?? card?.querySelector<HTMLElement>('[data-morph]') ?? card?.querySelector<HTMLElement>('.img-blur, video') ?? null
      // Not for buttons inside a card (save, reserve…), unless the button opens it.
      const button = target.closest('button')
      if (!box || target.closest('[data-no-morph]') || (button && !button.hasAttribute('data-morph-open'))) return
      captureMorph(box)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
  return null
}
