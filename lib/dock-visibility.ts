// lib/dock-visibility.ts — hide the bottom tab bar (components/Dock) while a
// full-screen flow is open, like the in-app story camera and editor. Several
// can ask at once; the bar comes back when the last one lets go. It slides
// away (a fade with Reduce Motion; app/motion.css).
'use client'

import { useEffect } from 'react'

let holds = 0
const CLASS = 'dock-hidden'

export function useHideDock(hidden: boolean) {
  useEffect(() => {
    if (!hidden) return
    holds++
    document.documentElement.classList.add(CLASS)
    return () => {
      holds = Math.max(0, holds - 1)
      if (!holds) document.documentElement.classList.remove(CLASS)
    }
  }, [hidden])
}
