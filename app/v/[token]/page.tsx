// app/v/[token]/page.tsx — where a vendor's QR card lands when scanned with
// the phone camera: straight into Scan & Pay with that code (visit, points,
// then paying the vendor), after logging in if needed.
'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-client'

export default function VendorQrLanding() {
  const { token } = useParams() as { token: string }
  const router = useRouter()
  useEffect(() => {
    const next = `/pay?code=${encodeURIComponent(token)}`
    router.replace(getCurrentUser() ? next : `/login?next=${encodeURIComponent(next)}`)
  }, [token, router])
  return <main style={{ minHeight: '100dvh', background: 'var(--system-bg)' }} />
}
