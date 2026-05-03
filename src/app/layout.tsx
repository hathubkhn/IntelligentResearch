import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Toaster } from 'sonner'
import { ConditionalNav } from '@/components/layout/ConditionalNav'
import { Providers } from '@/components/layout/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Intelligence Research Hub',
  description: 'Discover AI research papers from top conferences, manage your reading list with AI summaries, and explore a curated library of papers. Built by Applied AI Lab.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans min-h-full flex flex-col antialiased" suppressHydrationWarning>
        <Providers>
          <ConditionalNav>{children}</ConditionalNav>
          <Toaster richColors position="bottom-right" />
        </Providers>
      </body>
    </html>
  )
}
