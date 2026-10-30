// lib/regions.ts — Jamaica's 14 parishes and the tourist towns in each.
// A town is what data is tagged with (the City enum); a parish is just how the
// region selector groups them. Coordinates are town centres, used for
// "nearest town" and as the map/weather centre when a town has no vendors yet.

import { haversineKm, type LatLng } from '@/lib/routing'

export type CityCode =
  | 'NEGRIL' | 'MONTEGO_BAY' | 'SAVANNA_LA_MAR' | 'LUCEA' | 'FALMOUTH' | 'OCHO_RIOS'
  | 'ST_ANNS_BAY' | 'RUNAWAY_BAY' | 'DISCOVERY_BAY' | 'TREASURE_BEACH' | 'BLACK_RIVER'
  | 'MANDEVILLE' | 'MAY_PEN' | 'SPANISH_TOWN' | 'KINGSTON' | 'PORT_ROYAL' | 'MORANT_BAY'
  | 'PORT_ANTONIO' | 'PORT_MARIA' | 'ORACABESSA'

export interface Town {
  city: CityCode
  name: string
  lat: number
  lng: number
}

export interface Parish {
  id: string
  name: string
  towns: Town[]
}

export const PARISHES: Parish[] = [
  { id: 'westmoreland', name: 'Westmoreland', towns: [
    { city: 'NEGRIL', name: 'Negril', lat: 18.2683, lng: -78.3478 },
    { city: 'SAVANNA_LA_MAR', name: 'Savanna-la-Mar', lat: 18.2190, lng: -78.1329 }
  ] },
  { id: 'hanover', name: 'Hanover', towns: [
    { city: 'LUCEA', name: 'Lucea', lat: 18.4510, lng: -78.1736 }
  ] },
  { id: 'st-james', name: 'St. James', towns: [
    { city: 'MONTEGO_BAY', name: 'Montego Bay', lat: 18.4762, lng: -77.8939 }
  ] },
  { id: 'trelawny', name: 'Trelawny', towns: [
    { city: 'FALMOUTH', name: 'Falmouth', lat: 18.4936, lng: -77.6559 }
  ] },
  { id: 'st-ann', name: 'St. Ann', towns: [
    { city: 'OCHO_RIOS', name: 'Ocho Rios', lat: 18.4074, lng: -77.1031 },
    { city: 'ST_ANNS_BAY', name: "St. Ann's Bay", lat: 18.4358, lng: -77.2010 },
    { city: 'RUNAWAY_BAY', name: 'Runaway Bay', lat: 18.4596, lng: -77.3326 },
    { city: 'DISCOVERY_BAY', name: 'Discovery Bay', lat: 18.4636, lng: -77.4076 }
  ] },
  { id: 'st-mary', name: 'St. Mary', towns: [
    { city: 'ORACABESSA', name: 'Oracabessa', lat: 18.4053, lng: -76.9468 },
    { city: 'PORT_MARIA', name: 'Port Maria', lat: 18.3700, lng: -76.8903 }
  ] },
  { id: 'portland', name: 'Portland', towns: [
    { city: 'PORT_ANTONIO', name: 'Port Antonio', lat: 18.1760, lng: -76.4500 }
  ] },
  { id: 'st-thomas', name: 'St. Thomas', towns: [
    { city: 'MORANT_BAY', name: 'Morant Bay', lat: 17.8815, lng: -76.4093 }
  ] },
  { id: 'kingston-st-andrew', name: 'Kingston & St. Andrew', towns: [
    { city: 'KINGSTON', name: 'Kingston', lat: 18.0179, lng: -76.8099 },
    { city: 'PORT_ROYAL', name: 'Port Royal', lat: 17.9368, lng: -76.8410 }
  ] },
  { id: 'st-catherine', name: 'St. Catherine', towns: [
    { city: 'SPANISH_TOWN', name: 'Spanish Town', lat: 17.9911, lng: -76.9574 }
  ] },
  { id: 'clarendon', name: 'Clarendon', towns: [
    { city: 'MAY_PEN', name: 'May Pen', lat: 17.9645, lng: -77.2434 }
  ] },
  { id: 'manchester', name: 'Manchester', towns: [
    { city: 'MANDEVILLE', name: 'Mandeville', lat: 18.0420, lng: -77.5071 }
  ] },
  { id: 'st-elizabeth', name: 'St. Elizabeth', towns: [
    { city: 'TREASURE_BEACH', name: 'Treasure Beach', lat: 17.8900, lng: -77.7600 },
    { city: 'BLACK_RIVER', name: 'Black River', lat: 18.0264, lng: -77.8487 }
  ] }
]

export const TOWNS: Town[] = PARISHES.flatMap(p => p.towns)
export const CITY_CODES: CityCode[] = TOWNS.map(t => t.city)
export const DEFAULT_CITY: CityCode = 'NEGRIL'

export function isCityCode(value: unknown): value is CityCode {
  return typeof value === 'string' && (CITY_CODES as string[]).includes(value)
}

/** A request's city param, or the default when it's missing or unknown. */
export function parseCity(value: unknown, fallback: CityCode = DEFAULT_CITY): CityCode {
  return isCityCode(value) ? value : fallback
}

export function townFor(city: string): Town {
  return TOWNS.find(t => t.city === city) ?? TOWNS[0]
}

export function parishFor(city: string): Parish {
  return PARISHES.find(p => p.towns.some(t => t.city === city)) ?? PARISHES[0]
}

export function cityName(city: string): string {
  return TOWNS.find(t => t.city === city)?.name ?? city
}

export function nearestTown(pos: LatLng): Town {
  return TOWNS.reduce((best, t) => (haversineKm(pos, t) < haversineKm(pos, best) ? t : best), TOWNS[0])
}
