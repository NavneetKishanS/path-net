'use client'

import { Gate, Page, PageHeader } from '@/components/layout/page'
import { PeopleView } from '@/components/research/people-view'

export default function PeoplePage() {
  return (
    <Gate panel="people" what="Investigators">
      <Page>
        <PageHeader title="Investigators" kicker="Key people and shared opinion leaders">
          Principal investigators on NIH awards linked to these conditions. People whose work spans more than one
          mechanism cluster come first.
        </PageHeader>
        <PeopleView />
      </Page>
    </Gate>
  )
}
