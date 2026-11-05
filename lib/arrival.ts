// lib/arrival.ts — the arrival moment: where a first open counts as
// "just landed" (an airport) or "just checked in" (a listed stay or a
// partner property), so the app can set the region and offer a vetted
// transfer and a welcome reward.
import { prisma } from '@/lib/prisma'
import { distanceM } from '@/lib/hidden-gems'
import type { CityCode } from '@/lib/regions'

export interface ArrivalPlace {
  kind: 'airport' | 'hotel'
  name: string
  city: CityCode
  /** Airport code (airports) or the stay's position (hotels). */
  airport?: string
  lat?: number | null
  lng?: number | null
  image?: string | null
  partnerCode?: string | null
  welcomeRewardId?: string | null
}

/** Airports, with the town most arrivals there head for. */
export const AIRPORTS: Array<{ code: string; name: string; lat: number; lng: number; city: CityCode }> = [
  { code: 'MBJ', name: 'Sangster International (MBJ)', lat: 18.5037, lng: -77.9134, city: 'MONTEGO_BAY' },
  { code: 'KIN', name: 'Norman Manley International (KIN)', lat: 17.9357, lng: -76.7875, city: 'KINGSTON' },
  { code: 'OCJ', name: 'Ian Fleming International (OCJ)', lat: 18.4047, lng: -76.9690, city: 'ORACABESSA' },
  { code: 'NEG', name: 'Negril Aerodrome', lat: 18.3428, lng: -78.3356, city: 'NEGRIL' }
]

const AIRPORT_RADIUS_M = 2500
const STAY_RADIUS_M = 250

export async function arrivalPlace(pos: { lat: number; lng: number }): Promise<ArrivalPlace | null> {
  const airport = AIRPORTS.find(a => distanceM(pos, a) <= AIRPORT_RADIUS_M)
  if (airport) return { kind: 'airport', name: airport.name, city: airport.city, airport: airport.code, lat: airport.lat, lng: airport.lng }
  // A rough box first, so the distance check only runs on nearby rows.
  const box = { lat: { gte: pos.lat - 0.01, lte: pos.lat + 0.01 }, lng: { gte: pos.lng - 0.01, lte: pos.lng + 0.01 } }
  const [partners, stays] = await Promise.all([
    prisma.partnerProperty.findMany({ where: { active: true, ...box }, select: { name: true, city: true, code: true, lat: true, lng: true, welcomeRewardId: true, imageUrl: true } }),
    prisma.accommodation.findMany({ where: { ...box, partner: null }, select: { name: true, city: true, lat: true, lng: true } })
  ])
  const partner = partners.find(p => p.lat !== null && p.lng !== null && distanceM(pos, { lat: p.lat, lng: p.lng }) <= STAY_RADIUS_M)
  if (partner) return { kind: 'hotel', name: partner.name, city: partner.city as CityCode, partnerCode: partner.code, welcomeRewardId: partner.welcomeRewardId, lat: partner.lat, lng: partner.lng, image: partner.imageUrl }
  const stay = stays.find(s => distanceM(pos, s) <= STAY_RADIUS_M)
  if (stay) return { kind: 'hotel', name: stay.name, city: stay.city as CityCode, lat: stay.lat, lng: stay.lng }
  return null
}
