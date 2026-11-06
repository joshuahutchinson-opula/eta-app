// components/ThemeAuto.tsx — when the theme is Auto (lib/theme.ts), switches
// to dark at the selected town's real sunset and back at sunrise, and
// re-checks when the town changes or the app comes back to the front.
'use client'

import { useEffect, useState } from 'react'
import { useRegion } from '@/components/RegionProvider'
import { applyDark, readTheme, sunIsDown, THEME_EVENT } from '@/lib/theme'

export default function ThemeAuto() {
  const { town, ready } = useRegion()
  const [mode, setMode] = useState<string>('light')

  useEffect(() => {
    setMode(readTheme())
    const on = (e: Event) => setMode((e as CustomEvent<string>).detail)
    window.addEventListener(THEME_EVENT, on)
    return () => window.removeEventListener(THEME_EVENT, on)
  }, [])

  useEffect(() => {
    if (!ready || mode !== 'auto') return
    let timer: ReturnType<typeof setTimeout> | null = null
    const check = () => {
      const { dark, next } = sunIsDown(town.lat, town.lng)
      applyDark(dark)
      if (timer) clearTimeout(timer)
      timer = setTimeout(check, Math.min(Math.max(1000, next.getTime() - Date.now() + 1000), 30 * 60000))
    }
    check()
    const onVis = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVis)
    return () => { if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', onVis) }
  }, [ready, mode, town.lat, town.lng])

  return null
}
