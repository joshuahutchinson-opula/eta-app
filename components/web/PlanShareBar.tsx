// components/web/PlanShareBar.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getTripKey } from '@/lib/trip-client'

export default function PlanShareBar({ slug, name }: { slug: string; name: string }) {
  const [copied, setCopied] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  useEffect(() => setCanEdit(Boolean(getTripKey(slug))), [slug])

  const share = async () => {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: name, url }).catch(() => {})
      return
    }
    await navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <button type="button" className="w-btn w-btn-primary" onClick={share}>{copied ? 'Link copied' : 'Share this plan'}</button>
      {canEdit ? <Link href={`/web/plan?edit=${slug}`} className="w-btn w-btn-ghost">Edit plan</Link> : null}
      <Link href="/web/plan" className="w-btn w-btn-ghost">Make your own</Link>
    </div>
  )
}
