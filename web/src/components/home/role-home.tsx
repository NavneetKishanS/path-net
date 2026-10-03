'use client'

import { useRole } from '@/components/role/role-provider'
import { AppLink } from '@/components/role/app-link'
import { Page, PageHeader, Section } from '@/components/layout/page'
import { MechanismPicker } from '@/components/scout/mechanism-picker'
import { MechanismIndex } from '@/components/research/mechanism-index'
import { AdminView } from '@/components/admin/admin-view'
import { LeaderHome } from './leader-home'
import { PatientHome } from './patient-home'

export function RoleHome() {
  const { config } = useRole()
  switch (config.home) {
    case 'leader':
      return <LeaderHome />
    case 'patient':
      return <PatientHome />
    case 'scout':
      return (
        <Page>
          <PageHeader title="Where could one mechanism reach?" kicker={config.label}>
            Pick how your therapy acts. Each cluster lists the conditions with cited evidence, and what is already in
            place to run a study.
          </PageHeader>
          <MechanismPicker />
        </Page>
      )
    case 'researcher':
      return (
        <Page>
          <PageHeader title="Who else works on your mechanism?" kicker={config.label}>
            Every mechanism in the atlas, the conditions it is cited for under each of their names, evidence against it,
            and the investigators on those conditions. Search by gene, synonym or ontology id from the bar above.
          </PageHeader>
          <div className="mb-8 flex flex-wrap gap-x-6 gap-y-2 text-ui">
            <AppLink href="/people" className="link">
              All investigators
            </AppLink>
            <AppLink href="/funding" className="link">
              Funding
            </AppLink>
            <AppLink href="/explore" className="link">
              Map
            </AppLink>
          </div>
          <Section title="Mechanisms" id="mechanisms">
            <MechanismIndex />
          </Section>
        </Page>
      )
    case 'admin':
      return (
        <Page>
          <PageHeader title="Atlas administration" kicker={config.label}>
            Builder status, links waiting for review, synonyms, thresholds and what the sources cover. Every other view
            is available from the menu above.
          </PageHeader>
          <AdminView />
        </Page>
      )
  }
}
