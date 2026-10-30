// components/ReviewSheet.tsx — "Write a review": stars plus a comment,
// posted to /api/reviews. Used on vendor pages and after a trip.
'use client'

import { useEffect, useState } from 'react'
import Icon from '@/lib/icons'
import { getCurrentUser } from '@/lib/auth-client'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

export interface PostedReview {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  user: { name: string; avatarUrl: string | null }
}

export function StarPicker({ value, onChange, size = 32 }: { value: number; onChange: (n: number) => void; size?: number }) {
  const { t } = useLang()
  return (
    <div role="radiogroup" aria-label={t('m.review.rating')} style={{ display: 'flex', gap: '6px' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          role="radio"
          aria-checked={value === n}
          aria-label={t('m.review.stars', { n })}
          onClick={() => { triggerHaptic('selection'); onChange(n) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: `${size}px`, lineHeight: 1, color: n <= value ? 'var(--gold)' : 'var(--label-tertiary)', minWidth: '44px', minHeight: '44px', padding: 0 }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export async function postReview(input: { vendorId: string; experienceId?: string; rating: number; comment: string }): Promise<PostedReview> {
  const user = getCurrentUser()
  if (!user) throw new Error('Log in to leave a review')
  const res = await fetch('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id, vendorId: input.vendorId, experienceId: input.experienceId, rating: input.rating, comment: input.comment.trim() || null })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Sumth nah wuk')
  return { ...data, user: { name: user.name, avatarUrl: user.avatarUrl ?? null } }
}

export default function ReviewSheet({ open, vendorId, vendorName, onClose, onPosted }: { open: boolean; vendorId: string; vendorName: string; onClose: () => void; onPosted: (r: PostedReview) => void }) {
  const { t } = useLang()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (open) { setRating(0); setComment(''); setError(null) } }, [open])

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await postReview({ vendorId, rating, comment })
      triggerHaptic('medium')
      onPosted(r)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sumth nah wuk')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`bottom-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.review.write')}>
        <div className="sheet-grabber" />
        {open && (
          <div style={{ padding: '0 20px 24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '4px' }}>{t('m.review.write')}</h3>
            <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '12px' }}>{vendorName}</p>
            <StarPicker value={rating} onChange={setRating} />
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={t('m.review.placeholder')}
              aria-label={t('m.review.comment')}
              rows={4}
              maxLength={1000}
              style={{ width: '100%', marginTop: '12px', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', color: 'var(--label-primary)', fontSize: '16px', fontFamily: 'inherit', resize: 'vertical' }}
            />
            {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginTop: '8px' }}>{error}</p>}
            <button className="btn btn-primary" onClick={submit} disabled={busy || rating === 0} style={{ width: '100%', marginTop: '12px' }}>
              <Icon name="star" size={16} /> {busy ? '…' : t('m.review.post')}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
