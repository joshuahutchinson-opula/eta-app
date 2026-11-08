// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'
import './home.css'
import './stories.css'
import './rewards.css'
import './market.css'
import './moments.css'
import './motion.css'
import LaunchScreen from '@/components/LaunchScreen'
import SessionGuard from '@/components/SessionGuard'
import { RegionProvider } from '@/components/RegionProvider'
import HapticFallback from '@/components/HapticFallback'
import ThemeAuto from '@/components/ThemeAuto'
import ReviewPrompt from '@/components/ReviewPrompt'
import PlanTripSheet from '@/components/PlanTripSheet'
import TabKeeper from '@/components/TabKeeper'
import TierUpCelebration from '@/components/rewards/TierUpCelebration'
import MorphCapture from '@/components/MorphCapture'

import { siteUrl } from '@/lib/site-url'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: 'Experience, Travel, Adventure.',
  description: 'See the Real Jamaica.'
}

export const viewport: Viewport = {
  themeColor: '#F2F2F7',
  width: 'device-width',
  initialScale: 1
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <meta name="theme-color" content="#F2F2F7" />
        {/* Applies the saved theme before first paint on every page (not
            just Profile, where the preference is set) — otherwise the choice
            only "took" on whichever page set it and reverted on every
            navigation, reload, or direct link. Light is the default; dark
            applies when the user has chosen it, and Auto is dark between the
            selected town's last saved sunset and sunrise (lib/theme.ts). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try { var t = localStorage.getItem('theme'); var d = t === 'dark'; if (t === 'auto') { var n = Date.now(), h = (new Date().getUTCHours() + 19) % 24; try { var sun = JSON.parse(localStorage.getItem('eta_sun') || 'null'); var r = Date.parse(sun.rise), st = Date.parse(sun.set); d = n - r > 864e5 ? (h >= 18 || h < 6) : (n < r || n >= st); } catch (e) { d = h >= 18 || h < 6; } } if (d) { document.documentElement.setAttribute('data-theme', 'dark'); var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', '#000000'); } var l = document.cookie.match(/(?:^|; )eta_lang=(es|de|fr)/); if (l) document.documentElement.setAttribute('lang', l[1]); } catch (e) {}`
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&family=Pacifico&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/icons/favicon-16.png" sizes="16x16" type="image/png" />
      </head>
      <body>
        <LaunchScreen />
        <SessionGuard />
        <HapticFallback />
        <MorphCapture />
        <main style={{ 
          paddingBottom: '80px',
          minHeight: '100dvh',
          overflowX: 'hidden',
          overflowY: 'visible',
          paddingTop: 0,
          margin: 0
        }}>
          <RegionProvider>
            <ThemeAuto />
            <TabKeeper>{children}</TabKeeper>
            <ReviewPrompt />
            <PlanTripSheet />
            <TierUpCelebration />
          </RegionProvider>
        </main>
      </body>
    </html>
  )
}
