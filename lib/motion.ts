// lib/motion.ts — "Reduce motion" (the OS setting) for screens that animate
// in JavaScript (Home's living hero, parallax, tilt). CSS animations check
// the same media query in globals.css.
'use client'

import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.(QUERY).matches)
}

export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY)
    if (!mq) return
    setReduce(mq.matches)
    const on = (e: MediaQueryListEvent) => setReduce(e.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return reduce
}
