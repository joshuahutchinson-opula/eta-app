// components/BackButton.tsx — the one back button: 44px round, elevated.
// `floating` pins it over a full-bleed hero (detail screens); otherwise it
// sits inline in a screen header. Falls back to `fallback` when there's no
// history to go back to (opened from a shared link).
'use client'

import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

export default function BackButton({ floating = false, fallback = '/', onClick }: { floating?: boolean; fallback?: string; onClick?: () => void }) {
  const router = useRouter()
  const { t } = useLang()
  const go = () => {
    triggerHaptic('light')
    if (onClick) return onClick()
    if (window.history.length > 1) router.back()
    else router.push(fallback)
  }
  return (
    <button
      onClick={go}
      aria-label={t('m.common.back')}
      className="back-button"
      style={floating ? { position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: '16px', zIndex: 20 } : undefined}
    >
      <Icon name="back" size={16} />
    </button>
  )
}
