// prisma/photo-spots.ts — the nine real photo spots (coordinates from OpenStreetMap).
// Shared by seed.ts and scripts/sync-photo-spot-media.ts so a reseed and the
// live data agree. Covers, galleries and videos live in photo-spot-media.ts.
import { City } from '@prisma/client'

export const PHOTO_SPOTS = [
  {
    name: "Rick's Café sunset",
    description: 'The most famous sunset-watching spot in Negril — gets crowded, arrive early.',
    lat: 18.2542,
    lng: -78.3633,
    bestTime: 'Sunset',
    city: City.NEGRIL,
  },
  {
    name: 'West End cliffs',
    description: 'Rugged limestone cliffs with dramatic views, less touristy than the beach.',
    lat: 18.2600,
    lng: -78.3555,
    bestTime: 'Golden Hour',
    city: City.NEGRIL,
  },
  {
    name: 'Seven Mile Beach panorama',
    description: 'Classic white sand and turquoise water panorama.',
    lat: 18.3074,
    lng: -78.3386,
    bestTime: 'Morning',
    city: City.NEGRIL,
  },
  {
    name: 'Negril Lighthouse grounds',
    description: 'Quiet, uncrowded sunset views away from the crowds.',
    lat: 18.2485,
    lng: -78.3606,
    bestTime: 'Sunset',
    city: City.NEGRIL,
  },
  {
    name: 'Booby Cay Island',
    description: 'Small island with beach views back toward Negril.',
    lat: 18.3382,
    lng: -78.3476,
    bestTime: 'Midday',
    city: City.NEGRIL,
  },
  {
    name: 'Blue Hole Mineral Spring',
    description: 'Turquoise pool in a limestone grotto. Small, local, off the beaten path — cliff jump or ladder in.',
    lat: 18.2290,
    lng: -78.2832,
    bestTime: 'Midday',
    city: City.NEGRIL,
  },
  {
    name: 'Royal Palm Reserve boardwalk',
    description: 'Peaceful wetland and mangrove views, good birdwatching.',
    lat: 18.2925,
    lng: -78.3176,
    bestTime: 'Morning',
    city: City.NEGRIL,
  },
  {
    name: "Doctor's Cave Sand",
    description: 'The whitest sand in Jamaica.',
    lat: 18.4882,
    lng: -77.9292,
    bestTime: 'Morning',
    city: City.MONTEGO_BAY,
  },
  {
    name: 'Mayfield Falls',
    description: 'Twenty-one cascades and natural pools on the Mayfield River in the Westmoreland hills, about an hour from Negril. Wade upriver with a guide, swim the pools and float the lower stretch on a tube.',
    lat: 18.3510,
    lng: -78.0810,
    bestTime: 'Morning',
    city: City.NEGRIL,
  },
]
