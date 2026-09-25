// components/web/PhotoSpotTile.tsx
import Link from 'next/link'
import { t, type Lang } from '@/lib/i18n'
import { formatCity } from '@/lib/format'
import type { PhotoSpotData } from '@/lib/web-data'

/** Image tile with best-time + location overlay; used in the masonry guide, home rail and editorial rows. */
export default function PhotoSpotTile({ spot, lang = 'en', fixedHeight }: { spot: PhotoSpotData; lang?: Lang; fixedHeight?: number }) {
  return (
    <Link
      href={`/web/photo-spots/${spot.id}`}
      className="w-spot"
      style={fixedHeight ? { height: fixedHeight, marginBottom: 0 } : undefined}
      aria-label={`${spot.name} — ${t(lang, 'spots.bestTime')}: ${spot.bestTime}`}
    >
      <img
        src={spot.officialPhoto}
        alt={spot.name}
        loading="lazy"
        style={fixedHeight ? { height: '100%', objectFit: 'cover' } : undefined}
      />
      {spot.videos.length > 0 || spot.gallery.length > 1 ? (
        <span className="w-spot-media" aria-hidden>
          {spot.videos.length > 0 ? <span>▶ {spot.videos.length}</span> : null}
          {spot.gallery.length > 1 ? <span>▦ {spot.gallery.length}</span> : null}
        </span>
      ) : null}
      <div className="w-spot-body">
        <span className="w-spot-time">☀ {t(lang, 'spots.bestTime')}: {spot.bestTime}</span>
        <h3>{spot.name}</h3>
        <p>{formatCity(spot.city)}{spot.momentCount > 0 ? ` · ${spot.momentCount} traveler ${spot.momentCount === 1 ? 'photo' : 'photos'}` : ''}</p>
      </div>
    </Link>
  )
}
