// lib/pressable.ts — for tappable cards that can't be a <button> (they hold
// other buttons, or are long-press targets): makes them reachable and usable
// from a keyboard or screen reader like a real button.
import type { KeyboardEvent } from 'react'

export function pressable(onPress: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onPress()
      }
    }
  }
}
