// lib/format.ts — small display helpers safe for client components.
import { cityName } from '@/lib/regions'

export function formatCity(city: string): string {
  return cityName(city)
}
