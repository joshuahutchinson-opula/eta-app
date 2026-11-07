// scripts/import-town-media.ts — takes the picks from the review page
// (scripts/fetch-town-media.ts → town-media-picks.json), uploads each one
// to Cloudinary from its source, and saves it as Home's hero media
// (TownMedia) for its town and daypart, with the photographer, source page
// and licence (the hero shows "Photo: <name> / Pexels" small).
//   Videos  served as H.264, muted, a 15s loop, at 1080p (url) and 720p (urlSd)
//   Photos  served 2000px wide
// Re-importing the same source replaces its rows.
//   npx tsx scripts/import-town-media.ts scripts/out/town-media-picks.json
import 'dotenv/config'
import crypto from 'crypto'
import fs from 'fs'
import { PrismaClient } from '@prisma/client'
import type { Candidate } from './fetch-town-media'

const prisma = new PrismaClient()
const LOOP_SECONDS = 15

async function uploadRemote(file: string, kind: 'image' | 'video', publicId: string): Promise<{ base: string; version: string }> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME
  const key = process.env.CLOUDINARY_API_KEY
  const secret = process.env.CLOUDINARY_API_SECRET
  if (!cloud || !key || !secret) throw new Error('Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env')
  const params: Record<string, string> = { asset_folder: 'town-media', overwrite: 'true', public_id: publicId, tags: 'town-media,hero', timestamp: String(Math.floor(Date.now() / 1000)) }
  const toSign = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
  const form = new FormData()
  for (const [k, v] of Object.entries(params)) form.append(k, v)
  form.append('api_key', key)
  form.append('signature', crypto.createHash('sha1').update(toSign + secret).digest('hex'))
  form.append('file', file)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${kind}/upload`, { method: 'POST', body: form })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `Upload failed (${res.status})`)
  return { base: `https://res.cloudinary.com/${cloud}/${kind}/upload`, version: `v${data.version}/${data.public_id}` }
}

async function main() {
  const file = process.argv[2]
  if (!file || !fs.existsSync(file)) { console.error('Usage: npx tsx scripts/import-town-media.ts <town-media-picks.json>'); process.exit(1) }
  const picks: Candidate[] = JSON.parse(fs.readFileSync(file, 'utf-8'))
  const order: Record<string, number> = {}
  for (const c of picks) {
    const publicId = `town-media/${c.town.toLowerCase()}-${c.daypart}-${c.source.toLowerCase()}-${c.id.split('-')[2]}`
    process.stdout.write(`${c.town} · ${c.daypart} · ${c.kind} · ${c.photographer} … `)
    try {
      const { base, version } = await uploadRemote(c.file, c.kind === 'video' ? 'video' : 'image', publicId)
      let url: string, urlSd: string | null = null, poster: string | null = null
      if (c.kind === 'video') {
        const cut = c.duration && c.duration > 20 ? `,du_${LOOP_SECONDS}` : ''
        url = `${base}/c_limit,h_1080,vc_h264,ac_none,q_auto${cut}/${version}.mp4`
        urlSd = `${base}/c_limit,h_720,vc_h264,ac_none,q_auto${cut}/${version}.mp4`
        poster = `${base}/so_0,f_jpg,q_auto,c_limit,w_1600/${version}.jpg`
      } else {
        url = `${base}/f_auto,q_auto,c_limit,w_2000/${version}`
      }
      const key = `${c.town}:${c.daypart}`
      order[key] = (order[key] ?? -1) + 1
      await prisma.townMedia.deleteMany({ where: { sourceUrl: c.sourceUrl, city: c.town as never, daypart: c.daypart } })
      await prisma.townMedia.create({
        data: { city: c.town as never, daypart: c.daypart, kind: c.kind, url, urlSd, poster, credit: c.photographer, source: c.source, sourceUrl: c.sourceUrl, license: c.license, sortOrder: order[key], active: true }
      })
      console.log('done')
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message : e}`)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
