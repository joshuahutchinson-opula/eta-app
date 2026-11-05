// app/api/users/me/route.ts — the signed-in user's own account.
// GET    → the user (no password).
// PUT    { name?, bio?, homeCountry?, avatarUrl?, emergencyContactName?,
//          emergencyContactPhone?, leaderboardOptIn?, notify*?,
//          instagramHandle?, whatsappNumber?, notifyWhatsapp?,
//          tripStart?, tripEnd? (YYYY-MM-DD, Jamaica days),
//          stayName?, stayCity?, stayAccommodationId? } → updated user.
// DELETE { confirm: "DELETE" } → delete the account: personal data is
//          removed or anonymised (see lib/account.ts) and every session ends.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publicUser, requireUser } from '@/lib/auth-server'
import { deleteAccount } from '@/lib/account'
import { dateOnly, httpsUrl, parseBody, text, z } from '@/lib/validate'
import { CITY_CODES } from '@/lib/regions'
import { normalizeHandle } from '@/lib/instagram'
import { normalizePhone } from '@/lib/whatsapp'
import { jamaicaDayStart } from '@/lib/trip-dates'

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
  notifyCrew: z.boolean(),
  notifyTrips: z.boolean(),
  notifyWhatsapp: z.boolean(),
  instagramHandle: z.string().max(80).nullable().transform((v, ctx) => {
    if (!v || !v.trim()) return null
    const h = normalizeHandle(v)
    if (!h) ctx.addIssue({ code: 'custom', message: 'Use your Instagram username, like @yourname' })
    return h
  }),
  whatsappNumber: z.string().max(24).nullable().transform((v, ctx) => {
    if (!v || !v.trim()) return null
    const n = normalizePhone(v)
    if (!n) ctx.addIssue({ code: 'custom', message: 'Use a phone number with country code' })
    return n
  }),
  tripStart: dateOnly.nullable(),
  tripEnd: dateOnly.nullable(),
  stayName: nullableText(120),
  stayCity: z.enum(CITY_CODES as [string, ...string[]]).nullable(),
  stayAccommodationId: z.string().max(64).nullable()
}).partial()

export async function PUT(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to edit your profile' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const { tripStart, tripEnd, stayCity, ...rest } = parsed.data
  const start = tripStart === undefined ? undefined : tripStart ? jamaicaDayStart(tripStart) : null
  const end = tripEnd === undefined ? undefined : tripEnd ? jamaicaDayStart(tripEnd) : null
  if (start && end && end < start) return NextResponse.json({ error: 'The trip can’t end before it starts', code: 'INVALID_BODY' }, { status: 400 })
  if (rest.notifyWhatsapp && rest.whatsappNumber === null) return NextResponse.json({ error: 'Add your WhatsApp number first', code: 'INVALID_BODY' }, { status: 400 })
  try {
    const before = start !== undefined || end !== undefined
      ? await prisma.user.findUnique({ where: { id: auth.user.id }, select: { tripStart: true, tripEnd: true } })
      : null
    const sameTime = (a: Date | null | undefined, b: Date | null | undefined) => (a?.getTime() ?? null) === (b?.getTime() ?? null)
    const datesChanged = Boolean(before) && !((start === undefined || sameTime(start, before!.tripStart)) && (end === undefined || sameTime(end, before!.tripEnd)))
    const data = {
      ...rest,
      ...(start !== undefined ? { tripStart: start } : {}),
      ...(end !== undefined ? { tripEnd: end } : {}),
      ...(stayCity !== undefined ? { stayCity: stayCity as never } : {}),
      // A new trip gets its own "planning your next trip?" nudge later.
      ...(datesChanged ? { homeNudgeSentAt: null } : {})
    }
    const user = await prisma.user.update({ where: { id: auth.user.id }, data })
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
