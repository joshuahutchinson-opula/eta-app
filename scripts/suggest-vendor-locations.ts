// scripts/suggest-vendor-locations.ts — one-off: look up a suggested pin for
// each vendor from its name + neighborhood + town, and save it as
// UNCONFIRMED (Vendor.locationStatus). Vendors whose pin is CONFIRMED (set by
// the vendor from their phone) are never touched. A vendor confirms or fixes
// the suggestion later from the vendor app ("I'm here now").
//
// Providers (both allow storing the result):
//   osm     OpenStreetMap Nominatim (default). Free; at most 1 request a
//           second, which this script keeps to. Data © OpenStreetMap
//           contributors (ODbL) — keep the attribution on maps that show it.
//           Optional NOMINATIM_EMAIL is sent so Nominatim can reach you.
//   mapbox  Mapbox Geocoding v6 with permanent=true — needs
//           MAPBOX_GEOCODING_TOKEN from an account that has permanent
//           geocoding enabled (it's billed separately).
//
// A result only counts if it's a specific place (not just the town) within
// 25 km of the vendor's town; otherwise the pin is left as it is.
// Dry run by default; pass --apply to save.
// Run: npx tsx scripts/suggest-vendor-locations.ts [--apply] [--provider=osm|mapbox] [--include-mock] [--limit=N]
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { townFor } from '../lib/regions'
import { haversineKm } from '../lib/routing'

const prisma = new PrismaClient()
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const includeMock = args.includes('--include-mock')
const provider = (args.find(a => a.startsWith('--provider='))?.split('=')[1] ?? 'osm') as 'osm' | 'mapbox'
const limit = Number(args.find(a => a.startsWith('--limit='))?.split('=')[1]) || undefined
const MAX_FROM_TOWN_KM = 25

interface Suggestion { lat: number; lng: number; label: string }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function osm(query: string): Promise<Suggestion | null> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', countrycodes: 'jm', limit: '1', addressdetails: '0' })
  if (process.env.NOMINATIM_EMAIL) params.set('email', process.env.NOMINATIM_EMAIL)
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'User-Agent': 'eta-app vendor-location-script/1.0' } })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const [hit] = await res.json() as Array<{ lat: string; lon: string; display_name: string; addresstype?: string }>
  // A town or region match just means "somewhere in Negril".
  if (!hit || ['city', 'town', 'village', 'county', 'state', 'country', 'region', 'municipality'].includes(hit.addresstype ?? '')) return null
  return { lat: Number(hit.lat), lng: Number(hit.lon), label: hit.display_name }
}

async function mapbox(query: string): Promise<Suggestion | null> {
  const token = process.env.MAPBOX_GEOCODING_TOKEN
  if (!token) throw new Error('Set MAPBOX_GEOCODING_TOKEN (an account with permanent geocoding) or use --provider=osm')
  const params = new URLSearchParams({ q: query, country: 'jm', limit: '1', permanent: 'true', access_token: token })
  const res = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`)
  if (!res.ok) throw new Error(`Mapbox ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json() as { features?: Array<{ geometry: { coordinates: [number, number] }; properties: { feature_type?: string; full_address?: string; name?: string } }> }
  const hit = data.features?.[0]
  if (!hit || ['place', 'locality', 'district', 'region', 'country'].includes(hit.properties.feature_type ?? '')) return null
  return { lat: hit.geometry.coordinates[1], lng: hit.geometry.coordinates[0], label: hit.properties.full_address ?? hit.properties.name ?? '' }
}

async function main() {
  const vendors = await prisma.vendor.findMany({
    where: { locationStatus: 'UNCONFIRMED', ...(includeMock ? {} : { isMock: false }) },
    select: { id: true, name: true, neighborhood: true, city: true, lat: true, lng: true },
    orderBy: { name: 'asc' },
    take: limit
  })
  console.log(`${vendors.length} unconfirmed vendors · provider ${provider} · ${apply ? 'APPLYING' : 'dry run (pass --apply to save)'}\n`)
  let saved = 0
  let skipped = 0
  for (const v of vendors) {
    const town = townFor(v.city)
    // Name + neighborhood + town first, then a looser name + town.
    const queries = [[v.name, v.neighborhood, town.name, 'Jamaica'], [v.name.replace(/\s*\(.*?\)\s*/g, ' ').trim(), town.name, 'Jamaica']]
      .map(parts => parts.filter(Boolean).join(', '))
    let s: Suggestion | null = null
    for (const query of Array.from(new Set(queries))) {
      try {
        s = provider === 'mapbox' ? await mapbox(query) : await osm(query)
      } catch (e) {
        console.log(`! ${v.name}: ${(e as Error).message}`)
      }
      if (provider === 'osm') await sleep(1100)
      if (s) break
    }
    if (!s || !Number.isFinite(s.lat) || !Number.isFinite(s.lng)) { skipped++; console.log(`- ${v.name}: no specific match`); continue }
    const fromTown = haversineKm(town, s)
    if (fromTown > MAX_FROM_TOWN_KM) { skipped++; console.log(`- ${v.name}: match is ${fromTown.toFixed(1)} km from ${town.name}, ignored (${s.label})`); continue }
    const moved = haversineKm(v, s)
    console.log(`✓ ${v.name}: ${moved < 1 ? `${Math.round(moved * 1000)} m` : `${moved.toFixed(1)} km`} from the current pin → ${s.lat.toFixed(5)}, ${s.lng.toFixed(5)} (${s.label})`)
    if (apply) {
      // Guarded on UNCONFIRMED, in case the vendor confirmed their pin while this ran.
      const done = await prisma.vendor.updateMany({
        where: { id: v.id, locationStatus: 'UNCONFIRMED' },
        data: { lat: s.lat, lng: s.lng, locationSource: provider === 'mapbox' ? 'geocode_mapbox' : 'geocode_osm', locationAccuracyM: null, locationUpdatedAt: new Date() }
      })
      saved += done.count
    }
  }
  console.log(`\n${apply ? `Saved ${saved}` : `Would save ${vendors.length - skipped}`} · no usable match for ${skipped}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
