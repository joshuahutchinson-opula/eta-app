// lib/auth-client.ts
'use client'

export interface CurrentUser {
  id: string
  email: string
  name: string
  role: string
  level: string
  points: number
  walletBalance: number
  streak: number
  city: string
  avatarUrl?: string | null
  createdAt?: string
}

export function getCurrentUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('eta_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('eta_token')
}

export function setCurrentUser(user: CurrentUser) {
  localStorage.setItem('eta_user', JSON.stringify(user))
}

/** Set on log-out so the demo auto-login (components/DemoAutoLogin) leaves you logged out. */
export const LOGGED_OUT_KEY = 'eta_logged_out'

export function logout() {
  localStorage.removeItem('eta_user')
  localStorage.removeItem('eta_token')
  localStorage.setItem(LOGGED_OUT_KEY, '1')
}
