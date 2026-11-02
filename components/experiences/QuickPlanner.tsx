// components/experiences/QuickPlanner.tsx — "Plan my day" on one screen:
// one vibe, how long, who's coming, getting around. Inviting real crew comes
// later, from the trip (Crew vote).
'use client'

import { useRef, useState } from 'react'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import SmartVideo from '@/components/SmartVideo'
import BackButton from '@/components/BackButton'
import ErrorState from '@/components/ErrorState'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'
import { MAX_CREW, TIMES, TRANSPORTS, type MoodItem, type PlanInput } from '@/lib/plan'

export default function QuickPlanner({ moods, initial, townName, loading, failed, onRetry, onBack, onBuild, onSurprise }: {
  /** Most relevant first; the scroller shows them all. */
  moods: MoodItem[]
  initial: PlanInput
  townName: string
  loading: boolean
  failed: boolean
  onRetry: () => void
  onBack: () => void
  onBuild: (plan: PlanInput) => void
  onSurprise: () => void
}) {
  const { t } = useLang()
  const [plan, setPlan] = useState<PlanInput>(initial)
  const tiles = useRef<Array<HTMLButtonElement | null>>([])
  const set = (patch: Partial<PlanInput>) => setPlan(p => ({ ...p, ...patch }))

  const pickMood = (i: number, focus = false) => {
    const m = moods[i]
    if (!m) return
    triggerHaptic('selection')
    set({ mood: { id: m.id, name: m.name } })
    if (focus) {
      tiles.current[i]?.focus()
      tiles.current[i]?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
    }
  }
  const selectedIndex = moods.findIndex(m => m.id === plan.mood?.id)
  // Radio-group keys: arrows move the selection.
  const onMoodKey = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    pickMood((i + step + moods.length) % moods.length, true)
  }

  const segment = <K extends string>(label: string, options: Array<{ id: K; label: Parameters<typeof t>[0] }>, value: K, onPick: (v: K) => void) => (
    <div role="radiogroup" aria-label={label} className="segmented-control">
      {options.map(o => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          className={`segmented-control-option ${value === o.id ? 'active' : ''}`}
          onClick={() => { triggerHaptic('selection'); onPick(o.id) }}
          style={{ padding: '8px 4px', fontSize: '14px' }}
        >
          {t(o.label)}
        </button>
      ))}
    </div>
  )

  const label = (text: string) => <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label-secondary)', margin: '24px 16px 10px' }}>{text}</p>

  return (
    <main className="screen-push-in" style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 0' }}>
        <BackButton onClick={onBack} />
        <p className="section-eyebrow" style={{ display: 'block', marginTop: '16px' }}>{t('m.qp.eyebrow', { town: townName })}</p>
        <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginTop: '2px' }}>{t('m.qp.title')}</h1>
        {plan.anchor && (
          <span className="chip active" style={{ marginTop: '10px', cursor: 'default', gap: '6px' }}>
            <Icon name="mapPin" size={14} /> {t('m.qp.around', { place: plan.anchor.name })}
            <button onClick={() => set({ anchor: null })} aria-label={t('m.qp.clearAround', { place: plan.anchor.name })} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 0 0 2px', display: 'flex' }}><Icon name="close" size={12} /></button>
          </span>
        )}
      </div>

      {/* Vibe — one pick */}
      {label(t('m.qp.vibe'))}
      {failed ? (
        <div style={{ padding: '0 16px' }}><ErrorState onRetry={onRetry} /></div>
      ) : loading ? (
        <div className="horizontal-scroll" style={{ padding: '6px 16px' }}>
          {[0, 1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ flexShrink: 0, width: '116px', height: '150px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>)}
        </div>
      ) : (
        <div role="radiogroup" aria-label={t('m.qp.vibe')} className="horizontal-scroll" style={{ padding: '6px 16px 8px', scrollSnapType: 'x proximity' }}>
          {moods.map((m, i) => {
            const on = plan.mood?.id === m.id
            return (
              <button
                key={m.id}
                ref={el => { tiles.current[i] = el }}
                role="radio"
                aria-checked={on}
                aria-label={m.name}
                tabIndex={on || (selectedIndex === -1 && i === 0) ? 0 : -1}
                onClick={() => pickMood(i)}
                onKeyDown={e => onMoodKey(e, i)}
                className="planner-mood"
                style={{
                  position: 'relative', flexShrink: 0, width: '116px', height: '150px', borderRadius: '16px', overflow: 'hidden',
                  border: 'none', padding: 0, cursor: 'pointer', scrollSnapAlign: 'start', background: 'var(--system-bg-secondary)',
                  boxShadow: on ? '0 0 0 3px var(--system-bg), 0 0 0 5px var(--rum)' : 'none',
                  opacity: plan.mood && !on ? 0.62 : 1,
                  transition: 'opacity 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                {m.videoUrl ? <SmartVideo src={m.videoUrl} poster={m.coverImage} alt="" /> : <Img src={m.coverImage} alt="" width={232} height={300} sizes="116px" />}
                <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.78))' }} />
                <span style={{ position: 'absolute', left: '10px', right: '10px', bottom: '10px', color: 'white', fontSize: '14px', fontWeight: 700, lineHeight: 1.2, textAlign: 'left' }}>{m.name}</span>
                {on && (
                  <span className="check-pop-in" aria-hidden="true" style={{ position: 'absolute', top: '8px', right: '8px', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--rum)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.35)' }}>
                    <Icon name="check" size={12} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {label(t('m.qp.howLong'))}
      <div style={{ padding: '0 16px' }}>{segment(t('m.qp.howLong'), TIMES, plan.time, v => set({ time: v }))}</div>

      {label(t('m.qp.who'))}
      <div style={{ padding: '0 16px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', cursor: 'default' }}>
          <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--label-primary)' }}>{plan.crew === 1 ? t('m.qp.justMe') : t('m.qp.people', { n: plan.crew })}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button className="back-button" onClick={() => { triggerHaptic('selection'); set({ crew: Math.max(1, plan.crew - 1) }) }} disabled={plan.crew <= 1} aria-label={t('m.qp.fewer')} style={{ opacity: plan.crew <= 1 ? 0.4 : 1 }}><Icon name="minus" size={16} /></button>
            <span className="num-font" aria-live="polite" style={{ minWidth: '20px', textAlign: 'center', fontSize: '18px', fontWeight: 700, color: 'var(--label-primary)' }}>{plan.crew}</span>
            <button className="back-button" onClick={() => { triggerHaptic('selection'); set({ crew: Math.min(MAX_CREW, plan.crew + 1) }) }} disabled={plan.crew >= MAX_CREW} aria-label={t('m.qp.more')} style={{ opacity: plan.crew >= MAX_CREW ? 0.4 : 1 }}><Icon name="plus" size={16} /></button>
          </span>
        </div>
      </div>

      {label(t('m.qp.gettingAround'))}
      <div style={{ padding: '0 16px' }}>{segment(t('m.qp.gettingAround'), TRANSPORTS, plan.transport, v => set({ transport: v }))}</div>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, background: 'var(--system-bg-elevated)', borderTop: '0.5px solid var(--separator)', padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))', boxShadow: 'var(--shadow-sheet)', display: 'flex', gap: '8px' }}>
        <button className="btn btn-secondary" onClick={() => { triggerHaptic('light'); onSurprise() }} disabled={moods.length === 0} style={{ flex: 1 }}>
          <Icon name="shuffle" size={16} /> {t('m.xh.surprise')}
        </button>
        <button className="btn btn-primary" onClick={() => { triggerHaptic('medium'); onBuild(plan) }} disabled={!plan.mood && !plan.anchor} style={{ flex: 1.4 }}>
          {t('m.qp.build')}
        </button>
      </div>
    </main>
  )
}
