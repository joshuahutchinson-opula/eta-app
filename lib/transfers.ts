// lib/transfers.ts — vetted airport transfers for the arrival flow. Each
// TransferService belongs to a transport vendor and quotes a fixed price:
// baseFare + perKm × the road distance to the stay.
import { prisma } from '@/lib/prisma'
import { AIRPORTS } from '@/lib/arrival'
import { haversineKm } from '@/lib/routing'

/** Island roads wind; straight-line km × this ≈ road km. */
const ROAD_FACTOR = 1.35
/** Average door-to-door speed, km/h. */
const AVG_KMH = 45

export function airportByCode(code: string | null | undefined) {
  return AIRPORTS.find(a => a.code === code?.toUpperCase()) ?? null
}

export function roadTrip(from: { lat: number; lng: number }, to: { lat: number; lng: number }): { km: number; minutes: number } {
  const km = haversineKm(from, to) * ROAD_FACTOR
  return { km: Math.round(km * 10) / 10, minutes: Math.max(10, Math.round((km / AVG_KMH) * 60 / 5) * 5) }
}

export function fareFor(service: { baseFare: number; perKm: number }, km: number): number {
  return Math.round(service.baseFare + service.perKm * km)
}

export async function transferOptions(airportCode: string, to: { lat: number; lng: number }, limit = 3) {
  const airport = airportByCode(airportCode)
  if (!airport) return null
  const trip = roadTrip(airport, to)
  const services = await prisma.transferService.findMany({
    where: { airport: airport.code, active: true },
    orderBy: [{ sortOrder: 'asc' }, { baseFare: 'asc' }],
    take: limit,
    include: { vendor: { select: { id: true, name: true, images: true } } }
  })
  return {
    airport: { code: airport.code, name: airport.name },
    km: trip.km,
    minutes: trip.minutes,
    options: services.map(s => ({
      id: s.id,
      vendor: { id: s.vendor.id, name: s.vendor.name, image: s.vendor.images[0] ?? null },
      vehicle: s.vehicle,
      seats: s.seats,
      readyMinutes: s.readyMinutes,
      driverName: s.driverName,
      driverPhoto: s.driverPhoto,
      price: fareFor(s, trip.km)
    }))
  }
}
