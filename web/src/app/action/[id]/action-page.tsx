'use client'

import { Gate } from '@/components/layout/page'
import { ActionView } from '@/components/action/action-view'

export function ActionPage({ id }: { id: string }) {
  return (
    <Gate panel="action" what="The action plan">
      <ActionView diseaseId={id} />
    </Gate>
  )
}
