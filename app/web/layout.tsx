// app/web/layout.tsx
// Desktop web app shell. Lives under /web so it can sit beside the mobile
// app's routes (/, /explore, /experiences, /vendor/[id]) in the same
// project, same Prisma client and same API layer.
import type { Metadata, Viewport } from 'next'
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

// Next's own theme-color tag for every /web page — the browser UI tint
// matches the dark web app instead of the mobile app's light default.
export const viewport: Viewport = {
  themeColor: '#14120E',
  colorScheme: 'dark'
}

export default function WebLayout({ children }: { children: React.ReactNode }) {
  const lang = getServerLang()
  return (
    <div className={`web-root ${fraunces.variable} ${inter.variable}`} lang={lang}>
      {/* Before first paint: switch the browser chrome (page scrollbar,
          native controls, overscroll, UI tint) to the web app's dark theme,
          and opt into scroll-reveal unless reduced motion is on. Content is
          never hidden without JS. WebNav keeps both in sync on client-side
          navigation. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{var d=document.documentElement;d.classList.add('w-web');document.querySelectorAll('meta[name=theme-color]').forEach(function(m){m.setAttribute('content','#14120E')});if(!matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('w-anim')}catch(e){}`
        }}
      />
      <ScrollReveal />
      <WebNav />
      <div className="w-main">{children}</div>
      <WebFooter lang={lang} />
    </div>
  )
}
