'use client'

import { Gate, Page, PageHeader } from '@/components/layout/page'
import { MechanismPicker } from '@/components/scout/mechanism-picker'

export default function MechanismsPage() {
  return (
    <Gate panel="mechanismRanking" what="Mechanism ranking">
      <Page>
        <PageHeader title="Where could one mechanism reach?" kicker="Ranked clusters">
          Pick how your therapy acts. Clusters are ranked by cited conditions and readiness: registries, patient groups
          and investigators already in place.
        </PageHeader>
        <MechanismPicker />
      </Page>
    </Gate>
  )
}
