// lib/partner-app.ts — the gate for /api/vendor-app/partners/* (the vendor
// app's hotel & villa side): a signed-in ADMIN, or the VENDOR-role user who
// owns the partner property (PartnerProperty.ownerId).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, type AuthedUser } from '@/lib/auth-server'

type Access = { ok: true; user: AuthedUser; property: { id: string; name: string; code: string; city: string } } | { ok: false; response: NextResponse }

export async function requirePartnerAccess(request: Request, propertyId: string): Promise<Access> {
  const auth = await requireUser(request)
  if (!auth.ok) return auth
  const property = await prisma.partnerProperty.findUnique({ where: { id: propertyId }, select: { id: true, name: true, code: true, city: true, ownerId: true } })
  if (!property) return { ok: false, response: NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 }) }
  const allowed = auth.user.role === 'ADMIN' || (auth.user.role === 'VENDOR' && property.ownerId === auth.user.id)
  if (!allowed) return { ok: false, response: NextResponse.json({ error: 'Only the property or an ETA admin can do that', code: 'FORBIDDEN' }, { status: 403 }) }
  const { ownerId: _owner, ...rest } = property
  return { ok: true, user: auth.user, property: rest }
}
