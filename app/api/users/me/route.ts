// app/api/users/me/route.ts — the signed-in user's own profile.
// PUT { name?, bio?, homeCountry?, avatarUrl? } → the updated user (no password).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { userIdFromRequest } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)

export async function PUT(request: Request) {
  const userId = userIdFromRequest(request)
  if (!userId) return NextResponse.json({ error: 'Log in to edit your profile' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const data: { name?: string; bio?: string | null; homeCountry?: string | null; avatarUrl?: string | null } = {}
  const name = text(body.name, 60)
  if (name) data.name = name
  if ('bio' in body) data.bio = text(body.bio, 280) || null
  if ('homeCountry' in body) data.homeCountry = text(body.homeCountry, 60) || null
  if (typeof body.avatarUrl === 'string' && body.avatarUrl.startsWith('https://')) data.avatarUrl = body.avatarUrl
  try {
    const user = await prisma.user.update({ where: { id: userId }, data })
    const { password: _password, ...safeUser } = user
    return NextResponse.json({ user: safeUser })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
