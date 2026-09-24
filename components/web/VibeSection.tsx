// components/web/VibeSection.tsx
// "Choose Your Vibe" — the mobile Home mood picker, on the web. Picking a
// vibe shows the real experiences tagged with that mood.
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import ExperienceCard from '@/components/web/ExperienceCard'
import { useLang } from '@/lib/i18n-client'
import type { ExperienceCardData } from '@/lib/web-data'

export interface VibeMood {
  id: string
  name: string
  icon: string
  description: string
}

export default function VibeSection({ moods, experiences }: { moods: VibeMood[]; experiences: ExperienceCardData[] }) {
  const { lang, t } = useLang()
  const [selected, setSelected] = useState<string | null>(null)

  const shown = useMemo(() => {
    const list = selected ? experiences.filter(e => e.moods.some(m => m.id === selected)) : experiences
    return list.slice(0, 4)
  }, [selected, experiences])

  const mood = moods.find(m => m.id === selected)

  return (
    <section className="w-section">
      <div className="w-section-head">
        <div>
          <h2 className="w-section-title">{t('home.vibe')}</h2>
          <p className="w-section-sub">{mood ? mood.description : t('home.vibeSub')}</p>
        </div>
        <Link href="/web/experiences" className="w-link-arrow">{t('common.seeAll')} →</Link>
      </div>
      <div className="w-vibes" role="group" aria-label={t('home.vibe')}>
        {moods.map(m => (
          <button
            key={m.id}
            type="button"
            className="w-vibe"
            aria-pressed={selected === m.id}
            onClick={() => setSelected(selected === m.id ? null : m.id)}
          >
            <Icon name={m.icon} size={16} />
            {m.name}
          </button>
        ))}
      </div>
      {shown.length > 0 ? (
        <div className="w-grid-4 w-vibe-results" key={selected ?? 'all'}>
          {shown.map(e => <ExperienceCard key={e.id} experience={e} lang={lang} />)}
        </div>
      ) : (
        <div className="w-empty" style={{ padding: 40 }}>
          <p className="w-muted">{t('home.vibeEmpty')}</p>
        </div>
      )}
    </section>
  )
}
