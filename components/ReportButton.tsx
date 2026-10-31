// components/ReportButton.tsx — a small "Report" flag for user content
// (photo spot photos, mood photos, stories, reviews, hidden gems). Opens a
// sheet to pick a reason and add an optional note; saved as a Report.
// Enough reports hide the content until it's reviewed (lib/reports.ts).
'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { apiJson } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

export type ReportTarget = 'MOMENT' | 'MOOD_MEDIA' | 'STORY' | 'REVIEW' | 'HIDDEN_GEM'
const REASONS = ['SPAM', 'INAPPROPRIATE', 'HARASSMENT', 'MISLEADING', 'NOT_THERE', 'OTHER'] as const

export default function ReportButton({ targetType, targetId, tone = 'default', onReported }: {
  targetType: ReportTarget
  targetId: string
  /** "light" for use over photos and video. */
  tone?: 'default' | 'light'
  onReported?: (hidden: boolean) => void
}) {
  const { t } = useLang()
  const errorText = useErrorText()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null)
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  const close = () => { setOpen(false); setReason(null); setNote(''); setError(null); if (state === 'done') setState('idle') }

  const send = async () => {
    if (!reason) return
    setState('busy')
    setError(null)
    try {
      const res = await apiJson<{ hidden?: boolean }>('/api/reports', { method: 'POST', body: { targetType, targetId, reason, note: note.trim() || undefined } })
      triggerHaptic('medium')
      setState('done')
      onReported?.(Boolean(res.hidden))
    } catch (e) {
      setError(errorText(e))
      setState('idle')
    }
  }

  const light = tone === 'light'
  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); e.preventDefault(); triggerHaptic('light'); setOpen(true) }}
        aria-label={t('m.report.title')}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', minWidth: '44px', minHeight: '44px', padding: '0 8px', border: 'none', borderRadius: '999px', background: light ? 'rgba(0,0,0,0.35)' : 'transparent', color: light ? 'white' : 'var(--label-secondary)', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
      >
        <Icon name="flag" size={14} />{light ? null : <span>{t('m.report.button')}</span>}
      </button>

      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={close} style={{ zIndex: 600 }} />
      <div className={`bottom-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.report.title')} style={{ zIndex: 601 }} onClick={e => e.stopPropagation()}>
        <div className="sheet-grabber" />
        {open && (
          <div style={{ padding: '0 20px 24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '12px' }}>{t('m.report.title')}</h3>
            {!getCurrentUser() ? (
              <Link href="/login" className="btn btn-primary" style={{ width: '100%', textDecoration: 'none' }}>{t('m.report.login')}</Link>
            ) : state === 'done' ? (
              <>
                <p role="status" style={{ fontSize: '15px', color: 'var(--label-primary)', marginBottom: '16px' }}><Icon name="check" size={14} style={{ color: 'var(--success)' }} /> {t('m.report.thanks')}</p>
                <button className="btn btn-tertiary" onClick={close} style={{ width: '100%' }}>{t('m.profile.done')}</button>
              </>
            ) : (
              <>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.report.why')}</p>
                <div role="radiogroup" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                  {REASONS.map(r => (
                    <button key={r} role="radio" aria-checked={reason === r} className={`chip ${reason === r ? 'active' : ''}`} onClick={() => { triggerHaptic('selection'); setReason(r) }}>
                      {t(`m.report.reason.${r}` as 'm.report.reason.SPAM')}
                    </button>
                  ))}
                </div>
                <textarea
                  value={note}
                  maxLength={500}
                  rows={3}
                  onChange={e => setNote(e.target.value)}
                  placeholder={t('m.report.note')}
                  aria-label={t('m.report.note')}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', fontSize: '16px', fontFamily: 'inherit', color: 'var(--label-primary)', resize: 'vertical', marginBottom: '12px' }}
                />
                {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{error}</p>}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-tertiary" onClick={close} style={{ flex: 1 }}>{t('m.book.cancel')}</button>
                  <button className="btn btn-primary" onClick={send} disabled={!reason || state === 'busy'} style={{ flex: 2 }}>{t('m.report.send')}</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
