// app/web/photo-spots/[id]/page.tsx — photo spot detail: gallery, videos, best time and directions
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import MediaGallery from '@/components/web/MediaGallery'
import PhotoSpotTile from '@/components/web/PhotoSpotTile'
import Icon from '@/lib/icons'
import { getPhotoSpot, getPhotoSpots, formatCity } from '@/lib/web-data'
import { getServerLang } from '@/lib/i18n-server'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const s = await getPhotoSpot(params.id)
  if (!s) return { title: 'Photo spot not found' }
  return { title: `${s.name} — ${formatCity(s.city)}`, description: s.description, openGraph: { images: [s.officialPhoto] } }
}

export default async function PhotoSpotDetailPage({ params }: { params: { id: string } }) {
  const lang = getServerLang()
  const [spot, all] = await Promise.all([getPhotoSpot(params.id), getPhotoSpots()])
  if (!spot) notFound()

  const images = spot.gallery.length > 0 ? spot.gallery : [spot.officialPhoto]
  // Same city first, then spots that have their own media.
  const more = all
    .filter(s => s.id !== spot.id)
    .sort((a, b) => Number(b.city === spot.city) - Number(a.city === spot.city) || b.gallery.length - a.gallery.length)
    .slice(0, 4)

  return (
    <div className="w-container">
      <nav aria-label="Breadcrumb" style={{ paddingTop: 24, fontSize: 14 }} className="w-faint">
        <Link href="/web/photo-spots" className="w-muted">{t(lang, 'spots.title')}</Link>{' / '}<span>{spot.name}</span>
      </nav>
      <div className="w-detail">
        <div>
          <MediaGallery name={spot.name} images={images} videos={spot.videos} leadWith="images" />
          <h1 className="w-detail-title">{spot.name}</h1>
          <div className="w-detail-meta">
            <span>{formatCity(spot.city)}</span>
            <span>☀ {t(lang, 'spots.bestTime')}: {spot.bestTime}</span>
            <span className="w-faint">
              {t(lang, 'spots.photos', { n: images.length })}
              {spot.videos.length > 0 ? ` · ${t(lang, 'spots.videos', { n: spot.videos.length })}` : ''}
            </span>
          </div>
          <div className="w-prose" style={{ marginTop: 20 }}>
            <p>{spot.description}</p>
          </div>
        </div>

        <aside className="w-aside">
          <div className="w-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px 16px', fontSize: 15 }}>
              <dt className="w-faint">{t(lang, 'spots.bestTime')}</dt><dd>{spot.bestTime}</dd>
              <dt className="w-faint">{t(lang, 'spots.where')}</dt><dd>{formatCity(spot.city)} · {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}</dd>
            </dl>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-btn w-btn-primary w-btn-block"
            >
              <Icon name="compass" size={18} /> {t(lang, 'spots.openMaps')}
            </a>
            <div>
              <Link href={`/photospot/${spot.id}`} className="w-btn w-btn-ghost w-btn-block">
                <Icon name="camera" size={18} /> {t(lang, 'spots.addShot')}
              </Link>
              <p className="w-faint" style={{ fontSize: 13, marginTop: 10, textAlign: 'center' }}>{t(lang, 'spots.addShotHelp')}</p>
            </div>
          </div>
        </aside>
      </div>

      {more.length > 0 ? (
        <section className="w-section">
          <h2 className="w-section-title" style={{ marginBottom: 20 }}>{t(lang, 'spots.more')}</h2>
          <div className="w-grid-4">{more.map(s => <PhotoSpotTile key={s.id} spot={s} lang={lang} fixedHeight={300} />)}</div>
        </section>
      ) : null}
    </div>
  )
}
