import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  type: z.enum(['traveler', 'vendor']).default('traveler'),
  source: z.string().max(64).optional()
})

// POST /api/waitlist — traveler launch waitlist and vendor applications.
// Re-submitting the same email is a no-op success, not an error.
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }
  try {
    const { email, type, source } = parsed.data
    await prisma.waitlistEntry.upsert({
      where: { email_type: { email, type } },
      create: { email, type, source },
      update: {}
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Waitlist error:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
