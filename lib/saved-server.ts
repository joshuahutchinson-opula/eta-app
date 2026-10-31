// lib/saved-server.ts — the account's saves, shaped like the client cache.
import type { SavedKind as DbKind } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const KIND_TO_DB = { vendors: 'VENDOR', experiences: 'EXPERIENCE', events: 'EVENT' } as const satisfies Record<string, DbKind>
export const DB_TO_KIND = { VENDOR: 'vendors', EXPERIENCE: 'experiences', EVENT: 'events' } as const

export async function savedState(userId: string) {
  const rows = await prisma.saved.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { kind: true, refId: true } })
  return {
    vendors: rows.filter(r => r.kind === 'VENDOR').map(r => r.refId),
    experiences: rows.filter(r => r.kind === 'EXPERIENCE').map(r => r.refId),
    events: rows.filter(r => r.kind === 'EVENT').map(r => r.refId)
  }
}
