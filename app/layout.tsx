// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'
import LaunchScreen from '@/components/LaunchScreen'

export const metadata: Metadata = {
  title: 'ETA — Experience Travel Adventure',
  description: 'Premium membership app for Negril and Montego Bay, Jamaica'
}

export const viewport: Viewport = {
  themeColor: '#FAFAFA',
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body style={{ 
        fontFamily: 'Inter, system-ui, sans-serif',
        backgroundColor: '#FAFAFA',
        color: '#0F0E0C'
      }}>
        <LaunchScreen />
        <main style={{ 
          paddingBottom: '70px', // Space for bottom tab bar
          minHeight: '100vh'
        }}>
          {children}
        </main>
      </body>
    </html>
  )
}