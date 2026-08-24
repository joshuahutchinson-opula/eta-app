// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'
import LaunchScreen from '@/components/LaunchScreen'

export const metadata: Metadata = {
  title: 'ETA — Experience Travel Adventure',
  description: 'Premium membership app for Negril and Montego Bay, Jamaica'
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&family=Pacifico&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body style={{ 
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
        backgroundColor: '#F2F2F7',
        color: '#000000',
        margin: 0,
        padding: 0
      }}>
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