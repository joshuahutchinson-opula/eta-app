// lib/map-types.ts — the vendor and photo spot shapes the map screens load
// (/api/vendors, /api/photospots).

export interface MapVendor {
  id: string
  name: string
  category: string
  neighborhood: string
  city?: string
  lat: number
  lng: number
  isPremium: boolean
  isTransport: boolean
  visibleOnMap: boolean
  images?: string[]
  priceRange?: string
  rating?: number | null
  reviewCount?: number | null
  /** Opening hours (lib/hours.ts shape). */
  hours?: unknown
}

export interface MapPhotoSpot {
  id: string
  name: string
  description: string
  city?: string
  lat: number
  lng: number
  officialPhoto?: string
}
