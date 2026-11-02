// components/experiences/PlanDiscoverSwitch.tsx — the Experiences tab's
// Plan / Discover control (Home top bar and the Discover map).
'use client'

import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

export type TabMode = 'plan' | 'discover'

export default function PlanDiscoverSwitch({ mode, onChange, floating = false }: { mode: TabMode; onChange: (m: TabMode) => void; floating?: boolean }) {
  const { t } = useLang()
  const option = (m: TabMode, icon: string, label: string) => (
    <button
      role="tab"
      aria-selected={mode === m}
      className={`segmented-control-option ${mode === m ? 'active' : ''}`}
      onClick={() => { if (mode !== m) { triggerHaptic('selection'); onChange(m) } }}
      style={{ padding: '6px 12px', fontSize: '14px' }}
    >
      <Icon name={icon} size={14} />
      {label}
    </button>
  )
  return (
    <div className="segmented-control" role="tablist" aria-label={t('m.xh.modeLabel')} style={floating ? { boxShadow: 'var(--shadow-elevated)', background: 'var(--system-bg-elevated)' } : undefined}>
      {option('plan', 'compass', t('m.exp.plan'))}
      {option('discover', 'mapPin', t('m.exp.discover'))}
    </div>
  )
}
