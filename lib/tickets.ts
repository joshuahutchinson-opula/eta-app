// lib/tickets.ts — in-app event tickets.
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import type { TxClient } from '@/lib/wallet-pay'
import { MAX_TICKETS } from '@/lib/ticket-limits'

export const MAX_TICKETS_PER_ORDER = MAX_TICKETS

/** Null = no capacity listed. */
export async function ticketsLeft(eventId: string, capacity: number | null, db: TxClient = prisma): Promise<number | null> {
  if (capacity === null) return null
  const sold = await db.ticket.aggregate({ where: { eventId, status: { not: 'CANCELLED' } }, _sum: { quantity: true } })
  return Math.max(0, capacity - (sold._sum.quantity ?? 0))
}

/** The code the door scans: TIX- plus 8 random characters. */
export function ticketCode(): string {
  return `TIX-${crypto.randomBytes(5).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, 'X').slice(0, 8)}`
}
