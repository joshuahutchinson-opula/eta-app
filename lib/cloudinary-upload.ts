// lib/cloudinary-upload.ts — signed server-side uploads to Cloudinary,
// using CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.
import crypto from 'crypto'

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']

export function isAcceptableImage(file: File): boolean {
  return IMAGE_TYPES.includes(file.type) && file.size > 0 && file.size <= MAX_UPLOAD_BYTES
}

export function isAcceptableVideo(file: File): boolean {
  return VIDEO_TYPES.includes(file.type) && file.size > 0 && file.size <= MAX_VIDEO_BYTES
}

async function upload(file: File, folder: string, tags: string[], kind: 'image' | 'video') {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME
  const key = process.env.CLOUDINARY_API_KEY
  const secret = process.env.CLOUDINARY_API_SECRET
  if (!cloud || !key || !secret) throw new Error('Uploads aren’t set up on this server')

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

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${kind}/upload`, { method: 'POST', body: form })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'Upload failed')
  return String(data.secure_url)
}

export async function uploadImage(file: File, folder: string, tags: string[] = []): Promise<string> {
  // Serve a web-sized, auto-format copy.
  return (await upload(file, folder, tags, 'image')).replace('/upload/', '/upload/f_auto,q_auto,c_limit,w_1600/')
}

/** Returns the phone-friendly MP4 URL and a poster frame (Cloudinary derives both from the upload). */
export async function uploadVideo(file: File, folder: string, tags: string[] = []): Promise<{ url: string; poster: string }> {
  const raw = await upload(file, folder, tags, 'video')
  const url = raw.replace('/upload/', '/upload/vc_h264,q_auto,c_limit,w_1080/').replace(/\.\w+$/, '.mp4')
  const poster = raw.replace('/upload/', '/upload/so_0,f_jpg,q_auto,c_limit,w_1080/').replace(/\.\w+$/, '.jpg')
  return { url, poster }
}
