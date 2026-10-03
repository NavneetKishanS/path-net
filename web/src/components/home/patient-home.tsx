'use client'

import { GlobalSearch } from '@/components/search/global-search'
import { Page } from '@/components/layout/page'

/** Patient / Caregiver: one calm question. Phone first. */
export function PatientHome() {
  return (
    <Page narrow className="md:py-20">
      <h1 className="text-h2 text-ink md:text-h1">Find your community</h1>
      <p className="mt-3 max-w-[52ch] text-body text-ink-2">
        Type the diagnosis from your report, the gene name, or a symptom. We will show the families and groups for that
        condition, or the closest related ones, and where each link comes from.
      </p>
      <div className="mt-8">
        <GlobalSearch size="hero" autoFocus />
      </div>
      <p className="mt-4 text-label text-ink-3">
        For example: <span className="text-ink-2">STXBP1</span>, <span className="text-ink-2">EIEE13</span> or{' '}
        <span className="text-ink-2">SCN2A disorders</span>.
      </p>
      <div className="mt-12 border-t border-line pt-5 text-ui text-ink-2">
        <h2 className="mb-2 font-sans text-ui font-semibold text-ink">How this works</h2>
        <ul className="space-y-1.5">
          <li>Every link shown comes from a named source you can open.</li>
          <li>
            Some links are worked out by the atlas from two sources. Those are marked, and they are leads to check with
            your care team, not facts.
          </li>
          <li>If we cannot find a well-supported link, we say so instead of guessing.</li>
        </ul>
      </div>
    </Page>
  )
}
