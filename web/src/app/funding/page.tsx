'use client'

import { Gate, Page, PageHeader } from '@/components/layout/page'
import { FundingView } from '@/components/research/funding-view'

export default function FundingPage() {
  return (
    <Gate panel="funding" what="Funding">
      <Page>
        <PageHeader title="Funding" kicker="Who funds work on these conditions">
          Awards from NIH RePORTER linked to conditions in this atlas, and the conditions where none was found in the
          sample.
        </PageHeader>
        <FundingView />
      </Page>
    </Gate>
  )
}
