// components/Dock.tsx — the bottom tab bar. It shows on the five tab roots
// and on list/browse screens reached from them. Full-screen detail pages and
// step-by-step flows (vendor, experience, event, stay, trip, receipt,
// photo spot, stories, booking/plan flows, login, onboarding) leave it out
// and use the shared <BackButton /> instead, so their bottom CTA can sit at
// the very bottom of the screen.
// On Home, once scrolled down, the Home tab turns into an up arrow: tapping
// it glides back to the top (a jump with reduce motion).
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'
import { prefersReducedMotion } from '@/lib/motion'

export default function Dock() {
  const pathname = usePathname()
  const [pulseDone, setPulseDone] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { t } = useLang()
  const onHome = pathname === '/'

  useEffect(() => {
    if (!onHome) { setScrolled(false); return }
    let raf = 0
    const update = () => { raf = 0; setScrolled(window.scrollY > 520) }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [onHome])

  const tabs = [
    { name: t('m.tab.home'), href: '/', icon: 'home', type: 'icon' },
    { name: t('m.tab.experiences'), href: '/experiences', icon: 'compass', type: 'icon' },
    { name: t('m.tab.pay'), href: '/pay', icon: '', type: 'logo' },
    { name: t('m.tab.market'), href: '/marketplace', icon: 'marketplace', type: 'icon' },
    { name: t('m.tab.profile'), href: '/profile', icon: 'user', type: 'icon' }
  ]

  useEffect(() => {
    const timer = setTimeout(() => setPulseDone(true), 1300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <nav className="tab-bar" aria-label={t('m.tab.nav')}>
      {tabs.map(tab => {
        const isActive = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            scroll={false}
            onClick={e => {
              triggerHaptic('selection')
              if (tab.href === '/' && onHome && scrolled) {
                e.preventDefault()
                window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
              }
            }}
            aria-current={isActive ? 'page' : undefined}
            aria-label={tab.type === 'logo' ? tab.name : tab.href === '/' && onHome && scrolled ? t('m.h2.backToTop') : undefined}
            className={`tab-item ${isActive ? 'active' : 'inactive'}`}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              textDecoration: 'none',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            {tab.type === 'logo' ? (
              <div className={`tab-logo-container ${!pulseDone ? 'tab-logo-pulse' : ''}`}>
                <img
                  src="/logo-tb.png"
                  alt=""
                  className="tab-logo"
                />
              </div>
            ) : (
              <>
                <div className={`tab-icon ${tab.href === '/' && onHome && scrolled ? 'to-top' : ''}`} aria-hidden>
                  <Icon name={tab.href === '/' && onHome && scrolled ? 'arrowUp' : tab.icon} size={24} />
                </div>
                <span className="tab-label">{tab.name}</span>
              </>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
