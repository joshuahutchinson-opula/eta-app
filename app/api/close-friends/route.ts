// /api/close-friends (signed in) — who sees the caller's "Close friends"
// stories. Candidates are people they've travelled with (members of the
// same trips or crew outings), so nobody has to search for strangers.
// GET → { friends: [...ids], people: [{ id, name, avatarUrl }] }
// PUT { friendIds } → replaces the list.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

async function people(userId: string) {
  const [travel, crews, current] = await Promise.all([
    prisma.travelTrip.findMany({ where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] }, select: { ownerId: true, members: { select: { userId: true } } } }),
    prisma.trip.findMany({ where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] }, select: { ownerId: true, members: { select: { userId: true } } } }),
    prisma.closeFriend.findMany({ where: { ownerId: userId }, select: { friendId: true } })
  ])
  const ids = new Set<string>()
  for (const t of [...travel, ...crews]) {
    if (t.ownerId) ids.add(t.ownerId)
    for (const m of t.members) if (m.userId) ids.add(m.userId)
  }
  for (const c of current) ids.add(c.friendId)
  ids.delete(userId)
  const users = await prisma.user.findMany({ where: { id: { in: Array.from(ids) }, deletedAt: null }, select: { id: true, name: true, avatarUrl: true } })
  return { friends: current.map(c => c.friendId), people: users.map(u => ({ id: u.id, name: u.name.split(' ')[0], avatarUrl: u.avatarUrl })) }
}

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  return NextResponse.json(await people(auth.user.id))
}

export async function PUT(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ friendIds: z.array(id).max(300) }))
  if (!parsed.ok) return parsed.response
  const { people: allowed } = await people(auth.user.id)
  const ok = parsed.data.friendIds.filter(f => allowed.some(p => p.id === f))
  await prisma.$transaction([
    prisma.closeFriend.deleteMany({ where: { ownerId: auth.user.id, friendId: { notIn: ok } } }),
    prisma.closeFriend.createMany({ data: ok.map(friendId => ({ ownerId: auth.user.id, friendId })), skipDuplicates: true })
  ])
  return NextResponse.json(await people(auth.user.id))
}
