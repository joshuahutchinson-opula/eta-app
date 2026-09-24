// app/web/layout.tsx
// Desktop web app shell. Lives under /web so it can sit beside the mobile
// app's routes (/, /explore, /experiences, /vendor/[id]) in the same
// project, same Prisma client and same API layer.
import type { Metadata } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import WebNav from '@/components/web/WebNav'
import WebFooter from '@/components/web/WebFooter'
import ScrollReveal from '@/components/web/ScrollReveal'
import { getServerLang } from '@/lib/i18n-server'
import './web.css'

const fraunces = Fraunces({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-fraunces', display: 'swap' })
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'Experience, Travel, Adventure.', template: '%s' },
  description: 'See the Real Jamaica. Vetted local vendors, experiences and photo spots — live on ETA.'
}

export default function WebLayout({ children }: { children: React.ReactNode }) {
  const lang = getServerLang()
  return (
    <div className={`web-root ${fraunces.variable} ${inter.variable}`} lang={lang}>
      {/* Opt into scroll-reveal before first paint; skipped for reduced motion
          and without JS, so content is never hidden when it can't animate in. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('w-anim')}catch(e){}`
        }}
      />
      <ScrollReveal />
      <WebNav />
      <div className="w-main">{children}</div>
      <WebFooter lang={lang} />
    </div>
  )
}
