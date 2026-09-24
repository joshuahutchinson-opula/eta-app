// components/web/WebNav.tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useLang } from '@/lib/i18n-client'
import type { DictKey } from '@/lib/i18n'

const WEB_TINT = '#14120E'

const LINKS: Array<{ href: string; key: DictKey }> = [
  { href: '/web/explore', key: 'nav.explore' },
  { href: '/web/experiences', key: 'nav.experiences' },
  { href: '/web/photo-spots', key: 'nav.photoSpots' },
  { href: '/web/guides', key: 'nav.guides' },
  { href: '/web/for-vendors', key: 'nav.forVendors' }
]

export default function WebNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { lang, setLang, t } = useLang()
  const [scrolled, setScrolled] = useState(false)
  const [refreshing, startRefresh] = useTransition()

  // Dark browser chrome while the web app is mounted; handed back to the
  // mobile app's light theme on the way out (client-side navigation doesn't
  // re-run the layout's inline script).
  useEffect(() => {
    const root = document.documentElement
    // Next emits its own theme-color tag(s) beside the root layout's; set them all.
    const setTint = (value: string) =>
      document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', value))
    root.classList.add('w-web')
    setTint(WEB_TINT)
    return () => {
      root.classList.remove('w-web', 'w-anim')
      // Back to the mobile app's tint for whichever theme it's showing.
      setTint(root.getAttribute('data-theme') === 'dark' ? '#000000' : '#F2F2F7')
    }
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Soft cross-fade of the page while the server re-renders in the new language.
  useEffect(() => {
    const root = document.querySelector('.web-root')
    if (!root) return
    if (refreshing) {
      root.classList.add('w-lang-switching')
    } else {
      const timer = window.setTimeout(() => root.classList.remove('w-lang-switching'), 60)
      return () => window.clearTimeout(timer)
    }
  }, [refreshing])

  const switchLang = (next: 'en' | 'es') => {
    if (next === lang) return
    setLang(next)
    document.querySelector('.web-root')?.classList.add('w-lang-switching')
    // Server-rendered copy reads the cookie, so re-render the route.
    startRefresh(() => router.refresh())
  }

  return (
    <header className={`w-nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="w-container w-nav-inner">
        <Link href="/web" className="w-nav-logo" aria-label="ETA home">
          <img className="w-logo-light" src="/logo.png" alt="ETA" />
          <img className="w-logo-dark" src="/logo-dark.png" alt="ETA" />
        </Link>
        <nav className="w-nav-links" aria-label="Main">
          {LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`w-nav-link ${pathname?.startsWith(link.href) ? 'active' : ''}`}
              aria-current={pathname?.startsWith(link.href) ? 'page' : undefined}
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>
        <div className="w-nav-right">
          <div className="w-lang" role="group" aria-label="Language" data-lang={lang}>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => switchLang('en')}>EN</button>
            <button type="button" aria-pressed={lang === 'es'} onClick={() => switchLang('es')}>ES</button>
          </div>
          <Link href="/web/get-the-app" className="w-btn w-btn-primary w-btn-sm">{t('nav.getApp')}</Link>
        </div>
      </div>
    </header>
  )
}
