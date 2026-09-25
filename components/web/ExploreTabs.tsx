// components/web/ExploreTabs.tsx — Explore's two subtabs: the vendor directory and the Discover map.
import Link from 'next/link'
import Icon from '@/lib/icons'
import { t, type Lang } from '@/lib/i18n'

export default function ExploreTabs({ active, lang }: { active: 'directory' | 'discover'; lang: Lang }) {
  return (
    <nav className="w-subtabs" aria-label="Explore">
      <Link href="/web/explore" className="w-subtab" aria-current={active === 'directory' ? 'page' : undefined}>
        <Icon name="journal" size={16} /> {t(lang, 'explore.tabDirectory')}
      </Link>
      <Link href="/web/explore/discover" className="w-subtab" aria-current={active === 'discover' ? 'page' : undefined}>
        <Icon name="compass" size={16} /> {t(lang, 'explore.tabDiscover')}
      </Link>
    </nav>
  )
}
