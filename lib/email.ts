// lib/email.ts — every email ETA sends goes through send() here.
//
// Provider: Resend or Postmark, picked by EMAIL_PROVIDER ("resend" |
// "postmark"); when that's unset, a key starting "re_" means Resend and
// anything else Postmark.
//   EMAIL_API_KEY  the provider's API key (Postmark: the server token)
//   EMAIL_FROM     the verified sender, e.g. "ETA <hello@eta.example.com>"
// With no key configured the email is written to the server log instead,
// so flows still work in development.
import { absoluteUrl } from '@/lib/site-url'

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

export function emailConfigured(): boolean {
  return Boolean(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM)
}

function provider(): 'resend' | 'postmark' {
  const p = process.env.EMAIL_PROVIDER?.toLowerCase()
  if (p === 'resend' || p === 'postmark') return p
  return process.env.EMAIL_API_KEY?.startsWith('re_') ? 'resend' : 'postmark'
}

/** Sends one email. Never throws — a failed email must not fail the request that triggered it. */
export async function send(msg: EmailMessage): Promise<boolean> {
  if (!emailConfigured()) {
    console.log(`[email not configured] to=${msg.to} subject="${msg.subject}"\n${msg.text}`)
    return false
  }
  const key = process.env.EMAIL_API_KEY!
  const from = process.env.EMAIL_FROM!
  try {
    const res = provider() === 'resend'
      ? await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text })
        })
      : await fetch('https://api.postmarkapp.com/email', {
          method: 'POST',
          headers: { 'X-Postmark-Server-Token': key, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ From: from, To: msg.to, Subject: msg.subject, HtmlBody: msg.html, TextBody: msg.text, MessageStream: 'outbound' })
        })
    if (!res.ok) console.error('Email send failed:', res.status, await res.text().catch(() => ''))
    return res.ok
  } catch (error) {
    console.error('Email send failed:', error)
    return false
  }
}

// ---------- Templates ----------

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

/** One branded layout: ETA wordmark, a heading, a few lines, an optional button. */
function layout(opts: { heading: string; lines: string[]; button?: { label: string; url: string }; rows?: Array<[string, string]>; footer?: string }): { html: string; text: string } {
  const rows = opts.rows?.length
    ? `<table role="presentation" width="100%" style="border-collapse:collapse;margin:16px 0">${opts.rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:#6b6b70;font-size:14px">${esc(k)}</td><td style="padding:6px 0;text-align:right;font-weight:600;font-size:14px">${esc(v)}</td></tr>`).join('')}</table>`
    : ''
  const button = opts.button
    ? `<p style="margin:24px 0"><a href="${esc(opts.button.url)}" style="display:inline-block;background:#B82010;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px">${esc(opts.button.label)}</a></p><p style="font-size:12px;color:#8e8e93;word-break:break-all">${esc(opts.button.url)}</p>`
    : ''
  const html = `<!doctype html><html><body style="margin:0;background:#F2F2F7;font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;color:#000">
<table role="presentation" width="100%" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;padding:28px">
<tr><td>
<p style="margin:0 0 20px;font-size:22px;font-weight:800;letter-spacing:2px;color:#B82010">ETA</p>
<h1 style="margin:0 0 12px;font-size:22px">${esc(opts.heading)}</h1>
${opts.lines.map(l => `<p style="margin:0 0 10px;font-size:15px;line-height:1.5">${esc(l)}</p>`).join('')}
${rows}${button}
<p style="margin:24px 0 0;font-size:12px;color:#8e8e93">${esc(opts.footer ?? 'ETA — Experience, Travel, Adventure. See the Real Jamaica.')}</p>
</td></tr></table></td></tr></table></body></html>`
  const text = [opts.heading, '', ...opts.lines, ...(opts.rows ?? []).map(([k, v]) => `${k}: ${v}`), ...(opts.button ? ['', `${opts.button.label}: ${opts.button.url}`] : [])].join('\n')
  return { html, text }
}

export function verificationEmail(to: string, name: string, token: string): EmailMessage {
  const url = absoluteUrl(`/verify-email?token=${encodeURIComponent(token)}`)
  return {
    to,
    subject: 'Confirm your email for ETA',
    ...layout({
      heading: `Wah Gwan, ${name.split(' ')[0]}!`,
      lines: ['Tap the button to confirm your email. You can look around ETA right away; booking, reviewing and posting unlock once you confirm.', 'The link works for 48 hours.'],
      button: { label: 'Confirm my email', url },
      footer: 'Didn’t sign up for ETA? You can ignore this email.'
    })
  }
}

export function passwordResetEmail(to: string, token: string): EmailMessage {
  const url = absoluteUrl(`/reset-password?token=${encodeURIComponent(token)}`)
  return {
    to,
    subject: 'Reset your ETA password',
    ...layout({
      heading: 'Set a new password',
      lines: ['Someone (hopefully you) asked to reset the password on your ETA account.', 'The link works for one hour and only once.'],
      button: { label: 'Choose a new password', url },
      footer: 'Didn’t ask for this? Ignore this email — your password stays the same.'
    })
  }
}

export interface BookingEmailInfo {
  title: string
  when: string
  partySize: number
  total: string
  code: string
  meetingPoint?: string | null
  bookingUrl: string
}

export function bookingConfirmationEmail(to: string, b: BookingEmailInfo): EmailMessage {
  return {
    to,
    subject: `Booked: ${b.title}`,
    ...layout({
      heading: 'Book off! You’re all set.',
      lines: [`${b.title} is confirmed. Show your ticket code when you arrive.`],
      rows: [['When', b.when], ['Party', String(b.partySize)], ['Total', b.total], ['Ticket', b.code], ...(b.meetingPoint ? [['Meeting point', b.meetingPoint] as [string, string]] : [])],
      button: { label: 'Open My Bookings', url: b.bookingUrl }
    })
  }
}

export function bookingReminderEmail(to: string, b: BookingEmailInfo, lead: 'day' | 'hour'): EmailMessage {
  return {
    to,
    subject: lead === 'day' ? `Tomorrow: ${b.title}` : `In one hour: ${b.title}`,
    ...layout({
      heading: lead === 'day' ? 'See you tomorrow' : 'Starting in an hour',
      lines: [`${b.title} — ${b.when}.`, ...(b.meetingPoint ? [`Meet at ${b.meetingPoint}.`] : [])],
      rows: [['Ticket', b.code], ['Party', String(b.partySize)]],
      button: { label: 'Open my ticket', url: b.bookingUrl }
    })
  }
}

export function receiptEmail(to: string, r: { description: string; amount: string; date: string; rail: string; ref: string; receiptUrl: string }): EmailMessage {
  return {
    to,
    subject: `Your ETA receipt — ${r.description}`,
    ...layout({
      heading: 'Receipt',
      lines: [r.description],
      rows: [['Amount', r.amount], ['Date', r.date], ['Paid with', r.rail], ['Receipt ref', r.ref]],
      button: { label: 'View receipt', url: r.receiptUrl }
    })
  }
}
