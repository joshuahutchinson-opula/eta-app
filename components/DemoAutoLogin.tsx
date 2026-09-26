// components/DemoAutoLogin.tsx — on the mobile app's first load with nobody
// signed in, sign into the demo account (see /api/auth/demo) and reload so
// every screen sees the user. Skipped on the web site and the login/register
// screens, and after an explicit log-out (so logged-out flows stay testable).
'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { LOGGED_OUT_KEY } from '@/lib/auth-client'

export default function DemoAutoLogin() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname.startsWith('/web') || pathname.startsWith('/login') || pathname.startsWith('/register')) return
    try {
      if (localStorage.getItem('eta_user') || localStorage.getItem(LOGGED_OUT_KEY)) return
    } catch {
      return
    }
    let cancelled = false
    fetch('/api/auth/demo', { method: 'POST' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data?.token || !data?.user) return
        localStorage.setItem('eta_token', data.token)
        localStorage.setItem('eta_user', JSON.stringify(data.user))
        window.location.reload()
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [pathname])

  return null
}
