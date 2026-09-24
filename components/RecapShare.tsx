// components/RecapShare.tsx
'use client'

import { useState } from 'react'
import Icon from '@/lib/icons'
import { usePatois } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

/** Shares the recap card image when the device supports file sharing, otherwise the link. */
export default function RecapShare({ slug, name }: { slug: string; name: string }) {
  const patois = usePatois()
  const [status, setStatus] = useState<string | null>(null)

  const share = async () => {
    triggerHaptic('light')
    const url = `${window.location.origin}/trip/${slug}/recap`
    try {
      const res = await fetch(`/api/trips/${slug}/recap-image`)
      const blob = await res.blob()
      const file = new File([blob], `eta-${slug}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name, text: `${name} — my ETA trip recap`, url })
        return
      }
      if (navigator.share) {
        await navigator.share({ title: name, text: `${name} — my ETA trip recap`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setStatus(patois.successLinkCopied)
    } catch {
      // Share sheet dismissed — nothing to do.
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button className="btn btn-primary" onClick={share} style={{ width: '100%' }}>
        <Icon name="share" size={16} /> Share recap
      </button>
      <a className="btn btn-secondary" href={`/api/trips/${slug}/recap-image`} download={`eta-${slug}.png`} style={{ width: '100%', textDecoration: 'none' }}>
        Save the card
      </a>
      {status ? <p role="status" style={{ textAlign: 'center', fontSize: 13, color: 'var(--label-secondary)' }}>{status}</p> : null}
    </div>
  )
}
