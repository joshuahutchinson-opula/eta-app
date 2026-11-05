// lib/onboarding.ts — whether this device has been through the three-tap
// onboarding (app/onboarding). Devices that picked a vibe in the older
// onboarding count as done.
'use client'

const KEY = 'eta_onboarded'

export function needsOnboarding(): boolean {
  try { return !localStorage.getItem(KEY) && !localStorage.getItem('eta_vibe') } catch { return false }
}

export function markOnboarded() {
  try { localStorage.setItem(KEY, String(Date.now())) } catch {}
}
