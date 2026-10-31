// lib/labels.ts — translated names for the codes the data uses: vendor
// categories, loyalty tiers, accessibility features, hidden-gem types and
// stay types. Code → lib/i18n.ts key, so every screen shows the same words.
'use client'

import { useCallback } from 'react'
import { useLang } from '@/lib/i18n-client'
import type { DictKey } from '@/lib/i18n'

export function useLabels() {
  const { t } = useLang()
  const pick = useCallback((prefix: string, code: string, fallback?: string) => {
    const key = `${prefix}${code}` as DictKey
    const text = t(key)
    return text === key ? fallback ?? code : text
  }, [t])
  return {
    category: useCallback((c: string) => pick('m.cat.', c.toUpperCase(), c), [pick]),
    priceNoun: useCallback((c: string) => pick('m.priceNoun.', c.toUpperCase(), ''), [pick]),
    tier: useCallback((key: string) => pick('m.tier.', key, key), [pick]),
    access: useCallback((key: string) => pick('m.access.', key, key), [pick]),
    gem: useCallback((key: string) => pick('m.gemcat.', key, key), [pick]),
    stayType: useCallback((key: string) => pick('m.stayType.', key, key), [pick])
  }
}
