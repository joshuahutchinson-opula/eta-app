// app/web/photo-spots/page.tsx — A5 Photo spots guide
import type { Metadata } from 'next'
import PhotoSpotTile from '@/components/web/PhotoSpotTile'
import { getPhotoSpots } from '@/lib/web-data'
import { getServerLang } from '@/lib/i18n-server'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Photo spots in Negril & Montego Bay',
  description: 'Every photo spot on the ETA map — cliffs, sunsets, beaches and hidden corners — with the best time of day to shoot each one.'
}

export default async function PhotoSpotsPage() {
  const lang = getServerLang()
  const spots = await getPhotoSpots()
  const negril = spots.filter(s => s.city === 'NEGRIL').length

  return (
    <div className="w-container">
      <header className="w-page-head">
        <p className="w-eyebrow">{spots.length} spots · {negril} in Negril · {spots.length - negril} in Montego Bay</p>
        <h1 className="w-page-title">{t(lang, 'spots.title')}</h1>
        <p className="w-page-dek">{t(lang, 'spots.dek')}</p>
      </header>
      <div className="w-masonry">
        {spots.map(s => <PhotoSpotTile key={s.id} spot={s} lang={lang} />)}
      </div>
    </div>
  )
}
