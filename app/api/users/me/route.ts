// app/api/users/me/route.ts — the signed-in user's own account.
// GET    → the user (no password).
// PUT    { name?, bio?, homeCountry?, avatarUrl?, emergencyContactName?,
//          emergencyContactPhone?, leaderboardOptIn?, notify*? } → updated user.
// DELETE { confirm: "DELETE" } → delete the account: personal data is
//          removed or anonymised (see lib/account.ts) and every session ends.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publicUser, requireUser } from '@/lib/auth-server'
import { deleteAccount } from '@/lib/account'
import { httpsUrl, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const user = await prisma.user.findUnique({ where: { id: auth.user.id } })
  return NextResponse.json({ user: user ? publicUser(user) : null })
}

const nullableText = (max: number) => text(max).transform(v => v || null).nullable()

const schema = z.object({
  name: text(60).min(1),
  bio: nullableText(280),
  homeCountry: nullableText(60),
  avatarUrl: httpsUrl,
  emergencyContactName: nullableText(60),
  emergencyContactPhone: z.string().trim().max(24).regex(/^[+\d][\d\s().-]{5,}$|^$/, 'Use a phone number with country code').transform(v => v || null).nullable(),
  leaderboardOptIn: z.boolean(),
  notifyBookings: z.boolean(),
  notifyEvents: z.boolean(),
  notifyDeals: z.boolean(),
  notifyLive: z.boolean(),
  notifyCrew: z.boolean()
}).partial()

export async function PUT(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to edit your profile' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    const user = await prisma.user.update({ where: { id: auth.user.id }, data: parsed.data })
    return NextResponse.json({ user: publicUser(user) })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ confirm: z.literal('DELETE') }))
  if (!parsed.ok) return NextResponse.json({ error: 'Confirm by sending { confirm: "DELETE" }' }, { status: 400 })
  try {
    await deleteAccount(auth.user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Account deletion failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
