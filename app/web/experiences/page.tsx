// app/web/experiences/page.tsx — A6 Experiences directory (browse-only)
import type { Metadata } from 'next'
import ExperienceCard from '@/components/web/ExperienceCard'
import { getExperiences } from '@/lib/web-data'
import { getServerLang } from '@/lib/i18n-server'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Experiences in Negril & Montego Bay',
  description: 'Bundled days in Jamaica built around a mood — sunset dinners, reef snorkels, jerk tours and more, each hosted by a real local vendor.'
}

export default async function ExperiencesPage() {
  const lang = getServerLang()
  const experiences = await getExperiences()
  const cities: Array<{ key: 'NEGRIL' | 'MONTEGO_BAY'; label: string }> = [
    { key: 'NEGRIL', label: 'Negril' },
    { key: 'MONTEGO_BAY', label: 'Montego Bay' }
  ]

  return (
    <div className="w-container" style={{ paddingBottom: 40 }}>
      <header className="w-page-head">
        <p className="w-eyebrow">{experiences.length} {t(lang, 'exp.title').toLowerCase()}</p>
        <h1 className="w-page-title">{t(lang, 'exp.title')}</h1>
        <p className="w-page-dek">{t(lang, 'exp.dek')}</p>
      </header>
      {cities.map(city => {
        const list = experiences.filter(e => e.city === city.key)
        if (list.length === 0) return null
        return (
          <section key={city.key} className="w-section" style={{ paddingTop: 24 }}>
            <h2 className="w-section-title" style={{ marginBottom: 20 }}>{city.label}</h2>
            <div className="w-grid-3">
              {list.map(e => <ExperienceCard key={e.id} experience={e} lang={lang} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}
