// POST { vendors, experiences, events } — first sign-in on a device: merge
// the saves made there while logged out into the account. Returns the
// account's full saves.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { KIND_TO_DB, savedState } from '@/lib/saved-server'
import { id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const ids = z.array(id).max(300).default([])
const schema = z.object({ vendors: ids, experiences: ids, events: ids })

export async function POST(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    const rows = (Object.keys(KIND_TO_DB) as Array<keyof typeof KIND_TO_DB>).flatMap(k =>
      parsed.data[k].map(refId => ({ userId: auth.user.id, kind: KIND_TO_DB[k], refId }))
    )
    if (rows.length) await prisma.saved.createMany({ data: rows, skipDuplicates: true })
    return NextResponse.json(await savedState(auth.user.id))
  } catch (error) {
    console.error('Error syncing saved:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
