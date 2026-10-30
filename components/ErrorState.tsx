// components/ErrorState.tsx — what a screen shows when its data didn't load,
// instead of silently rendering nothing.
'use client'

import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'

export default function ErrorState({ onRetry, message, compact }: { onRetry?: () => void; message?: string; compact?: boolean }) {
  const { t } = useLang()
  return (
    <div className="empty-state" role="alert" style={compact ? { padding: '20px 16px' } : undefined}>
      <Icon name="wave" size={compact ? 24 : 32} style={{ color: 'var(--label-tertiary)' }} />
      <p style={{ fontSize: compact ? '15px' : '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.error.title')}</p>
      <p style={{ fontSize: '14px' }}>{message ?? t('m.error.body')}</p>
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry} style={{ marginTop: '4px' }}>
          {t('m.error.retry')}
        </button>
      )}
    </div>
  )
}
