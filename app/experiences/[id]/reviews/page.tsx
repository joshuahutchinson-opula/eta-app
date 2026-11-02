// app/experiences/[id]/reviews/page.tsx — every review of an experience,
// newest first, with the average and a way to report one.
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import BackButton from '@/components/BackButton'
import ErrorState from '@/components/ErrorState'
import ReportButton from '@/components/ReportButton'
import Img from '@/components/Img'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'

interface ReviewRow { id: string; rating: number; comment: string | null; createdAt: string; user: { name: string; avatarUrl: string | null } }

export default function ExperienceReviewsPage() {
  const { id } = useParams() as { id: string }
  const { t, lang } = useLang()
  const [name, setName] = useState('')
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const [exp, list] = await Promise.all([
        fetch(`/api/experiences/${id}`).then(r => (r.ok ? r.json() : null)),
        fetch(`/api/reviews?experienceId=${id}&take=200`).then(r => { if (!r.ok) throw new Error(); return r.json() })
      ])
      setName(exp?.name ?? '')
      setReviews(Array.isArray(list) ? list : [])
    } catch {
      setFailed(true)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const locale = lang === 'en' ? 'en-US' : lang
  const avg = reviews && reviews.length ? Math.round((reviews.reduce((n, r) => n + r.rating, 0) / reviews.length) * 10) / 10 : null

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '40px' }}>
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <BackButton fallback={`/experiences/${id}`} />
        <div className="section-heading" style={{ minWidth: 0 }}>
          <span className="section-eyebrow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          <h1 className="section-title">{t('m.exp.reviewsTitle')}</h1>
        </div>
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {failed ? <ErrorState onRetry={load} /> : reviews === null ? (
          [0, 1, 2].map(i => <div key={i} className="skeleton-card" style={{ height: '90px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>)
        ) : reviews.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'var(--label-secondary)' }}>{t('common.noReviews')}</p>
        ) : (
          <>
            {avg !== null && <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}><span style={{ color: 'var(--gold)' }}>★</span> {t('m.exp.reviewsAverage', { avg, n: reviews.length })}</p>}
            {reviews.map(r => (
              <div key={r.id} className="card" style={{ padding: '12px', cursor: 'default' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  {r.user.avatarUrl ? <span style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden' }}><Img src={r.user.avatarUrl} alt="" width={64} height={64} sizes="32px" /></span> : <Icon name="user" size={18} style={{ color: 'var(--label-tertiary)' }} />}
                  <span style={{ flex: 1, fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{r.user.name}</span>
                  <span aria-label={t('m.review.stars', { n: r.rating })} style={{ color: 'var(--gold)', fontSize: '13px' }}>{'★'.repeat(r.rating)}<span style={{ color: 'var(--label-tertiary)' }}>{'★'.repeat(5 - r.rating)}</span></span>
                </div>
                {r.comment && <p style={{ fontSize: '14px', color: 'var(--label-secondary)', lineHeight: 1.4 }}>{r.comment}</p>}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '-4px', marginBottom: '-10px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--label-tertiary)' }}>{new Date(r.createdAt).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <ReportButton targetType="REVIEW" targetId={r.id} />
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </main>
  )
}
