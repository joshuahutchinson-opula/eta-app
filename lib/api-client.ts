// lib/api-client.ts — fetch with the signed-in user's token attached, so
// routes that use userIdFromRequest (lib/auth-server.ts) know who's calling.
'use client'

import { getAuthToken } from '@/lib/auth-client'

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken()
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
}

/** JSON in, JSON out. Throws with the server's error message on a non-2xx. */
export async function apiJson<T = any>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
    headers: authHeaders(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'Sumth nah wuk')
  return data as T
}

/** Uploads one photo to Cloudinary through /api/uploads and returns its URL. */
export async function uploadPhoto(file: File, folder: string): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  form.append('folder', folder)
  const res = await fetch('/api/uploads', { method: 'POST', headers: authHeaders(), body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.url) throw new Error(data?.error || 'Photo upload failed')
  return data.url as string
}
