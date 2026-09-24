// components/web/PhotoSpotTile.tsx
import { t, type Lang } from '@/lib/i18n'
import { formatCity, type PhotoSpotData } from '@/lib/web-data'

/** Image tile with best-time + location overlay; used in the masonry guide, home rail and editorial rows. */
export default function PhotoSpotTile({ spot, lang = 'en', fixedHeight }: { spot: PhotoSpotData; lang?: Lang; fixedHeight?: number }) {
  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`}
      target="_blank"
      rel="noopener noreferrer"
      className="w-spot"
      style={fixedHeight ? { height: fixedHeight, marginBottom: 0 } : undefined}
      aria-label={`${spot.name} — ${t(lang, 'spots.bestTime')}: ${spot.bestTime}. Opens in Google Maps`}
    >
      <img
        src={spot.officialPhoto}
        alt={spot.name}
        loading="lazy"
        style={fixedHeight ? { height: '100%', objectFit: 'cover' } : undefined}
      />
      <div className="w-spot-body">
        <span className="w-spot-time">☀ {t(lang, 'spots.bestTime')}: {spot.bestTime}</span>
        <h3>{spot.name}</h3>
        <p>{formatCity(spot.city)}{spot.momentCount > 0 ? ` · ${spot.momentCount} traveler ${spot.momentCount === 1 ? 'photo' : 'photos'}` : ''}</p>
      </div>
    </a>
  )
}
