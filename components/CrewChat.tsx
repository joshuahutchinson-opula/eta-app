// components/CrewChat.tsx — crew messages on a trip, with one-tap quick
// messages ("Running late", "I'm here", "Meet at…"). Polls while visible.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '@/lib/icons'
import { avatarColor } from '@/components/TripPlanner'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { tripApi } from '@/lib/trip-client'
import { triggerHaptic } from '@/lib/haptics'

interface Message { id: string; body: string; kind: string; createdAt: string; memberId: string; name: string }

export default function CrewChat({ slug, myMemberId }: { slug: string; myMemberId: string | null }) {
  const { t, lang } = useLang()
  const errorText = useErrorText()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try { setMessages(await tripApi<Message[]>(slug, '/messages')) } catch {}
  }, [slug])

  useEffect(() => {
    load()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load() }, 8000)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }) }, [messages.length])

  const send = async (body: string, kind: 'text' | 'quick' = 'text') => {
    if (!body.trim()) return
    setSending(true)
    setError(null)
    try {
      const msg = await tripApi<Message>(slug, '/messages', { method: 'POST', body: { body: body.trim(), kind } })
      triggerHaptic('light')
      setMessages(prev => [...prev, msg])
      setText('')
    } catch (e) {
      setError(errorText(e))
    } finally {
      setSending(false)
    }
  }

  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang === 'en' ? 'en-US' : lang, { hour: 'numeric', minute: '2-digit', timeZone: 'America/Jamaica' })

  return (
    <section className="card" style={{ padding: 14, cursor: 'default', marginBottom: 16 }} aria-label={t('m.crew.chat')}>
      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--label-primary)', marginBottom: 10 }}>{t('m.crew.chat')}</p>
      <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }} aria-live="polite">
        {messages.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--label-secondary)' }}>{t('m.crew.chatEmpty')}</p>
        ) : messages.map(m => {
          const mine = m.memberId === myMemberId
          return (
            <div key={m.id} style={{ display: 'flex', gap: 8, flexDirection: mine ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
              {!mine && <span aria-hidden style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(m.name), color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{m.name[0]?.toUpperCase()}</span>}
              <div style={{ maxWidth: '78%', padding: '8px 12px', borderRadius: 16, background: mine ? 'var(--rum)' : 'var(--system-bg-secondary)', color: mine ? 'white' : 'var(--label-primary)' }}>
                {!mine && <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.7 }}>{m.name}</p>}
                <p style={{ fontSize: 15, fontWeight: m.kind === 'quick' ? 700 : 400, lineHeight: 1.35 }}>{m.body}</p>
                <p style={{ fontSize: 10, opacity: 0.7, marginTop: 2, textAlign: 'right' }}>{time(m.createdAt)}</p>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      {myMemberId ? (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <button className="chip" disabled={sending} onClick={() => send(t('m.crew.quick.late'), 'quick')} style={{ minHeight: 36, fontSize: 13 }}><Icon name="clock" size={12} /> {t('m.crew.quick.late')}</button>
            <button className="chip" disabled={sending} onClick={() => send(t('m.crew.quick.here'), 'quick')} style={{ minHeight: 36, fontSize: 13 }}><Icon name="mapPin" size={12} /> {t('m.crew.quick.here')}</button>
            <button className="chip" onClick={() => { setText(`${t('m.crew.quick.meet').replace(/…$/, '')} `); inputRef.current?.focus() }} style={{ minHeight: 36, fontSize: 13 }}><Icon name="users" size={12} /> {t('m.crew.quick.meet')}</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              value={text}
              maxLength={500}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(text) }}
              placeholder={t('m.crew.chatPlaceholder')}
              aria-label={t('m.crew.chatPlaceholder')}
              style={{ flex: 1, padding: 12, borderRadius: 14, border: '1px solid var(--separator)', background: 'var(--system-bg)', fontSize: 16, fontFamily: 'inherit', color: 'var(--label-primary)', outline: 'none', minHeight: 44 }}
            />
            <button onClick={() => send(text)} disabled={sending || !text.trim()} aria-label={t('m.crew.send')} style={{ width: 44, minHeight: 44, borderRadius: 14, background: 'var(--rum)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="send" size={16} />
            </button>
          </div>
        </>
      ) : null}
      {error && <p role="alert" style={{ fontSize: 12, color: 'var(--error)', marginTop: 6 }}>{error}</p>}
    </section>
  )
}
