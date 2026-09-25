// lib/cloudinary-upload.ts — signed server-side image upload to Cloudinary,
// using CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.
import crypto from 'crypto'

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export function isAcceptableImage(file: File): boolean {
  return IMAGE_TYPES.includes(file.type) && file.size > 0 && file.size <= MAX_UPLOAD_BYTES
}

export async function uploadImage(file: File, folder: string, tags: string[] = []): Promise<string> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME
  const key = process.env.CLOUDINARY_API_KEY
  const secret = process.env.CLOUDINARY_API_SECRET
  if (!cloud || !key || !secret) throw new Error('Photo uploads aren’t set up on this server')

  const params: Record<string, string> = {
    asset_folder: folder,
    tags: tags.join(','),
    timestamp: String(Math.floor(Date.now() / 1000))
  }
  const toSign = Object.keys(params).sort().filter(k => params[k]).map(k => `${k}=${params[k]}`).join('&')
  const form = new FormData()
  for (const [k, v] of Object.entries(params)) if (v) form.append(k, v)
  form.append('api_key', key)
  form.append('signature', crypto.createHash('sha1').update(toSign + secret).digest('hex'))
  form.append('file', file)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: form })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'Photo upload failed')
  // Serve a web-sized, auto-format copy.
  return String(data.secure_url).replace('/upload/', '/upload/f_auto,q_auto,c_limit,w_1600/')
}
