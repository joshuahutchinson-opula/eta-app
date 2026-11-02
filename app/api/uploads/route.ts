// app/api/uploads/route.ts — one photo or short video in (multipart "file"),
// its Cloudinary URL out. Signed in only, and throttled per user.
// Used by stories, profile photos, photo spot moments and mood media.
// Videos (stories only) come back with a poster frame.
import { NextResponse } from 'next/server'
import { isAcceptableImage, isAcceptableVideo, uploadImage, uploadVideo } from '@/lib/cloudinary-upload'
import { requireUser } from '@/lib/auth-server'
import { rateLimit } from '@/lib/rate-limit'
import { z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const FOLDERS = ['stories', 'avatars', 'moments', 'mood-media', 'hidden-gems']
const VIDEO_FOLDERS = ['stories', 'mood-media']

export async function POST(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to upload' })
  if (!auth.ok) return auth.response
  const limited = rateLimit('upload', auth.user.id)
  if (limited) return limited
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Send the file as a form upload' }, { status: 400 })
  }
  const file = form.get('file')
  const folder = z.string().max(40).catch('uploads').parse(form.get('folder'))
  if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
    return NextResponse.json({ error: 'Pick a photo first' }, { status: 400 })
  }
  const f = file as File
  const target = FOLDERS.includes(folder) ? folder : 'uploads'
  try {
    if (f.type.startsWith('video/')) {
      if (!VIDEO_FOLDERS.includes(target)) return NextResponse.json({ error: 'Only photos can go here' }, { status: 400 })
      if (!isAcceptableVideo(f)) return NextResponse.json({ error: 'Videos must be MP4, MOV or WebM, 50 MB or less' }, { status: 400 })
      const { url, poster } = await uploadVideo(f, target, ['user-upload'])
      return NextResponse.json({ url, poster, kind: 'video' })
    }
    if (!isAcceptableImage(f)) return NextResponse.json({ error: 'Photos must be JPEG, PNG, WebP or HEIC, 8 MB or less' }, { status: 400 })
    const url = await uploadImage(f, target, ['user-upload'])
    return NextResponse.json({ url, kind: 'image' })
  } catch (error) {
    console.error('Upload failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 500 })
  }
}
