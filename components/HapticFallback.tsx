// components/HapticFallback.tsx — tracks which control was just pressed so
// triggerHaptic() can animate it on devices that can't vibrate (lib/haptics.ts).
'use client'

import { useEffect } from 'react'
import { rememberPressed } from '@/lib/haptics'

export default function HapticFallback() {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') return
    const onDown = (e: PointerEvent | KeyboardEvent) => rememberPressed(e.target)
    document.addEventListener('pointerdown', onDown, { capture: true, passive: true })
    document.addEventListener('keydown', onDown, { capture: true })
    return () => {
      document.removeEventListener('pointerdown', onDown, { capture: true })
      document.removeEventListener('keydown', onDown, { capture: true })
    }
  }, [])
  return null
}
