'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { ThemeProvider } from 'next-themes'
import { MotionConfig } from 'motion/react'
import { getApiClient } from '@/api'
import { RoleProvider } from './role/role-provider'

// Start fetching and indexing the dataset while React hydrates, not after.
if (typeof window !== 'undefined') void getApiClient().meta()

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } }),
  )
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <NuqsAdapter>
        <QueryClientProvider client={client}>
          <MotionConfig reducedMotion="user" transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}>
            <RoleProvider>{children}</RoleProvider>
          </MotionConfig>
        </QueryClientProvider>
      </NuqsAdapter>
    </ThemeProvider>
  )
}
