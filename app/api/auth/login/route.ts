// POST { email, password } → { token, user }. Throttled per IP and per email.
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { publicUser, signSession } from '@/lib/auth-server'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200)
})

export async function POST(request: Request) {
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return NextResponse.json({ error: 'Enter your email and password' }, { status: 400 })
  const { email, password } = parsed.data
  const limited = rateLimit('login', clientIp(request)) ?? rateLimit('login', email)
  if (limited) return limited

  try {
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null } })
    // Same answer for an unknown email and a wrong password.
    const valid = user?.password ? await bcrypt.compare(password, user.password) : false
    if (!user || !valid) return NextResponse.json({ error: 'That email and password don’t match' }, { status: 401 })
    return NextResponse.json({ token: signSession(user), user: publicUser(user) })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
