// lib/i18n-server.ts
import { cookies } from 'next/headers'
import { LANG_COOKIE, normalizeLang, type Lang } from '@/lib/i18n'

export function getServerLang(): Lang {
  return normalizeLang(cookies().get(LANG_COOKIE)?.value)
}
