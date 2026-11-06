// app/v/[token]/page.tsx — where a vendor's QR card lands when scanned with
// the phone camera.
//   Signed in → straight into Scan & Pay with that code (visit, points,
//               then paying the vendor).
//   No ETA    → the visit is held (with where they are, if the browser
//               shares it; lib/pending-visits.ts) and they land on the
//               vendor's web page with "Get ETA to collect your points";
//               signing up within 24 hours credits it.
'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-client'

function position(): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
  })
}

export default function VendorQrLanding() {
  const { token } = useParams() as { token: string }
  const router = useRouter()
  useEffect(() => {
    if (getCurrentUser()) { router.replace(`/pay?code=${encodeURIComponent(token)}`); return }
    let cancelled = false
    ;(async () => {
      const pos = await position()
      const res = await fetch('/api/visits/pending', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: token, lat: pos?.lat ?? null, lng: pos?.lng ?? null }) }).catch(() => null)
      const held = res?.ok ? await res.json() : null
      if (cancelled) return
      if (!held?.vendor) { router.replace(`/login?next=${encodeURIComponent(`/pay?code=${encodeURIComponent(token)}`)}`); return }
      try { localStorage.setItem('eta_pending_visit', held.claimToken) } catch {}
      router.replace(`/web/vendor/${held.vendor.id}?collect=1${held.onSite ? '' : '&onsite=0'}`)
    })()
    return () => { cancelled = true }
  }, [token, router])
  return <main style={{ minHeight: '100dvh', background: 'var(--system-bg)' }} />
}
