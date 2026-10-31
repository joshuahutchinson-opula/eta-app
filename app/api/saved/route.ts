// GET  → { vendors, experiences, events } — ids the signed-in user saved.
// POST { kind, refId, saved } — save or unsave one thing.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { KIND_TO_DB, savedState } from '@/lib/saved-server'
import { id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    return NextResponse.json(await savedState(auth.user.id))
  } catch (error) {
    console.error('Error fetching saved:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

const schema = z.object({ kind: z.enum(['vendors', 'experiences', 'events']), refId: id, saved: z.boolean() })

export async function POST(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const kind = KIND_TO_DB[parsed.data.kind]
  const where = { userId_kind_refId: { userId: auth.user.id, kind, refId: parsed.data.refId } }
  try {
    if (parsed.data.saved) {
      await prisma.saved.upsert({ where, create: { userId: auth.user.id, kind, refId: parsed.data.refId }, update: {} })
    } else {
      await prisma.saved.deleteMany({ where: { userId: auth.user.id, kind, refId: parsed.data.refId } })
      // Unsaving takes it out of the user's lists too.
      await prisma.savedListItem.deleteMany({ where: { kind, refId: parsed.data.refId, list: { userId: auth.user.id } } })
    }
    return NextResponse.json({ ok: true, saved: parsed.data.saved })
  } catch (error) {
    console.error('Error saving:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
