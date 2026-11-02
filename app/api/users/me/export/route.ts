// GET — "Download my data": everything ETA holds about the signed-in user
// (profile, bookings, tickets, reviews, check-ins, saves...) as a JSON file.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { exportAccount } from '@/lib/account'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    const data = await exportAccount(auth.user.id)
    if (!data) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="eta-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    console.error('Data export failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
