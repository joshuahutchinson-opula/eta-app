// lib/haptics.ts
'use client'

// The control the user last pressed, so the visual fallback knows what to
// animate. Set by components/HapticFallback (a capture-phase pointer listener).
let lastPressed: Element | null = null

export function rememberPressed(target: EventTarget | null) {
  lastPressed = target instanceof Element ? target.closest('button, a, [role="button"], .card, .chip, .mood-pill') : null
}

// No vibration (iPhone browsers): give the pressed control a brief squeeze so
// the tap still feels answered. Restarting the class replays the animation.
function visualFeedback() {
  const el = lastPressed
  if (!(el instanceof HTMLElement)) return
  el.classList.remove('haptic-press')
  void el.offsetWidth
  el.classList.add('haptic-press')
  setTimeout(() => el.classList.remove('haptic-press'), 220)
}

export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'selection' = 'light') {
  if (typeof navigator === 'undefined') return

  // Check for Capacitor Haptics
  const capWindow = window as any
  if (capWindow.Capacitor?.Plugins?.Haptics) {
    const Haptics = capWindow.Capacitor.Plugins.Haptics
    if (type === 'light') {
      Haptics.impact({ impactStyle: 'LIGHT' })
    } else if (type === 'medium') {
      Haptics.impact({ impactStyle: 'MEDIUM' })
    } else if (type === 'heavy') {
      Haptics.impact({ impactStyle: 'HEAVY' })
    } else if (type === 'selection') {
      Haptics.selection()
    }
    return
  }

  // Fallback to Web Vibration API for Android
  if (typeof navigator.vibrate === 'function') {
    if (type === 'light') {
      navigator.vibrate(10)
    } else if (type === 'medium') {
      navigator.vibrate(20)
    } else if (type === 'heavy') {
      navigator.vibrate(30)
    } else if (type === 'selection') {
      navigator.vibrate(5)
    }
    return
  }

  visualFeedback()
}

// Convenience functions
export function hapticBookingConfirmed() {
  triggerHaptic('medium')
}

export function hapticRewardRedeemed() {
  triggerHaptic('medium')
}

export function hapticSaved() {
  triggerHaptic('light')
}

export function hapticSurveyStepComplete() {
  triggerHaptic('selection')
}
