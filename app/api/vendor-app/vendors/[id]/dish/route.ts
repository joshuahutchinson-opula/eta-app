// /api/vendor-app/vendors/:id/dish — the vendor's Dish of the Day
// (Vendor.dishOfDay), shown on a plate in Market's Dishes Of The Day. The
// vendor (or an ETA admin) sets it from the vendor app.
// GET → the dish, or null.
// PUT { name, price?, imageUrl?, videoUrl?, note?, prepMinutes? } → the dish.
//   videoUrl  a short loop of the dish (upload it first via /api/uploads);
//             it plays muted inside the plate, the photo is the fallback
//   note      a few words under it ("12 left", "Till noon")
// DELETE → no dish today.
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireVendorAccess } from '@/lib/vendor-app'
import { httpsUrl, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: text(60).min(1),
  price: z.number().finite().min(0).max(10000).nullable().optional(),
  imageUrl: httpsUrl.nullable().optional(),
  videoUrl: httpsUrl.nullable().optional(),
  note: text(30).nullable().optional(),
  prepMinutes: z.number().int().min(1).max(240).nullable().optional()
})

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const v = await prisma.vendor.findUniqueOrThrow({ where: { id: access.vendor.id }, select: { dishOfDay: true } })
  return NextResponse.json(v.dishOfDay ?? null)
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const d = parsed.data
  // Drop empty fields so the stored dish stays tidy.
  const dish = Object.fromEntries(Object.entries({
    name: d.name, price: d.price ?? null, imageUrl: d.imageUrl ?? null, videoUrl: d.videoUrl ?? null, note: d.note || null, prepMinutes: d.prepMinutes ?? null
  }).filter(([, v]) => v !== null))
  const v = await prisma.vendor.update({ where: { id: access.vendor.id }, data: { dishOfDay: dish }, select: { dishOfDay: true } })
  return NextResponse.json(v.dishOfDay)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  await prisma.vendor.update({ where: { id: access.vendor.id }, data: { dishOfDay: Prisma.DbNull } })
  return NextResponse.json({ ok: true })
}
