// components/home/RegionPill.tsx — the region changer on Home's hero (and
// its slim bar): a glass pill with the town that opens the region picker
// (components/RegionSelector) in a bottom sheet. Still the one location
// changer in the app.
'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/lib/icons'
import { RegionPicker } from '@/components/RegionSelector'
import { useRegion } from '@/components/RegionProvider'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

export default function RegionPill() {
  const { town } = useRegion()
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState(0)
  const [mounted, setMounted] = useState(false)
  const close = () => { setOpen(false); setKey(k => k + 1) }
  useEffect(() => setMounted(true), [])

  return (
    <>
      <button className="glass-pill press" onClick={() => { triggerHaptic('light'); setOpen(true) }} aria-haspopup="dialog" aria-expanded={open} aria-label={t('m.region.change', { town: town.name })}>
        <Icon name="mapPin" size={14} />
        {town.name}
        <Icon name="chevronDown" size={12} style={{ opacity: 0.8 }} />
      </button>
      {/* On body: the hero moves with a transform, which would trap a fixed sheet. */}
      {mounted && createPortal(
        <>
          <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={close} />
          <div className={`bottom-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open} aria-label={t('m.region.change', { town: town.name })}>
            <div className="sheet-grabber" />
            <div style={{ padding: '0 20px 24px', color: 'var(--label-primary)' }}>
              {open && <RegionPicker key={key} onDone={close} />}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
