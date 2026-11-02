// lib/low-data.ts — "Low data mode" (Profile → Settings): show posters
// instead of autoplaying video. Off by default; also on automatically when
// the browser reports Save-Data. Per device.
'use client'

import { useCallback, useEffect, useState } from 'react'

const KEY = 'eta_low_data'
const EVENT = 'eta-low-data-change'

function saveDataHint(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return Boolean(c?.saveData)
}

export function readLowData(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const v = localStorage.getItem(KEY)
    return v === null ? saveDataHint() : v === '1'
  } catch {
    return false
  }
}

export function useLowData(): { lowData: boolean; setLowData: (on: boolean) => void } {
  const [lowData, setState] = useState(false)
  useEffect(() => {
    setState(readLowData())
    const on = (e: Event) => setState((e as CustomEvent<boolean>).detail)
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  const setLowData = useCallback((on: boolean) => {
    try { localStorage.setItem(KEY, on ? '1' : '0') } catch {}
    window.dispatchEvent(new CustomEvent(EVENT, { detail: on }))
  }, [])
  return { lowData, setLowData }
}
