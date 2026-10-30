// lib/share.ts — native share sheet where there is one, copy-the-link otherwise.
'use client'

export async function shareOrCopy(data: { title: string; text?: string; url: string }): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(data)
      return 'shared'
    } catch (e) {
      // The user closing the sheet isn't a failure worth a fallback.
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared'
    }
  }
  try {
    await navigator.clipboard.writeText(data.url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
