// lib/format.ts — small display helpers safe for client components.

export function formatCity(city: string): string {
  return city === 'MONTEGO_BAY' ? 'Montego Bay' : city === 'NEGRIL' ? 'Negril' : city
}
