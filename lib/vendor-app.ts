// lib/vendor-app.ts — the gate for /api/vendor-app/* (the vendor app, not
// built yet): a signed-in ADMIN, or a VENDOR-role user who owns the vendor.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canActForVendor, requireUser, type AuthedUser } from '@/lib/auth-server'

type Access = { ok: true; user: AuthedUser; vendor: { id: string; name: string } } | { ok: false; response: NextResponse }

export async function requireVendorAccess(request: Request, vendorId: string): Promise<Access> {
  const auth = await requireUser(request)
  if (!auth.ok) return auth
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, name: true } })
  if (!vendor) return { ok: false, response: NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 }) }
  if (!(await canActForVendor(auth.user, vendorId))) {
    return { ok: false, response: NextResponse.json({ error: 'Only the vendor or an ETA admin can do that', code: 'FORBIDDEN' }, { status: 403 }) }
  }
  return { ok: true, user: auth.user, vendor }
}
