// components/rewards/RewardsTop.tsx — the title bar on the Rewards screens,
// with a back button on the sub-screens (Tiers, My Rewards, History…).
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
    <header className="rw-top">
      {back && <button className="rw-back press" onClick={goBack} aria-label={t('m.common.back')}><Icon name="back" size={18} /></button>}
      <h1>{title}</h1>
      {right}
    </header>
  )
}
