// components/rewards/RewardsTop.tsx — the title bar on the Rewards screens
// (docs/mockups/RewardsHub.dc.html): a round back button, the title in the
// middle, and an optional round button on the right (the hub's "How it
// works", which opens Tiers & Earning).
'use client'

import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

export default function RewardsTop({ title, back = true, fallback = '/rewards', right }: { title: string; back?: boolean; fallback?: string; right?: React.ReactNode }) {
  const router = useRouter()
  const { t } = useLang()
  const goBack = () => {
    triggerHaptic('light')
    if (window.history.length > 1) router.back()
    else router.push(fallback)
  }
  return (
    <header className="rh-top">
      {back ? <button className="rh-round press" onClick={goBack} aria-label={t('m.common.back')}><Icon name="back" size={18} /></button> : <span className="rh-spacer" />}
      <h1>{title}</h1>
      {right ?? <span className="rh-spacer" />}
    </header>
  )
}
