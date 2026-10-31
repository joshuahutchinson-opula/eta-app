// components/SessionGuard.tsx — keeps the session honest on every screen:
//  • signs out (with a message on the login screen) when the token has
//    expired, checked on load and every minute;
//  • watches API responses for the X-Session: expired header the server
//    sends for a revoked or expired token (lib/auth-server.ts);
//  • refreshes the cached user once per load, so points and verification
//    status stay current;
//  • after sign-in, moves saves made while logged out onto the account.
'use client'

import { useEffect } from 'react'
import { AUTH_EVENT, expireSession, getAuthToken, setCurrentUser, tokenExpiry } from '@/lib/auth-client'
import { syncSavedToAccount } from '@/lib/saved'

let patched = false

function patchFetch() {
  if (patched || typeof window === 'undefined') return
  patched = true
  const original = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const res = await original(input, init)
    if (res.status === 401 && res.headers.get('X-Session') === 'expired' && getAuthToken()) expireSession()
    return res
  }
}

function checkExpiry() {
  const token = getAuthToken()
  if (!token) return
  const exp = tokenExpiry(token)
  if (exp !== null && exp * 1000 <= Date.now()) expireSession()
}

async function refreshUser() {
  const token = getAuthToken()
  if (!token) return
  try {
    const res = await fetch('/api/auth/verify', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const data = await res.json()
      if (data?.user) setCurrentUser(data.user)
    }
  } catch {}
}

export default function SessionGuard() {
  useEffect(() => {
    patchFetch()
    checkExpiry()
    refreshUser().then(() => syncSavedToAccount())
    const timer = setInterval(checkExpiry, 60000)
    const onAuth = (e: Event) => { if ((e as CustomEvent).detail === 'signin') syncSavedToAccount() }
    window.addEventListener(AUTH_EVENT, onAuth)
    return () => { clearInterval(timer); window.removeEventListener(AUTH_EVENT, onAuth) }
  }, [])
  return null
}
