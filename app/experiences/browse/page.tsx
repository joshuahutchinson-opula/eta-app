// app/experiences/browse/page.tsx — every curated experience, filterable by
// mood and region, so the planning survey isn't the only way in.
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import ExperienceCard, { type ExperienceCardData } from '@/components/ExperienceCard'
import ErrorState from '@/components/ErrorState'
import { useRegion } from '@/components/RegionProvider'
import { useLang } from '@/lib/i18n-client'
import { CITY_CODES, cityName } from '@/lib/regions'
import { triggerHaptic } from '@/lib/haptics'
import BackButton from '@/components/BackButton'

type Exp = ExperienceCardData & { city: string; moods?: Array<{ id: string; name: string; icon: string }> }

export default function BrowseExperiencesPage() {
  const router = useRouter()
  const { t } = useLang()
  const { city: regionCity, ready } = useRegion()
  const [experiences, setExperiences] = useState<Exp[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [mood, setMood] = useState<string | null>(null)
  // null = all of Jamaica
  const [city, setCity] = useState<string | null>(null)

  useEffect(() => { if (ready) setCity(regionCity) }, [ready, regionCity])

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const res = await fetch(city ? `/api/experiences?city=${city}` : '/api/experiences')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setExperiences(Array.isArray(data) ? data : [])
    } catch {
      setFailed(true)
    }
  }, [city])

  useEffect(() => { if (ready) load() }, [ready, load])

  const all = experiences ?? []
  const cities = Array.from(new Set([regionCity, ...CITY_CODES]))
  const moods = Array.from(new Map(all.flatMap(e => e.moods ?? []).map(m => [m.id, m])).values())
  const shown = all
    .filter(e => !city || e.city === city)
    .filter(e => !mood || e.moods?.some(m => m.id === mood))

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <BackButton fallback="/experiences" />
        <div className="section-heading">
          <span className="section-eyebrow">{t('m.exp.browseEyebrow')}</span>
          <h1 className="section-title">{t('m.exp.browseAll')}</h1>
        </div>
      </div>

      <div className="horizontal-scroll" style={{ padding: '12px 16px 4px' }} role="group" aria-label={t('m.exp.region')}>
        <button className={`chip ${city === null ? 'active' : ''}`} aria-pressed={city === null} onClick={() => { triggerHaptic('selection'); setCity(null) }}>{t('m.exp.allJamaica')}</button>
        {cities.map(c => (
          <button key={c} className={`chip ${city === c ? 'active' : ''}`} aria-pressed={city === c} onClick={() => { triggerHaptic('selection'); setCity(c) }}>
            <Icon name="mapPin" size={14} /> {cityName(c)}
          </button>
        ))}
      </div>
      {moods.length > 0 && (
        <div className="mood-picker" style={{ padding: '4px 16px 12px' }} role="group" aria-label={t('m.exp.mood')}>
          {moods.map(m => (
            <button key={m.id} className={`mood-pill ${mood === m.id ? 'centre' : ''}`} aria-pressed={mood === m.id} onClick={() => { triggerHaptic('selection'); setMood(mood === m.id ? null : m.id) }}>
              <Icon name={m.icon} size={16} /> {m.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {failed ? <ErrorState onRetry={load} /> : experiences === null ? (
          [0, 1, 2].map(i => <div key={i} className="skeleton-card" style={{ height: '240px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>)
        ) : shown.length === 0 ? (
          <div className="empty-state">
            <Icon name="compass" size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.exp.browseEmpty')}</p>
            <button className="btn btn-secondary" onClick={() => router.push('/experiences')}>{t('m.exp.planInstead')}</button>
          </div>
        ) : (
          shown.map(e => <ExperienceCard key={e.id} exp={e} width="100%" imageHeight="170px" />)
        )}
      </div>
      <Dock />
    </main>
  )
}
