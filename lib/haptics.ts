// lib/haptics.ts
'use client'

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
  }
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