// lib/vendor-qr.ts — each vendor's QR card. The card encodes a link to
// /v/<token>, so the phone camera opens ETA straight into the check-in, and
// the in-app scanner reads the same link (or the bare token). The token is
// the secret: it lives in VendorQrCard, never on the Vendor row.
import crypto from 'crypto'
import qrcode from 'qrcode-generator'
import { prisma } from '@/lib/prisma'
import { absoluteUrl } from '@/lib/site-url'

// No 0/O/1/I so the printed fallback code reads cleanly.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function newQrToken(length = 10): string {
  const bytes = crypto.randomBytes(length)
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('')
}

export function qrUrl(token: string): string {
  return absoluteUrl(`/v/${token}`)
}

/** "ABCDE-FGHJK", for typing in when the camera won't scan. */
export function displayCode(token: string): string {
  return token.length > 5 ? `${token.slice(0, 5)}-${token.slice(5)}` : token
}

/** The vendor's card, issued on first request; rotate=true invalidates the old one. */
export async function qrCardFor(vendorId: string, rotate = false) {
  const existing = await prisma.vendorQrCard.findUnique({ where: { vendorId } })
  if (existing && !rotate) return existing
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = newQrToken()
    try {
      return await prisma.vendorQrCard.upsert({
        where: { vendorId },
        create: { vendorId, token },
        update: { token, issuedAt: new Date() }
      })
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2002') throw e
    }
  }
  throw new Error('Could not issue a unique QR token')
}

/**
 * The token inside whatever was scanned or typed: a full /v/<token> link,
 * the bare token, or the printed code with its dash. Null if it isn't one.
 */
export function parseScanned(value: string): string | null {
  const raw = value.trim()
  const fromUrl = raw.match(/\/v\/([A-Za-z0-9-]{6,32})(?:[/?#]|$)/)
  const candidate = (fromUrl ? fromUrl[1] : raw).replace(/-/g, '').toUpperCase()
  return /^[A-Z0-9]{6,32}$/.test(candidate) ? candidate : null
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!))
}

/** A printable card (A6-ish portrait) as SVG: the vendor's name, the QR, and the typed fallback. */
export function qrCardSvg(vendorName: string, token: string): string {
  const qr = qrcode(0, 'M')
  qr.addData(qrUrl(token))
  qr.make()
  const n = qr.getModuleCount()
  const size = 300
  const cell = size / n
  const x0 = 50
  const y0 = 120
  let rects = ''
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${(x0 + c * cell).toFixed(2)}" y="${(y0 + r * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`
    }
  }
  const name = escapeXml(vendorName.length > 34 ? `${vendorName.slice(0, 33)}…` : vendorName)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560" viewBox="0 0 400 560" font-family="Inter, Helvetica, Arial, sans-serif">
  <rect width="400" height="560" rx="24" fill="#FFFFFF"/>
  <rect x="0" y="0" width="400" height="96" rx="24" fill="#B82010"/>
  <rect x="0" y="72" width="400" height="24" fill="#B82010"/>
  <text x="200" y="44" text-anchor="middle" font-size="26" font-weight="800" fill="#FFFFFF" letter-spacing="4">ETA</text>
  <text x="200" y="76" text-anchor="middle" font-size="15" font-weight="600" fill="#FFFFFF">Scan to check in &amp; earn points</text>
  <g fill="#0F0E0C" shape-rendering="crispEdges">${rects}</g>
  <text x="200" y="460" text-anchor="middle" font-size="20" font-weight="700" fill="#0F0E0C">${name}</text>
  <text x="200" y="494" text-anchor="middle" font-size="13" fill="#6B6B6B">Camera won’t scan? Enter this code in ETA:</text>
  <text x="200" y="526" text-anchor="middle" font-size="22" font-weight="700" fill="#0F0E0C" font-family="'Space Mono', monospace" letter-spacing="2">${displayCode(token)}</text>
</svg>`
}
