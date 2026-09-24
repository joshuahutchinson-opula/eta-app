// app/web/layout.tsx
// Desktop web app shell. Lives under /web so it can sit beside the mobile
// app's routes (/, /explore, /experiences, /vendor/[id]) in the same
// project, same Prisma client and same API layer.
import type { Metadata } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import WebNav from '@/components/web/WebNav'
import WebFooter from '@/components/web/WebFooter'
import { getServerLang } from '@/lib/i18n-server'
import './web.css'

const fraunces = Fraunces({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-fraunces', display: 'swap' })
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'ETA — Negril & Montego Bay, Jamaica', template: '%s · ETA' },
  description: 'Discover vetted local vendors, experiences and photo spots in Negril and Montego Bay, Jamaica — live on ETA.'
}

export default function WebLayout({ children }: { children: React.ReactNode }) {
  const lang = getServerLang()
  return (
    <div className={`web-root ${fraunces.variable} ${inter.variable}`} lang={lang}>
      <WebNav />
      <div className="w-main">{children}</div>
      <WebFooter lang={lang} />
    </div>
  )
}
