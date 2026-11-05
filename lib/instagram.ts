// lib/instagram.ts — Instagram story mentions of @ETA as social proof.
//
// Instagram's Messaging webhook tells us when someone mentions the ETA
// account in their story (a "story_mention" message attachment carrying the
// story's media URL). We match the sender's username to a traveler's saved
// handle, and the mention to a vendor that traveler QR-scanned at within the
// last INSTAGRAM_MATCH_HOURS. A match goes into that vendor's approval queue;
// once approved it plays in the vendor's ETA story, straight from
// Instagram's URL (the media is never copied), until 24 h after it arrived.
// No matching scan, nothing is kept.
//
// Off until these are set:
//   INSTAGRAM_APP_SECRET    the Meta app secret (signs every webhook call)
//   INSTAGRAM_VERIFY_TOKEN  any string; entered in the Meta dashboard when
//                           subscribing the webhook to /api/webhooks/instagram
//   INSTAGRAM_ACCESS_TOKEN  token for the ETA Instagram account, used to look
//                           up the sender's username
// Optional:
//   INSTAGRAM_GRAPH_URL     default https://graph.instagram.com/v21.0 (use
//                           https://graph.facebook.com/v21.0 with a Page token)
//   INSTAGRAM_MATCH_HOURS   how far back a QR scan can be, default 4
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

export const MENTION_TTL_MS = 24 * 3600000

export function instagramConfigured(): boolean {
  return Boolean(process.env.INSTAGRAM_APP_SECRET && process.env.INSTAGRAM_VERIFY_TOKEN && process.env.INSTAGRAM_ACCESS_TOKEN)
}

function matchWindowMs(): number {
  const h = Number(process.env.INSTAGRAM_MATCH_HOURS)
  return (Number.isFinite(h) && h > 0 && h <= 48 ? h : 4) * 3600000
}

/** "@Some.One " → "some.one"; null when it can't be an Instagram username. */
export function normalizeHandle(value: string | null | undefined): string | null {
  if (!value) return null
  const h = value.trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '').toLowerCase()
  return /^[a-z0-9._]{1,30}$/.test(h) ? h : null
}

/** Checks X-Hub-Signature-256 against the raw body. */
export function validSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.INSTAGRAM_APP_SECRET
  if (!secret || !header?.startsWith('sha256=')) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const given = header.slice(7)
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}

async function usernameFor(igsid: string): Promise<string | null> {
  const base = (process.env.INSTAGRAM_GRAPH_URL || 'https://graph.instagram.com/v21.0').replace(/\/+$/, '')
  try {
    const res = await fetch(`${base}/${encodeURIComponent(igsid)}?fields=username&access_token=${encodeURIComponent(process.env.INSTAGRAM_ACCESS_TOKEN!)}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = await res.json()
    return normalizeHandle(data?.username)
  } catch {
    return null
  }
}

export interface StoryMention { senderId: string; messageId: string | null; mediaUrl: string; at: Date }

/** Every story_mention in a webhook payload. */
export function mentionsIn(payload: unknown): StoryMention[] {
  const out: StoryMention[] = []
  const entries = (payload as { entry?: unknown[] })?.entry
  if (!Array.isArray(entries)) return out
  for (const entry of entries) {
    const messaging = (entry as { messaging?: unknown[] }).messaging
    if (!Array.isArray(messaging)) continue
    for (const m of messaging as Array<{ sender?: { id?: string }; timestamp?: number; message?: { mid?: string; is_echo?: boolean; attachments?: Array<{ type?: string; payload?: { url?: string } }> } }>) {
      if (!m.sender?.id || m.message?.is_echo) continue
      for (const a of m.message?.attachments ?? []) {
        const url = a.payload?.url
        if (a.type === 'story_mention' && typeof url === 'string' && url.startsWith('https://')) {
          out.push({ senderId: m.sender.id, messageId: m.message?.mid ?? null, mediaUrl: url, at: m.timestamp ? new Date(m.timestamp) : new Date() })
        }
      }
    }
  }
  return out
}

function mediaTypeOf(url: string): 'video' | 'image' {
  try { return /\.(mp4|mov|webm)$/i.test(new URL(url).pathname) ? 'video' : 'image' } catch { return 'image' }
}

/**
 * Files one mention into a vendor's approval queue when the sender is a
 * traveler who QR-scanned somewhere recently. Returns what happened.
 */
export async function recordMention(m: StoryMention): Promise<'queued' | 'duplicate' | 'no-user' | 'no-scan'> {
  if (m.messageId && (await prisma.instagramMention.findUnique({ where: { igMessageId: m.messageId }, select: { id: true } }))) return 'duplicate'
  const username = await usernameFor(m.senderId)
  if (!username) return 'no-user'
  const users = await prisma.user.findMany({ where: { instagramHandle: username, deletedAt: null }, select: { id: true } })
  if (!users.length) return 'no-user'
  const scan = await prisma.checkIn.findFirst({
    where: { userId: { in: users.map(u => u.id) }, method: 'qr', vendorId: { not: null }, createdAt: { gte: new Date(m.at.getTime() - matchWindowMs()), lte: new Date(m.at.getTime() + 5 * 60000) } },
    orderBy: { createdAt: 'desc' }
  })
  if (!scan?.vendorId) return 'no-scan'
  try {
    await prisma.instagramMention.create({
      data: {
        igSenderId: m.senderId,
        igUsername: username,
        mediaUrl: m.mediaUrl,
        mediaType: mediaTypeOf(m.mediaUrl),
        igMessageId: m.messageId,
        receivedAt: m.at,
        expiresAt: new Date(m.at.getTime() + MENTION_TTL_MS),
        vendorId: scan.vendorId,
        userId: scan.userId,
        checkInId: scan.id
      }
    })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') return 'duplicate'
    throw e
  }
  return 'queued'
}

/** Approved, unexpired mentions, shaped like stories for the viewer. */
export async function approvedMentionStories(where: { vendorId?: string; vendorCity?: string }) {
  const rows = await prisma.instagramMention.findMany({
    where: {
      status: 'APPROVED',
      expiresAt: { gt: new Date() },
      ...(where.vendorId ? { vendorId: where.vendorId } : {}),
      ...(where.vendorCity ? { vendor: { city: where.vendorCity as never } } : {})
    },
    orderBy: { receivedAt: 'desc' },
    include: { vendor: { select: { id: true, name: true, isPremium: true, images: true, city: true } } }
  })
  return rows.map(r => ({
    id: `ig_${r.id}`,
    source: 'instagram' as const,
    content: '',
    type: 'instagram',
    imageUrl: r.mediaType === 'video' ? r.vendor.images[0] ?? '' : r.mediaUrl,
    videoUrl: r.mediaType === 'video' ? r.mediaUrl : null,
    createdAt: r.receivedAt,
    expiresAt: r.expiresAt,
    vendorId: r.vendorId,
    vendor: { name: r.vendor.name, isPremium: r.vendor.isPremium, images: r.vendor.images, city: r.vendor.city },
    userId: null,
    user: null,
    igUsername: r.igUsername,
    placeVendorId: null,
    eventId: null,
    seen: false
  }))
}
