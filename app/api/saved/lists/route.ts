// Saved lists ("Date night", "Day 2").
// GET → the user's lists with their items.  POST { name } → a new list.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { DB_TO_KIND } from '@/lib/saved-server'
import { parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    const lists = await prisma.savedList.findMany({ where: { userId: auth.user.id }, orderBy: { updatedAt: 'desc' }, include: { items: { orderBy: { addedAt: 'desc' } } } })
    return NextResponse.json(lists.map(l => ({ id: l.id, name: l.name, items: l.items.map(i => ({ kind: DB_TO_KIND[i.kind], refId: i.refId })) })))
  } catch (error) {
    console.error('Error fetching lists:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ name: text(40).min(1) }))
  if (!parsed.ok) return parsed.response
  try {
    if ((await prisma.savedList.count({ where: { userId: auth.user.id } })) >= 30) return NextResponse.json({ error: 'That’s plenty of lists' }, { status: 409 })
    const list = await prisma.savedList.create({ data: { userId: auth.user.id, name: parsed.data.name } })
    return NextResponse.json({ id: list.id, name: list.name, items: [] }, { status: 201 })
  } catch (error) {
    console.error('Error creating list:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
