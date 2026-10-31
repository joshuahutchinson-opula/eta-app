// components/RecapReviews.tsx — after a trip, "How was each stop?": a quick
// star rating (and optional note) per vendor, posted as a real review.
'use client'

import { useEffect, useState } from 'react'
import { StarPicker, postReview } from '@/components/ReviewSheet'
import { getCurrentUser } from '@/lib/auth-client'
import { useLang, useErrorText } from '@/lib/i18n-client'

interface Target { vendorId: string; name: string; image: string | null; experienceId: string | null }

function StopReview({ target }: { target: Target }) {
  const { t } = useLang()
  const errorText = useErrorText()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setState('busy')
    try {
      await postReview({ vendorId: target.vendorId, experienceId: target.experienceId ?? undefined, rating, comment })
      setState('done')
    } catch (e) {
      setError(errorText(e))
      setState('error')
    }
  }

  return (
    <li style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        {target.image ? <img src={target.image} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} /> : null}
        <span style={{ fontSize: 15, fontWeight: 600 }}>{target.name}</span>
      </div>
      {state === 'done' ? (
        <p style={{ fontSize: 14, color: '#34C759' }}>{t('m.review.thanks')}</p>
      ) : (
        <>
          <StarPicker value={rating} onChange={setRating} size={26} />
          {rating > 0 && (
            <>
              <input
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder={t('m.review.placeholderShort')}
                aria-label={t('m.review.comment')}
                maxLength={1000}
                style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.25)', color: '#FBF8F4', fontSize: 15, fontFamily: 'inherit' }}
              />
              <button onClick={submit} disabled={state === 'busy'} style={{ marginTop: 8, minHeight: 40, padding: '0 16px', borderRadius: 10, border: 'none', background: '#B82010', color: 'white', fontWeight: 600, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
                {state === 'busy' ? '…' : t('m.review.post')}
              </button>
            </>
          )}
          {error && <p role="alert" style={{ fontSize: 13, color: '#FF6B5E', marginTop: 6 }}>{error}</p>}
        </>
      )}
    </li>
  )
}

export default function RecapReviews({ targets }: { targets: Target[] }) {
  const { t } = useLang()
  // Reviews come from the traveler's own device; a shared recap viewer who
  // isn't signed in just doesn't see the prompt.
  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => { setSignedIn(Boolean(getCurrentUser())) }, [])
  if (!signedIn) return null
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{t('m.review.howWas')}</h2>
      <p style={{ fontSize: 13, color: 'rgba(251,248,244,0.6)', marginBottom: 10 }}>{t('m.review.howWasSub')}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {targets.map(tg => <StopReview key={tg.vendorId} target={tg} />)}
      </ul>
    </section>
  )
}
