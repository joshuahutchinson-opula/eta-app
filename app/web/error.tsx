// app/web/error.tsx
// Error boundary for every /web page. Without it, a server render that threw
// (e.g. the database dropping mid-request) unmounted the whole page — a
// blank screen after client-side navigation, a bare 500 on a hard load.
// Now the nav and footer stay, and the page can be retried in place.
'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function WebError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [tries, setTries] = useState(0)

  useEffect(() => {
    console.error('Web page failed to render:', error)
  }, [error])

  const retry = () => {
    setTries(n => n + 1)
    // Re-fetch the server component payload, then clear the boundary.
    startTransition(() => {
      router.refresh()
      reset()
    })
  }

  return (
    <div className="w-container">
      <div className="w-empty" style={{ margin: '64px 0', padding: '72px 24px' }} role="alert">
        <h3>This page didn’t load</h3>
        <p className="w-muted" style={{ maxWidth: 440 }}>
          {tries > 1
            ? 'Still having trouble reaching our servers. Check your connection and try again in a moment.'
            : 'Something went wrong while loading it — usually a brief connection hiccup.'}
        </p>
        <button type="button" className="w-btn w-btn-primary" onClick={retry} disabled={pending} style={{ marginTop: 8 }}>
          {pending ? 'Loading…' : 'Try again'}
        </button>
      </div>
    </div>
  )
}
