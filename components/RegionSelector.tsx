// components/RegionSelector.tsx — the region pill at the top of Home.
// Collapsed it's one compact line; tapping opens the parishes, then the
// towns in the picked parish, plus "Use my current location".
'use client'

import { useState } from 'react'
import Icon from '@/lib/icons'
import { PARISHES, type Parish } from '@/lib/regions'
import { useRegion } from '@/components/RegionProvider'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

export default function RegionSelector() {
  const { city, town, parish, setCity, locateMe } = useRegion()
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [pickedParish, setPickedParish] = useState<Parish | null>(null)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => { setOpen(false); setPickedParish(null); setError(null) }

  const locate = async () => {
    setLocating(true)
    setError(null)
    try {
      await locateMe()
      triggerHaptic('selection')
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('m.region.locationError'))
    } finally {
      setLocating(false)
    }
  }

  const parishShown = pickedParish ?? (open ? null : parish)

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
          <button className="btn btn-secondary" onClick={locate} disabled={locating} style={{ width: '100%', marginBottom: '12px', fontSize: '15px' }}>
            <Icon name="compass" size={16} />
            {locating ? t('m.region.locating') : t('m.region.useLocation')}
          </button>
          {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{error}</p>}

          {pickedParish ? (
            <>
              <button
                onClick={() => setPickedParish(null)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--rum-text)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '8px', minHeight: '32px', fontFamily: 'inherit', padding: 0 }}
              >
                <Icon name="chevronLeft" size={12} /> {t('m.region.allParishes')}
              </button>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>{pickedParish.name}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {pickedParish.towns.map(tn => (
                  <button
                    key={tn.city}
                    onClick={() => { triggerHaptic('selection'); setCity(tn.city); close() }}
                    className={`chip ${city === tn.city ? 'active' : ''}`}
                    aria-pressed={city === tn.city}
                  >
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
                    onClick={() => p.towns.length === 1 ? (triggerHaptic('selection'), setCity(p.towns[0].city), close()) : setPickedParish(p)}
                    className={`chip ${parishShown?.id === p.id ? 'active' : ''}`}
                    style={{ minHeight: '36px', padding: '6px 12px', fontSize: '14px' }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
