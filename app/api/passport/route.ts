// GET — the signed-in user's passport (places on a map, counts, streaks, badges).
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { passportFor } from '@/lib/passport'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to see your passport' })
  if (!auth.ok) return auth.response
  try {
    return NextResponse.json(await passportFor(auth.user.id))
  } catch (error) {
    console.error('Error building passport:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
