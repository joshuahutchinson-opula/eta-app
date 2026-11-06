// app/api/gems/route.ts — Hidden Gems (Explore mode's secret spots).
// POST multipart → submit a new gem (signed in; at least one photo).
// There is deliberately no GET: a gem's name and exact location only ever
// reach the phone through Explore mode's proximity reveal (POST
// /api/explore/ping, checked on the server within REVEAL_RADIUS_M) or, for
// the person who submitted it, in /api/explore's state.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { rateLimit } from '@/lib/rate-limit'
import { isAcceptableImage, uploadImage } from '@/lib/cloudinary-upload'
import { GEM_CATEGORIES, MAX_SUBMISSIONS_PER_DAY, VERIFY_THRESHOLD, type GemCategoryKey } from '@/lib/hidden-gems'

import { z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const fieldsSchema = z.object({
  name: z.string().trim().min(3, 'Give it a name').max(80),
  description: z.string().trim().min(10, 'Tell people what it is (a sentence or two)').max(1000),
  category: z.enum(GEM_CATEGORIES, { errorMap: () => ({ message: 'Pick a category' }) }),
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180)
})

export interface GemView {
  id: string
  name: string
  category: GemCategoryKey
  description: string
  lat: number
  lng: number
  photos: string[]
  status: 'PENDING' | 'VERIFIED' | 'REJECTED'
  confirmationCount: number
  threshold: number
  isMine: boolean
  confirmedByMe: boolean
}

export async function POST(request: Request) {
  const auth = await requireUser(request, { verified: true, message: 'Log in to add a hidden gem' })
  if (!auth.ok) return auth.response
  const userId = auth.user.id
  const limited = rateLimit('upload', userId)
  if (limited) return limited

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Send the gem as a form with photos' }, { status: 400 })
  }

  const fields = fieldsSchema.safeParse({ name: form.get('name') ?? '', description: form.get('description') ?? '', category: form.get('category') ?? '', lat: form.get('lat') ?? '', lng: form.get('lng') ?? '' })
  if (!fields.success) {
    const issue = fields.error.issues[0]
    const message = issue?.path[0] === 'lat' || issue?.path[0] === 'lng' ? 'Drop a pin or use your location' : issue?.message ?? 'Check the details'
    return NextResponse.json({ error: message, code: 'INVALID_BODY' }, { status: 400 })
  }
  const { name, description, category, lat, lng } = fields.data
  const photos = form.getAll('photos').filter((p): p is File => typeof p === 'object' && p !== null && 'arrayBuffer' in p).slice(0, 4)

  if (photos.length === 0) return NextResponse.json({ error: 'Add at least one photo' }, { status: 400 })
  if (!photos.every(isAcceptableImage)) return NextResponse.json({ error: 'Photos must be JPEG, PNG, WebP or HEIC, 8 MB or less' }, { status: 400 })

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) return NextResponse.json({ error: 'Log in to add a hidden gem' }, { status: 401 })
    const today = await prisma.hiddenGem.count({ where: { submittedByUserId: userId, createdAt: { gt: new Date(Date.now() - 86400000) } } })
    if (today >= MAX_SUBMISSIONS_PER_DAY) return NextResponse.json({ error: 'That’s plenty of gems for one day — try again tomorrow' }, { status: 429 })

    const urls = await Promise.all(photos.map(p => uploadImage(p, 'hidden-gems', ['hidden-gem', 'user-submitted'])))
    const gem = await prisma.hiddenGem.create({
      data: { name, description, category, lat, lng, photos: urls, submittedByUserId: userId }
    })
    const view: GemView = {
      id: gem.id, name: gem.name, category: gem.category, description: gem.description, lat: gem.lat, lng: gem.lng,
      photos: gem.photos, status: gem.status, confirmationCount: 0, threshold: VERIFY_THRESHOLD,
      isMine: true, confirmedByMe: false
    }
    return NextResponse.json({ gem: view }, { status: 201 })
  } catch (error) {
    console.error('Error submitting gem:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Sumth nah wuk' }, { status: 500 })
  }
}
