import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { AppProviders } from './providers'
import { CircuitBackground } from '@/components/circuit-background'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: 'Palworld Server Dashboard',
  description: 'Browser-based dashboard for Palworld server monitoring, moderation, and live operations.',
  applicationName: 'Palworld Server Dashboard',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <CircuitBackground
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 text-primary"
          opacity={0.12}
        />
        <div className="relative z-10">
          <AppProviders>
            {children}
          </AppProviders>
        </div>
        <Analytics />
      </body>
    </html>
  )
}
