// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'
import LaunchScreen from '@/components/LaunchScreen'

// Absolute base for og:image and canonical URLs. Railway injects
// RAILWAY_PUBLIC_DOMAIN; NEXT_PUBLIC_SITE_URL overrides it for a custom domain.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Experience, Travel, Adventure.',
  description: 'See the Real Jamaica.'
}

export const viewport: Viewport = {
  themeColor: '#F2F2F7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
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
            applies only when the user has chosen it. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try { var t = localStorage.getItem('theme'); if (t === 'dark') { document.documentElement.setAttribute('data-theme', 'dark'); var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', '#000000'); } var l = document.cookie.match(/(?:^|; )eta_lang=(es)/); if (l) document.documentElement.setAttribute('lang', 'es'); } catch (e) {}`
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&family=Pacifico&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/icons/favicon-16.png" sizes="16x16" type="image/png" />
      </head>
      <body>
        <LaunchScreen />
        <main style={{ 
          paddingBottom: '80px',
          minHeight: '100dvh',
          overflowX: 'hidden',
          overflowY: 'visible',
          paddingTop: 0,
          margin: 0
        }}>
          {children}
        </main>
      </body>
    </html>
  )
}
