// lib/i18n-client.ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import { LANG_COOKIE, normalizeLang, t as translate, type DictKey, type Lang } from '@/lib/i18n'
import { getPatois, type PatoisKey } from '@/lib/patois'
import { errorText } from '@/lib/errors'

const EVENT = 'eta-lang-change'

export function readLang(): Lang {
  if (typeof document === 'undefined') return 'en'
  const match = document.cookie.match(new RegExp(`(?:^|; )${LANG_COOKIE}=([^;]*)`))
  return normalizeLang(match?.[1])
}

export function writeLang(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`
  document.documentElement.setAttribute('lang', lang)
  window.dispatchEvent(new CustomEvent(EVENT, { detail: lang }))
}

/** Current language plus a setter; every mounted hook re-renders on change. */
export function useLang(): { lang: Lang; setLang: (lang: Lang) => void; t: (key: DictKey, vars?: Record<string, string | number>) => string } {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    setLangState(readLang())
    const onChange = (e: Event) => setLangState((e as CustomEvent<Lang>).detail)
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])

  const setLang = useCallback((next: Lang) => writeLang(next), [])
  const t = useCallback((key: DictKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang])
  return { lang, setLang, t }
}

/** errorText() bound to the current language: patois in English only. */
export function useErrorText(): (error: unknown) => string {
  const { lang } = useLang()
  return useCallback((error: unknown) => errorText(error, lang), [lang])
}

/** The patois dictionary in the current language (see lib/patois.ts). */
export function usePatois(): Record<PatoisKey, string> {
  const { lang } = useLang()
  return getPatois(lang)
}
