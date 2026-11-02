// lib/list-params.ts — the shared query params list endpoints accept, so
// every screen asks the server for just what it shows:
//   city=NEGRIL           one town (City code)
//   region=westmoreland   every town in a parish
//   category=FOOD,DRINKS  vendor categories
//   ids=a,b,c             specific records (Saved)
//   limit=12              at most this many
import type { City } from '@prisma/client'
import { PARISHES, isCityCode } from '@/lib/regions'

export interface ListParams {
  cities: City[] | null
  categories: string[] | null
  ids: string[] | null
  limit: number | undefined
}

const CATEGORIES = ['FOOD', 'DRINKS', 'ACTIVITY', 'TRANSPORT', 'WELLNESS', 'BEACH', 'ACCOMMODATION', 'OTHER']

export function listParams(url: string, maxLimit = 200): ListParams {
  const q = new URL(url).searchParams
  const city = q.get('city')
  const region = q.get('region')
  const parish = region ? PARISHES.find(p => p.id === region) : null
  const cities = isCityCode(city) ? [city as City] : parish ? parish.towns.map(t => t.city as City) : null
  const list = (k: string) => (q.get(k) ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const categories = list('category').map(c => c.toUpperCase()).filter(c => CATEGORIES.includes(c))
  const ids = list('ids').slice(0, 300)
  const limit = Number(q.get('limit'))
  return {
    cities,
    categories: categories.length ? categories : null,
    ids: ids.length ? ids : null,
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(maxLimit, Math.round(limit)) : undefined
  }
}
