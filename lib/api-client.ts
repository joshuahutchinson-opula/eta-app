// lib/api-client.ts — fetch with the signed-in user's token attached, so
// routes that use requireUser (lib/auth-server.ts) know who's calling.
'use client'

import { getAuthToken } from '@/lib/auth-client'
import { ApiError, responseError } from '@/lib/errors'

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken()
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
}

/** JSON in, JSON out. Throws an ApiError (message, status, code) on a non-2xx; show it with errorText(). */
export async function apiJson<T = any>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
    headers: authHeaders(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined
  })
  if (!res.ok) throw await responseError(res)
  return (await res.json().catch(() => ({}))) as T
}

/** Uploads one photo (or a story video) to Cloudinary through /api/uploads. */
export async function uploadMedia(file: File, folder: string): Promise<{ url: string; poster?: string; kind: 'image' | 'video' }> {
  const form = new FormData()
  form.append('file', file)
  form.append('folder', folder)
  const res = await fetch('/api/uploads', { method: 'POST', headers: authHeaders(), body: form })
  if (!res.ok) throw await responseError(res)
  const data = await res.json()
  if (!data.url) throw new ApiError('Upload failed', 500)
  return data
}

/** Uploads one photo and returns its URL. */
export async function uploadPhoto(file: File, folder: string): Promise<string> {
  return (await uploadMedia(file, folder)).url
}
