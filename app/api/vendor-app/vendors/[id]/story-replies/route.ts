// /api/vendor-app/vendors/:id/story-replies — replies and emoji reactions
// to the vendor's stories (from the app's story viewer).
// GET  ?unread=1 → newest first, with who sent it (first name) and the story.
// POST { ids } → marks them read.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVendorAccess } from '@/lib/vendor-app'
import { id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const unread = new URL(request.url).searchParams.get('unread') === '1'
  const replies = await prisma.storyReply.findMany({
    where: { story: { vendorId: access.vendor.id }, ...(unread ? { readAt: null } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { name: true, avatarUrl: true } }, story: { select: { id: true, imageUrl: true, createdAt: true } } }
  })
  return NextResponse.json(replies.map(r => ({ id: r.id, text: r.text, emoji: r.emoji, createdAt: r.createdAt, readAt: r.readAt, story: r.story, from: { name: r.user.name.split(' ')[0], avatarUrl: r.user.avatarUrl } })))
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const parsed = await parseBody(request, z.object({ ids: z.array(id).max(200) }))
  if (!parsed.ok) return parsed.response
  const done = await prisma.storyReply.updateMany({ where: { id: { in: parsed.data.ids }, story: { vendorId: access.vendor.id }, readAt: null }, data: { readAt: new Date() } })
  return NextResponse.json({ updated: done.count })
}
