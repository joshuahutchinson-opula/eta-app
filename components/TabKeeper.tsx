// components/TabKeeper.tsx — makes switching tabs instant. The five tab
// screens (Home, Experiences, Scan & Pay, Market, Profile) are rendered
// here, in the root layout, instead of by their routes (whose pages render
// nothing). Every tab that has been opened stays mounted — hidden when it
// isn't the current one — so coming back shows it exactly as it was:
// same screen, same scroll position, same data, no skeletons or loading
// screen. When a tab comes back into view it refreshes its data quietly
// (useTabShow). After Home loads, Experiences, Market and Profile are
// mounted in the background so their data is ready before the first tap
// (Scan & Pay isn't: it opens the camera). Opening a tab with a deep link
// (?mood=, ?trip=, ?code=, ?settings=…) starts that tab afresh.
'use client'

import { createContext, Suspense, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useSearchParams } from 'next/navigation'

const TABS = {
  '/': dynamic(() => import('@/components/tabs/HomeTab')),
  '/experiences': dynamic(() => import('@/components/tabs/ExperiencesTab')),
  '/pay': dynamic(() => import('@/components/tabs/PayTab')),
  '/marketplace': dynamic(() => import('@/components/tabs/MarketTab')),
  '/profile': dynamic(() => import('@/components/tabs/ProfileTab'))
} as const
type TabPath = keyof typeof TABS
const isTab = (p: string | null): p is TabPath => Boolean(p && p in TABS)

/** Mounted after Home has loaded, so they open instantly. */
const PREFETCH: TabPath[] = ['/experiences', '/marketplace', '/profile']
const SHOW_EVENT = 'eta-tab-show'
// Layout effects only exist in the browser.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

const TabContext = createContext<{ current: string | null } | null>(null)

/** Is this tab the one on screen? (Hidden tabs stay mounted.) */
export function useTabActive(path: TabPath): boolean {
  const ctx = useContext(TabContext)
  return ctx === null || ctx.current === path
}

/** Runs `fn` each time this tab comes back on screen (not on its first mount): refresh quietly. */
export function useTabShow(path: TabPath, fn: () => void) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    const on = (e: Event) => { if ((e as CustomEvent<string>).detail === path) ref.current() }
    window.addEventListener(SHOW_EVENT, on)
    return () => window.removeEventListener(SHOW_EVENT, on)
  }, [path])
}

function Keeper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const search = useSearchParams()
  const query = search?.toString() ?? ''
  const current = isTab(pathname) ? pathname : null
  // Each mounted tab, with a key that changes only for a deep link.
  const [mounted, setMounted] = useState<Partial<Record<TabPath, string>>>(() => (current ? { [current]: `${current}?${query}` } : {}))
  const scrolls = useRef<Partial<Record<TabPath, number>>>({})
  const shown = useRef<TabPath | null>(current)

  // Visiting a tab mounts it; a deep link (a query) starts it afresh.
  useEffect(() => {
    if (!current) return
    setMounted(m => {
      if (m[current] && !query) return m
      const key = `${current}?${query}`
      return m[current] === key ? m : { ...m, [current]: key }
    })
  }, [current, query])

  // Remember each tab's scroll position while it's on screen.
  useEffect(() => {
    if (!current) return
    const save = () => { scrolls.current[current] = window.scrollY }
    window.addEventListener('scroll', save, { passive: true })
    return () => window.removeEventListener('scroll', save)
  }, [current])

  // Back on a tab: its scroll position, then a quiet refresh of its data.
  useIsoLayoutEffect(() => {
    const prev = shown.current
    shown.current = current
    if (!current || prev === current) return
    const y = scrolls.current[current] ?? 0
    window.scrollTo(0, y)
    requestAnimationFrame(() => window.scrollTo(0, y))
    window.dispatchEvent(new CustomEvent(SHOW_EVENT, { detail: current }))
  }, [current])

  // After Home has loaded, get the other tabs ready in the background.
  useEffect(() => {
    if (current !== '/') return
    const go = () => setMounted(m => {
      const next = { ...m }
      for (const p of PREFETCH) if (!next[p]) next[p] = `${p}?`
      return next
    })
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    const timer = setTimeout(() => (idle ? idle(go, { timeout: 2500 }) : go()), 1500)
    return () => clearTimeout(timer)
  }, [current])

  return (
    <TabContext.Provider value={{ current }}>
      {children}
      {(Object.keys(TABS) as TabPath[]).map(path => {
        const key = mounted[path]
        if (!key) return null
        const Tab = TABS[path]
        const on = path === current
        return (
          <div key={key} className="tab-screen" hidden={!on} aria-hidden={!on} style={on ? undefined : { display: 'none' }}>
            <Tab />
          </div>
        )
      })}
    </TabContext.Provider>
  )
}

export default function TabKeeper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={children}>
      <Keeper>{children}</Keeper>
    </Suspense>
  )
}
