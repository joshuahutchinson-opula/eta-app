// lib/search.ts — typo tolerance for search. When an exact "contains"
// search finds nothing, look for close spellings instead: Postgres trigram
// similarity (pg_trgm, installed by the launch migration) when it's there,
// otherwise an in-app fuzzy match over names (the tables are small).
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const SIMILARITY_THRESHOLD = 0.3

type Table = 'Vendor' | 'Experience' | 'Accommodation' | 'PhotoSpot' | 'Event' | 'MenuItem'
const NAME_COLUMN: Record<Table, string> = { Vendor: 'name', Experience: 'name', Accommodation: 'name', PhotoSpot: 'name', Event: 'title', MenuItem: 'name' }

let trigramAvailable: boolean | null = null

/** Ids whose name is close to the query, best match first. */
export async function similarIds(table: Table, q: string, limit = 10): Promise<string[]> {
  const col = NAME_COLUMN[table]
  if (trigramAvailable !== false) {
    try {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM ${Prisma.raw(`"${table}"`)}
        WHERE similarity(${Prisma.raw(`"${col}"`)}, ${q}) > ${SIMILARITY_THRESHOLD}
           OR word_similarity(${q}, ${Prisma.raw(`"${col}"`)}) > ${SIMILARITY_THRESHOLD + 0.2}
        ORDER BY greatest(similarity(${Prisma.raw(`"${col}"`)}, ${q}), word_similarity(${q}, ${Prisma.raw(`"${col}"`)})) DESC
        LIMIT ${limit}`)
      trigramAvailable = true
      return rows.map(r => r.id)
    } catch {
      trigramAvailable = false
    }
  }
  return fallbackSimilar(table, q, limit)
}

async function fallbackSimilar(table: Table, q: string, limit: number): Promise<string[]> {
  const rows: Array<{ id: string; name: string }> =
    table === 'Vendor' ? await prisma.vendor.findMany({ where: { visibleInMarketplace: true }, select: { id: true, name: true } })
    : table === 'Experience' ? await prisma.experience.findMany({ select: { id: true, name: true } })
    : table === 'Accommodation' ? await prisma.accommodation.findMany({ select: { id: true, name: true } })
    : table === 'PhotoSpot' ? await prisma.photoSpot.findMany({ select: { id: true, name: true } })
    : table === 'MenuItem' ? await prisma.menuItem.findMany({ where: { available: true }, select: { id: true, name: true } })
    : (await prisma.event.findMany({ where: { startAt: { gte: new Date(Date.now() - 6 * 3600000) } }, select: { id: true, title: true } })).map(e => ({ id: e.id, name: e.title }))
  return rows
    .map(r => ({ id: r.id, score: bestWordScore(q, r.name) }))
    .filter(r => r.score >= 0.7)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => r.id)
}

/** 1 = identical; compares the query with each word (and the whole name). */
export function bestWordScore(query: string, name: string): number {
  const q = query.toLowerCase().trim()
  const candidates = [name.toLowerCase(), ...name.toLowerCase().split(/[^a-z0-9']+/)].filter(Boolean)
  return Math.max(0, ...candidates.map(w => 1 - levenshtein(q, w.slice(0, Math.max(q.length + 2, 1))) / Math.max(q.length, w.length, 1)))
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}
