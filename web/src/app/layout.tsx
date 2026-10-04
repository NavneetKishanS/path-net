import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Providers } from '@/components/providers'
import { AppShell } from '@/components/shell/app-shell'
import './globals.css'

const sans = localFont({
  src: '../../node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2',
  variable: '--font-plex-sans',
  weight: '100 700',
  display: 'swap',
  adjustFontFallback: 'Arial',
})
const mono = localFont({
  src: [
    { path: '../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2', weight: '400' },
    { path: '../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2', weight: '500' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  title: { default: 'PathNet: rare disease atlas', template: '%s · PathNet' },
  description:
    'A mechanism-first map of rare diseases. Follow a condition to a cited connection, a shared resource, a collaborator and a next step.',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1824' },
  ],
}

// Role and selection live in the URL, so pages render per request with the right lens.
export const dynamic = 'force-dynamic'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
