// lib/whatsapp.ts — WhatsApp copies of booking confirmations, reminders,
// receipts and crew invites/messages, alongside push and email. Only sent to
// travelers who opted in (User.notifyWhatsapp) with a number on file.
//
// Provider: WHATSAPP_PROVIDER = "meta" (WhatsApp Business Cloud API) or
// "twilio". Off (logged instead) until that provider's settings are set:
//   meta:   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
//           (optional WHATSAPP_GRAPH_URL, default https://graph.facebook.com/v21.0)
//   twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
//           (the sender, e.g. "+18765550100")
//
// WhatsApp only allows free-form text inside a 24-hour customer-care window;
// anything ETA starts needs an approved template. Set one per message kind:
//   meta:   WHATSAPP_TEMPLATE_<KIND>  template name (language WHATSAPP_TEMPLATE_LANG, default en)
//   twilio: TWILIO_CONTENT_SID_<KIND> Content API SID (HX…)
// where KIND is BOOKING_CONFIRMED, BOOKING_REMINDER, RECEIPT, CREW_INVITE or
// CREW. Templates get three body variables: {{1}} title, {{2}} detail,
// {{3}} link. Without a template the plain text is sent.

export type WhatsAppKind = 'BOOKING_CONFIRMED' | 'BOOKING_REMINDER' | 'RECEIPT' | 'CREW_INVITE' | 'CREW'

export interface WhatsAppMessage {
  /** E.164, e.g. +18765551234. */
  to: string
  kind: WhatsAppKind
  title: string
  detail: string
  url?: string
}

type Provider = 'meta' | 'twilio'

function provider(): Provider | null {
  const p = process.env.WHATSAPP_PROVIDER?.toLowerCase()
  if (p === 'meta' && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) return 'meta'
  if (p === 'twilio' && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) return 'twilio'
  return null
}

export function whatsappConfigured(): boolean {
  return provider() !== null
}

/** "+1 (876) 555-1234" → "+18765551234"; null if it isn't a plausible number. */
export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
  const e164 = digits.startsWith('+') ? digits : `+${digits}`
  return /^\+\d{8,15}$/.test(e164) ? e164 : null
}

function text(m: WhatsAppMessage): string {
  return [`*${m.title}*`, m.detail, m.url].filter(Boolean).join('\n')
}

async function sendMeta(m: WhatsAppMessage): Promise<boolean> {
  const base = (process.env.WHATSAPP_GRAPH_URL || 'https://graph.facebook.com/v21.0').replace(/\/+$/, '')
  const template = process.env[`WHATSAPP_TEMPLATE_${m.kind}`]
  const body = template
    ? {
        messaging_product: 'whatsapp',
        to: m.to.slice(1),
        type: 'template',
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
          components: [{ type: 'body', parameters: [m.title, m.detail, m.url ?? ''].map(v => ({ type: 'text', text: v.slice(0, 1000) || '-' })) }]
        }
      }
    : { messaging_product: 'whatsapp', to: m.to.slice(1), type: 'text', text: { body: text(m), preview_url: Boolean(m.url) } }
  const res = await fetch(`${base}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000)
  })
  if (!res.ok) console.error('WhatsApp (Meta) failed:', res.status, (await res.text().catch(() => '')).slice(0, 300))
  return res.ok
}

async function sendTwilio(m: WhatsAppMessage): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID!
  const from = normalizePhone(process.env.TWILIO_WHATSAPP_FROM) ?? process.env.TWILIO_WHATSAPP_FROM!
  const content = process.env[`TWILIO_CONTENT_SID_${m.kind}`]
  const form = new URLSearchParams({ From: `whatsapp:${from}`, To: `whatsapp:${m.to}` })
  if (content) {
    form.set('ContentSid', content)
    form.set('ContentVariables', JSON.stringify({ 1: m.title, 2: m.detail, 3: m.url ?? '' }))
  } else {
    form.set('Body', text(m))
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    signal: AbortSignal.timeout(8000)
  })
  if (!res.ok) console.error('WhatsApp (Twilio) failed:', res.status, (await res.text().catch(() => '')).slice(0, 300))
  return res.ok
}

/** Sends one message. Never throws — a failed WhatsApp must not fail the request behind it. */
export async function sendWhatsApp(m: WhatsAppMessage): Promise<boolean> {
  const to = normalizePhone(m.to)
  if (!to) return false
  const p = provider()
  if (!p) {
    console.log(`[whatsapp not configured] to=${to} kind=${m.kind}\n${text(m)}`)
    return false
  }
  try {
    return p === 'meta' ? await sendMeta({ ...m, to }) : await sendTwilio({ ...m, to })
  } catch (error) {
    console.error('WhatsApp send failed:', error)
    return false
  }
}
