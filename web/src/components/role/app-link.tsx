'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { useRole } from './role-provider'

/** Adds the current ?role= to an internal href so the lens survives navigation. */
export function withRole(href: string, role: string): string {
  const [path, hash] = href.split('#') as [string, string | undefined]
  const url = new URL(path, 'http://x')
  if (!url.searchParams.has('role')) url.searchParams.set('role', role)
  return `${url.pathname}${url.search}${hash ? `#${hash}` : ''}`
}

export function useHref() {
  const { role } = useRole()
  return (href: string) => withRole(href, role)
}

export function AppLink({ href, ...props }: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const { role } = useRole()
  return <Link href={withRole(href, role)} {...props} />
}
