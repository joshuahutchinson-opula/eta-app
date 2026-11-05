// lib/partners.ts — hotel and villa partner codes. A property hands guests
// its code (or a QR linking to /p/<code>); entering it presets the region,
// hands out the property's welcome perk, and records the property as the
// guest's referrer. The first property a guest joins through keeps the
// credit.
import qrcode from 'qrcode-generator'
import { prisma } from '@/lib/prisma'
import { absoluteUrl } from '@/lib/site-url'
import { claimWelcome, welcomeRewardFor } from '@/lib/welcome'

/** "sea splash!" → "SEASPLASH"; null when nothing usable is left. */
export function normalizeCode(value: string | null | undefined): string | null {
  const code = (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return code.length >= 3 && code.length <= 24 ? code : null
}

export function partnerUrl(code: string): string {
  return absoluteUrl(`/p/${code}`)
}

export async function findPartner(code: string) {
  const c = normalizeCode(code)
  if (!c) return null
  return prisma.partnerProperty.findFirst({ where: { code: c, active: true } })
}

/** What a guest sees before (or without) signing in. */
export async function partnerPreview(code: string) {
  const p = await findPartner(code)
  if (!p) return null
  const perk = await welcomeRewardFor(p.city, p.welcomeRewardId)
  return { code: p.code, name: p.name, kind: p.kind, city: p.city, perk }
}

/** Links a signed-in guest to the property and claims its perk. */
export async function joinPartner(userId: string, code: string) {
  const p = await findPartner(code)
  if (!p) return null
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { partnerPropertyId: true } })
  const firstReferral = !user?.partnerPropertyId
  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(firstReferral ? { partnerPropertyId: p.id, partnerJoinedAt: new Date() } : {}),
      stayName: p.name,
      stayCity: p.city
    }
  })
  const perk = await welcomeRewardFor(p.city, p.welcomeRewardId)
  const claim = perk ? await claimWelcome(userId, perk.id) : null
  return { property: { code: p.code, name: p.name, kind: p.kind, city: p.city }, referred: firstReferral, perk, redemption: claim?.redemption ?? null }
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!))
}

/** A printable table-tent card for the property: QR to /p/<code> plus the code. */
export function partnerCardSvg(name: string, code: string): string {
  const qr = qrcode(0, 'M')
  qr.addData(partnerUrl(code))
  qr.make()
  const n = qr.getModuleCount()
  const size = 280
  const cell = size / n
  let rects = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) rects += `<rect x="${(60 + c * cell).toFixed(2)}" y="${(130 + r * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560" viewBox="0 0 400 560" font-family="Inter, Helvetica, Arial, sans-serif">
  <rect width="400" height="560" rx="24" fill="#FFFFFF"/>
  <text x="200" y="56" text-anchor="middle" font-size="26" font-weight="800" fill="#B82010" letter-spacing="4">ETA</text>
  <text x="200" y="88" text-anchor="middle" font-size="16" font-weight="700" fill="#0F0E0C">${escapeXml(name)} guests</text>
  <text x="200" y="112" text-anchor="middle" font-size="13" fill="#6B6B6B">Scan for your welcome perk</text>
  <g fill="#0F0E0C" shape-rendering="crispEdges">${rects}</g>
  <text x="200" y="460" text-anchor="middle" font-size="13" fill="#6B6B6B">Or enter this code in the ETA app:</text>
  <text x="200" y="498" text-anchor="middle" font-size="26" font-weight="700" fill="#0F0E0C" font-family="'Space Mono', monospace" letter-spacing="3">${escapeXml(code)}</text>
</svg>`
}
