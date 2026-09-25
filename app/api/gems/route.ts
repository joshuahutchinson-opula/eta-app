// app/api/gems/route.ts — Hidden Gems for the Discover map.
// GET  ?lat=&lng=  → gems revealed near that position, fog cells for the rest,
//                    and the caller's own submissions (see lib/hidden-gems.ts).
// POST multipart   → submit a new gem (signed in; at least one photo).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { userIdFromRequest } from '@/lib/auth-server'
import { isAcceptableImage, uploadImage } from '@/lib/cloudinary-upload'
import {
  GEM_CATEGORIES, MAX_SUBMISSIONS_PER_DAY, REVEAL_RADIUS_M, VERIFY_THRESHOLD,
  distanceM, fogCell, parseCoord, type GemCategoryKey
} from '@/lib/hidden-gems'

export const dynamic = 'force-dynamic'

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
  /** Metres from the position in the request; null when no position was sent. */
  distanceM: number | null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const lat = parseCoord(url.searchParams.get('lat'), -90, 90)
  const lng = parseCoord(url.searchParams.get('lng'), -180, 180)
  const here = lat !== null && lng !== null ? { lat, lng } : null
  const userId = userIdFromRequest(request)

  try {
    const gems = await prisma.hiddenGem.findMany({
      where: { status: { not: 'REJECTED' } },
      include: userId ? { confirmations: { where: { userId }, select: { id: true } } } : undefined
    })

    const revealed: GemView[] = []
    const fog = new Map<string, { lat: number; lng: number; count: number }>()
    for (const g of gems) {
      const isMine = g.submittedByUserId === userId
      const dist = here ? Math.round(distanceM(here, g)) : null
      const inRange = dist !== null && dist <= REVEAL_RADIUS_M
      if (isMine || inRange) {
        const confirmations = (g as typeof g & { confirmations?: unknown[] }).confirmations ?? []
        revealed.push({
          id: g.id, name: g.name, category: g.category, description: g.description, lat: g.lat, lng: g.lng,
          photos: g.photos, status: g.status, confirmationCount: g.confirmationCount, threshold: VERIFY_THRESHOLD,
          isMine, confirmedByMe: confirmations.length > 0, distanceM: dist
        })
      } else if (g.status === 'VERIFIED') {
        const cell = fogCell(g.lat, g.lng)
        const key = `${cell.lat.toFixed(3)},${cell.lng.toFixed(3)}`
        fog.set(key, { ...cell, count: (fog.get(key)?.count ?? 0) + 1 })
      }
    }

    return NextResponse.json({ revealed, fog: Array.from(fog.values()), revealRadiusM: REVEAL_RADIUS_M })
  } catch (error) {
    console.error('Error fetching gems:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const userId = userIdFromRequest(request)
  if (!userId) return NextResponse.json({ error: 'Log in to add a hidden gem' }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Send the gem as a form with photos' }, { status: 400 })
  }

  const name = String(form.get('name') ?? '').trim().slice(0, 80)
  const description = String(form.get('description') ?? '').trim().slice(0, 1000)
  const category = String(form.get('category') ?? '') as GemCategoryKey
  const lat = parseCoord(form.get('lat'), -90, 90)
  const lng = parseCoord(form.get('lng'), -180, 180)
  const photos = form.getAll('photos').filter((p): p is File => typeof p === 'object' && p !== null && 'arrayBuffer' in p).slice(0, 4)

  if (name.length < 3) return NextResponse.json({ error: 'Give it a name' }, { status: 400 })
  if (description.length < 10) return NextResponse.json({ error: 'Tell people what it is (a sentence or two)' }, { status: 400 })
  if (!GEM_CATEGORIES.includes(category)) return NextResponse.json({ error: 'Pick a category' }, { status: 400 })
  if (lat === null || lng === null) return NextResponse.json({ error: 'Drop a pin or use your location' }, { status: 400 })
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
      isMine: true, confirmedByMe: false, distanceM: null
    }
    return NextResponse.json({ gem: view }, { status: 201 })
  } catch (error) {
    console.error('Error submitting gem:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Sumth nah wuk' }, { status: 500 })
  }
}
