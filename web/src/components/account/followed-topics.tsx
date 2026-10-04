'use client'

import { useAccount } from './account-provider'
import { useGraph } from '@/lib/queries'
import { AppLink } from '@/components/role/app-link'
import { nodeHref } from '@/components/search/global-search'
import { ArrowRight, Bookmark } from 'lucide-react'

export function FollowedTopics() {
  const { user, profile, ready } = useAccount()
  const graph = useGraph()
  if (!ready || !user || !profile.interests.length) return null
  const topics = graph.data?.nodes.filter((node) => profile.interests.includes(node.id)) ?? []
  return (
    <section aria-labelledby="followed-topics" className="mx-auto max-w-[1280px] px-4 pt-6 md:px-6">
      <div className="rounded-sm border border-line bg-band p-4 md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="followed-topics" className="flex items-center gap-2 text-h3">
            <Bookmark className="size-4 text-accent" aria-hidden />
            Your followed topics
          </h2>
          <AppLink href="/account" className="link text-label">
            Edit your preferences
          </AppLink>
        </div>
        <p className="mt-1 text-label text-ink-2">
          Private shortcuts to the topics you chose. Following a condition does not record a diagnosis.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((node) => (
            <AppLink
              key={node.id}
              href={nodeHref(node)}
              className="flex items-center justify-between gap-3 rounded-sm border border-line bg-paper px-3 py-2 text-ui text-accent-ink hover:border-accent hover:underline"
            >
              {node.name}
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            </AppLink>
          ))}
        </div>
        {graph.isLoading && (
          <p role="status" className="mt-2 text-label text-ink-2">
            Loading your topics…
          </p>
        )}
        {!graph.isLoading && topics.length < profile.interests.length && (
          <p className="mt-2 text-label text-ink-2">
            Some saved topics are outside the current atlas snapshot. Your preferences are retained.
          </p>
        )}
      </div>
    </section>
  )
}
