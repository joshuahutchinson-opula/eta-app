// app/api/uploads/route.ts — one photo in (multipart "file"), its Cloudinary URL out.
// Used by stories, profile photos, photo spot moments and mood media.
import { NextResponse } from 'next/server'
import { isAcceptableImage, uploadImage } from '@/lib/cloudinary-upload'

export const dynamic = 'force-dynamic'

const FOLDERS = ['stories', 'avatars', 'moments', 'mood-media', 'hidden-gems']

export async function POST(request: Request) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Send the photo as a form upload' }, { status: 400 })
  }
  const file = form.get('file')
  const folder = String(form.get('folder') ?? '')
  if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
    return NextResponse.json({ error: 'Pick a photo first' }, { status: 400 })
  }
  if (!isAcceptableImage(file as File)) {
    return NextResponse.json({ error: 'Photos must be JPEG, PNG, WebP or HEIC, 8 MB or less' }, { status: 400 })
  }
  try {
    const url = await uploadImage(file as File, FOLDERS.includes(folder) ? folder : 'uploads', ['user-upload'])
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Upload failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Photo upload failed' }, { status: 500 })
  }
}
