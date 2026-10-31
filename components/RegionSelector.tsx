// components/RegionSelector.tsx — choosing the region.
//   default — the pill at the top of Home: one compact line that expands
//             into the parishes, then the towns in the picked parish, plus
//             "Use my current location".
//   RegionPill — the same picker from a small pill in a bottom sheet, for
//             Market, Experiences, Search and Events.
'use client'

import { useState } from 'react'
import Icon from '@/lib/icons'
import { PARISHES, type Parish } from '@/lib/regions'
import { useRegion } from '@/components/RegionProvider'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

function RegionPicker({ onDone, showCurrentParish }: { onDone: () => void; showCurrentParish?: boolean }) {
  const { city, parish, setCity, locateMe } = useRegion()
  const { t } = useLang()
  const errorText = useErrorText()
  const [pickedParish, setPickedParish] = useState<Parish | null>(null)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locate = async () => {
    setLocating(true)
    setError(null)
    try {
      await locateMe()
      triggerHaptic('selection')
      onDone()
    } catch (e) {
      setError(e instanceof Error ? t('m.region.locationError') : errorText(e))
    } finally {
      setLocating(false)
    }
  }

  const parishShown = pickedParish ?? (showCurrentParish ? parish : null)

  return (
    <>
      <button className="btn btn-secondary" onClick={locate} disabled={locating} style={{ width: '100%', marginBottom: '12px', fontSize: '15px' }}>
        <Icon name="compass" size={16} />
        {locating ? t('m.region.locating') : t('m.region.useLocation')}
      </button>
      {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{error}</p>}

      {pickedParish ? (
        <>
          <button
            onClick={() => setPickedParish(null)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--rum-text)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '8px', minHeight: '44px', fontFamily: 'inherit', padding: 0 }}
          >
            <Icon name="chevronLeft" size={12} /> {t('m.region.allParishes')}
          </button>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>{pickedParish.name}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {pickedParish.towns.map(tn => (
              <button key={tn.city} onClick={() => { triggerHaptic('selection'); setCity(tn.city); onDone() }} className={`chip ${city === tn.city ? 'active' : ''}`} aria-pressed={city === tn.city}>
                {tn.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.region.pickParish')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {PARISHES.map(p => (
              <button
                key={p.id}
                onClick={() => p.towns.length === 1 ? (triggerHaptic('selection'), setCity(p.towns[0].city), onDone()) : setPickedParish(p)}
                className={`chip ${parishShown?.id === p.id ? 'active' : ''}`}
                style={{ minHeight: '36px', padding: '6px 12px', fontSize: '14px' }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}

export default function RegionSelector() {
  const { town, parish } = useRegion()
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState(0)
  const close = () => { setOpen(false); setKey(k => k + 1) }

  return (
    <div style={{ padding: '12px 16px 0' }}>
      <button
        onClick={() => { triggerHaptic('light'); open ? close() : setOpen(true) }}
        aria-expanded={open}
        aria-label={t('m.region.change', { town: town.name })}
        className="chip"
        style={{ minHeight: '36px', padding: '6px 12px', fontSize: '14px', fontWeight: 600, background: 'var(--system-bg-elevated)', boxShadow: 'var(--shadow-card)' }}
      >
        <Icon name="mapPin" size={14} style={{ color: 'var(--rum-text)' }} />
        {town.name}
        <span style={{ color: 'var(--label-secondary)', fontWeight: 500 }}>· {parish.name}</span>
        <Icon name="chevronDown" size={12} style={{ color: 'var(--label-secondary)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
      </button>

      {open && (
        <div className="card" style={{ marginTop: '8px', padding: '12px', cursor: 'default' }}>
          <RegionPicker key={key} onDone={close} />
        </div>
      )}
    </div>
  )
}

/** Compact region pill that opens the picker in a bottom sheet. */
export function RegionPill() {
  const { town } = useRegion()
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState(0)
  const close = () => { setOpen(false); setKey(k => k + 1) }

  return (
    <>
      <button
        onClick={() => { triggerHaptic('light'); setOpen(true) }}
        aria-haspopup="dialog"
        aria-label={t('m.region.change', { town: town.name })}
        className="chip"
        style={{ minHeight: '36px', padding: '4px 10px', fontSize: '13px', fontWeight: 600, background: 'var(--system-bg-elevated)', boxShadow: 'var(--shadow-card)', flexShrink: 0 }}
      >
        <Icon name="mapPin" size={12} style={{ color: 'var(--rum-text)' }} />
        {town.name}
        <Icon name="chevronDown" size={10} style={{ color: 'var(--label-secondary)' }} />
      </button>
      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={close} />
      <div className={`bottom-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.region.pill', { town: town.name })}>
        <div className="sheet-grabber" />
        {open && (
          <div style={{ padding: '0 20px 24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '12px' }}>{t('m.region.pill', { town: town.name })}</h3>
            <RegionPicker key={key} onDone={close} showCurrentParish />
          </div>
        )}
      </div>
    </>
  )
}
