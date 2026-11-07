// components/ReviewPrompt.tsx — "How was <vendor>?" at the right moment:
// right after a QR visit or an in-app payment (lib/review-prompts.ts). One
// tap on the stars, an optional comment, Send. Skipped, it asks once more
// later that day. Checks when the app comes back to the front, every few
// minutes, and straight away when a scan or payment fires REVIEW_CHECK
// (eta-review-check).
'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Img from '@/components/Img'
import { StarPicker, postReview } from '@/components/ReviewSheet'
import { apiJson } from '@/lib/api-client'
import { AUTH_EVENT, getCurrentUser } from '@/lib/auth-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

export const REVIEW_CHECK = 'eta-review-check'

interface Due { id: string; reminder: boolean; vendor: { id: string; name: string; image: string | null } }

// Not over flows that take the whole screen.
const QUIET = ['/arrival', '/onboarding', '/login', '/register', '/stories']

export default function ReviewPrompt() {
  const { t } = useLang()
  const errorText = useErrorText()
  const pathname = usePathname()
  const [due, setDue] = useState<Due | null>(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thanks, setThanks] = useState(false)

  const check = useCallback(async () => {
    if (!getCurrentUser() || due) return
    const d = await apiJson<{ prompt: Due | null }>('/api/review-prompts').catch(() => ({ prompt: null }))
    if (!d.prompt) return
    setRating(0); setComment(''); setError(null); setThanks(false)
    setDue(d.prompt)
    apiJson('/api/review-prompts', { method: 'POST', body: { id: d.prompt.id, action: 'shown' } }).catch(() => {})
  }, [due])

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') check() }
    window.addEventListener(REVIEW_CHECK, check)
    window.addEventListener(AUTH_EVENT, check)
    document.addEventListener('visibilitychange', onVis)
    const timer = setInterval(check, 5 * 60000)
    const first = setTimeout(check, 4000)
    return () => { window.removeEventListener(REVIEW_CHECK, check); window.removeEventListener(AUTH_EVENT, check); document.removeEventListener('visibilitychange', onVis); clearInterval(timer); clearTimeout(first) }
  }, [check])

  const skip = () => {
    if (due) apiJson('/api/review-prompts', { method: 'POST', body: { id: due.id, action: 'skip' } }).catch(() => {})
    setDue(null)
  }

  const send = async () => {
    if (!due || !rating) return
    setBusy(true)
    setError(null)
    try {
      await postReview({ vendorId: due.vendor.id, rating, comment })
      await apiJson('/api/review-prompts', { method: 'POST', body: { id: due.id, action: 'done' } }).catch(() => {})
      triggerHaptic('medium')
      setThanks(true)
      setTimeout(() => setDue(null), 1400)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const open = Boolean(due) && !QUIET.some(p => pathname?.startsWith(p))
  return (
    <>
      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={skip} style={{ zIndex: 660 }} />
      <div className={`bottom-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open} aria-label={due ? t('m.rp.title', { vendor: due.vendor.name }) : ''} style={{ zIndex: 661 }}>
        <div className="sheet-grabber" />
        {due && (
          <div style={{ padding: '0 20px 24px', textAlign: 'center' }}>
            {due.vendor.image && <span className="rp-avatar"><Img src={due.vendor.image} alt="" width={160} height={160} sizes="72px" /></span>}
            {thanks ? (
              <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--label-primary)', padding: '18px 0' }}>{t('m.rp.thanks')}</p>
            ) : (
              <>
                <h3 style={{ fontSize: '21px', fontWeight: 800, color: 'var(--label-primary)', margin: '10px 0 4px' }}>{t('m.rp.title', { vendor: due.vendor.name })}</h3>
                {due.reminder && <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{t('m.rp.reminder')}</p>}
                <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}><StarPicker value={rating} onChange={setRating} size={36} /></div>
                {rating > 0 && (
                  <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} maxLength={1000} placeholder={t('m.rp.comment')} aria-label={t('m.review.comment')} className="field" style={{ resize: 'vertical', textAlign: 'left' }} />
                )}
                {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginTop: '8px' }}>{error}</p>}
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button className="btn btn-tertiary" onClick={skip} style={{ flex: 1 }}>{t('m.rp.later')}</button>
                  <button className="btn btn-primary press" onClick={send} disabled={busy || rating === 0} style={{ flex: 2 }}>{busy ? '…' : t('m.rp.send')}</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
