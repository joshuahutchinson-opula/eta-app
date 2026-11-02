// PATCH { name?, add?: { kind, refId }, remove?: { kind, refId } } — rename a
// list or add/remove an item (adding also saves it). DELETE — remove the list.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { DB_TO_KIND, KIND_TO_DB } from '@/lib/saved-server'
import { id, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const item = z.object({ kind: z.enum(['vendors', 'experiences', 'events']), refId: id })
const schema = z.object({ name: text(40).min(1).optional(), add: item.optional(), remove: item.optional() })

async function ownList(listId: string, userId: string) {
  return prisma.savedList.findFirst({ where: { id: listId, userId } })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    const list = await ownList(params.id, auth.user.id)
    if (!list) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const { name, add, remove } = parsed.data
    if (add) {
      const kind = KIND_TO_DB[add.kind]
      await prisma.saved.upsert({ where: { userId_kind_refId: { userId: auth.user.id, kind, refId: add.refId } }, create: { userId: auth.user.id, kind, refId: add.refId }, update: {} })
      await prisma.savedListItem.upsert({ where: { listId_kind_refId: { listId: list.id, kind, refId: add.refId } }, create: { listId: list.id, kind, refId: add.refId }, update: {} })
    }
    if (remove) await prisma.savedListItem.deleteMany({ where: { listId: list.id, kind: KIND_TO_DB[remove.kind], refId: remove.refId } })
    const updated = await prisma.savedList.update({ where: { id: list.id }, data: { ...(name ? { name } : {}), updatedAt: new Date() }, include: { items: { orderBy: { addedAt: 'desc' } } } })
    return NextResponse.json({ id: updated.id, name: updated.name, items: updated.items.map(i => ({ kind: DB_TO_KIND[i.kind], refId: i.refId })) })
  } catch (error) {
    console.error('Error updating list:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    const deleted = await prisma.savedList.deleteMany({ where: { id: params.id, userId: auth.user.id } })
    if (!deleted.count) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting list:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
